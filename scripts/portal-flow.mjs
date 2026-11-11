import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deployDirectory = path.resolve(root, '..', 'databridge-deploy')
const fixturePath = path.join(root, 'tests', 'fixtures', 'client-upload.csv')
const videoRequested = process.argv.includes('--record')
const videoOutput = process.env.DATABRIDGE_VIDEO_PATH
  ? path.resolve(process.env.DATABRIDGE_VIDEO_PATH)
  : path.join(root, 'artifacts', 'databridge-full-flow.webm')
const testId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const clientEmail = `flow-client-${testId}@example.com`
const secondClientEmail = `flow-client-two-${testId}@example.com`
const analystEmail = `flow-analyst-${testId}@example.com`
const password = `Flow-test-${testId}-passphrase`
const projectName = `DataBridge walkthrough ${testId}`
const secondProjectName = `DataBridge second client ${testId}`
const fileName = path.basename(fixturePath)
const downloadPath = path.join(tmpdir(), `databridge-${testId}-${fileName}`)

const objectKeys = []
let browser
let context
let page
let videoTemporaryDirectory

function runCompose(args, options = {}) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: deployDirectory,
    encoding: 'utf8',
    timeout: 60_000,
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `docker compose ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function provisionAnalyst() {
  runCompose([
    'exec', '-T', 'client-portal-service', 'python', 'scripts/create_user.py',
    '--email', analystEmail, '--display-name', 'Walkthrough Analyst', '--role', 'analyst',
  ], { input: `${password}\n${password}\n` })
}

async function removeTestData() {
  const cleanup = `import sys
import json
from sqlalchemy import text
from app.main import UPLOAD_BUCKET, engine, s3
client_email, second_client_email, keys_json, analyst_email = sys.argv[1:]
for key in json.loads(keys_json):
    s3.delete_object(Bucket=UPLOAD_BUCKET, Key=key)
with engine.begin() as connection:
    connection.execute(text("DELETE FROM submissions WHERE contributor_id IN (SELECT id FROM users WHERE email IN (:client, :second_client))"), {"client": client_email, "second_client": second_client_email})
    connection.execute(text("DELETE FROM users WHERE email IN (:client, :second_client, :analyst)"), {"client": client_email, "second_client": second_client_email, "analyst": analyst_email})
engine.dispose()
`
  const result = spawnSync('docker', [
    'compose', 'exec', '-T', 'client-portal-service', 'python', '-c', cleanup,
    clientEmail, secondClientEmail, JSON.stringify(objectKeys), analystEmail,
  ], { cwd: deployDirectory, encoding: 'utf8', timeout: 60_000 })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Could not clean up workflow test data')
}

function removeFileMetadata(objectKey) {
  const cleanup = `import sys
from sqlalchemy import text
from app.main import engine
with engine.begin() as connection:
    connection.execute(text("DELETE FROM submission_files WHERE object_key = :key"), {"key": sys.argv[1]})
engine.dispose()
`
  runCompose(['exec', '-T', 'client-portal-service', 'python', '-c', cleanup, objectKey])
}

async function testFlow() {
  for (const [url, service] of [
    ['http://127.0.0.1:8081/health', 'client API'],
    ['http://127.0.0.1:8082/health', 'analytics API'],
  ]) {
    const response = await fetch(url)
    assert.equal(response.status, 200, `${service} must be healthy`)
  }

  provisionAnalyst()
  browser = await chromium.launch({ headless: true })
  const width = 1920
  const height = 1080
  const options = {
    viewport: { width, height },
    screen: { width, height },
    acceptDownloads: true,
  }
  if (videoRequested) {
    videoTemporaryDirectory = await mkdtemp(path.join(tmpdir(), 'databridge-flow-video-'))
    options.recordVideo = { dir: videoTemporaryDirectory, size: { width, height } }
  }
  context = await browser.newContext(options)
  page = await context.newPage()
  const pause = async (milliseconds) => {
    if (videoRequested) await page.waitForTimeout(milliseconds)
  }

  await page.goto('http://127.0.0.1:5173/')
  await page.getByRole('heading', { name: 'Choose your workspace' }).waitFor()
  await page.getByRole('heading', { name: 'Client portal' }).waitFor()
  await page.getByRole('heading', { name: 'Analytics workspace' }).waitFor()
  await page.getByRole('link', { name: 'Create a client account' }).click()
  await pause(900)
  await page.getByLabel('Full name').fill('Walkthrough Client')
  await page.getByLabel('Email').fill(clientEmail)
  await page.getByLabel('Organization').fill('DataBridge Test')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('heading', { name: 'Welcome, Walkthrough Client' }).waitFor()
  await pause(1200)

  await page.locator('.profile-button').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor()
  await page.getByLabel('Email').fill(clientEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('heading', { name: 'Welcome, Walkthrough Client' }).waitFor()
  await pause(1000)

  await page.getByRole('button', { name: 'Upload data' }).first().click()
  await pause(700)
  await page.getByLabel('Project name').fill(projectName)
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  const presignResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/storage/presigned-upload') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Submit data' }).click()
  const presignResponse = await presignResponsePromise
  assert.equal(presignResponse.status(), 200, 'the API should authorize the client upload')
  objectKeys.push((await presignResponse.json()).key)
  await page.getByText(/uploaded successfully/i).waitFor({ timeout: 30_000 })
  await pause(1500)

  await page.goto('http://127.0.0.1:5173/submissions')
  await page.getByText(projectName).waitFor()
  await page.getByRole('button', { name: 'View files (1)' }).click()
  await page.getByText(fileName).waitFor()
  await pause(1600)

  await page.locator('.profile-button').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('link', { name: 'Back to workspace selection' }).click()
  await page.getByRole('heading', { name: 'Choose your workspace' }).waitFor()

  await page.getByRole('link', { name: 'Create a client account' }).click()
  await pause(700)
  await page.getByLabel('Full name').fill('Second Walkthrough Client')
  await page.getByLabel('Email').fill(secondClientEmail)
  await page.getByLabel('Organization').fill('DataBridge Test')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('heading', { name: 'Welcome, Second Walkthrough Client' }).waitFor()
  await page.getByRole('button', { name: 'Upload data' }).first().click()
  await page.getByLabel('Project name').fill(secondProjectName)
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  const secondPresignResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/storage/presigned-upload') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Submit data' }).click()
  const secondPresignResponse = await secondPresignResponsePromise
  assert.equal(secondPresignResponse.status(), 200, 'the second client upload should be authorized')
  objectKeys.push((await secondPresignResponse.json()).key)
  await page.getByText(/uploaded successfully/i).waitFor({ timeout: 30_000 })
  await pause(1000)
  removeFileMetadata(objectKeys[1])

  await page.locator('.profile-button').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('link', { name: 'Back to workspace selection' }).click()
  await page.getByRole('heading', { name: 'Choose your workspace' }).waitFor()
  await page.getByRole('link', { name: 'Sign in to analytics' }).click()
  await page.waitForURL('http://127.0.0.1:5173/analytics/')
  await page.getByLabel('Work email').fill(analystEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('heading', { name: /Welcome, Walkthrough Analyst/ }).waitFor()
  await pause(1200)
  await page.goto('http://127.0.0.1:5173/analytics/inbox')

  const analystSubmission = page.getByRole('row').filter({ hasText: projectName })
  await analystSubmission.waitFor()
  const secondAnalystSubmission = page.getByRole('row').filter({ hasText: secondProjectName })
  await secondAnalystSubmission.waitFor()
  await page.getByText('All client submissions are shown here, regardless of assignment.').waitFor()
  await pause(1000)
  await analystSubmission.getByRole('button', { name: 'View files (1)' }).click()
  await analystSubmission.getByText(fileName).waitFor()
  await secondAnalystSubmission.getByRole('button', { name: 'Check for uploaded files' }).click()
  await secondAnalystSubmission.getByRole('button', { name: 'Hide files' }).waitFor()
  await secondAnalystSubmission.getByText(fileName).waitFor()
  await pause(1500)

  const downloadPromise = page.waitForEvent('download')
  await secondAnalystSubmission.getByRole('button', { name: 'Download' }).click()
  const download = await downloadPromise
  await download.saveAs(downloadPath)
  assert.equal(download.suggestedFilename(), fileName)
  const downloadedFile = await readFile(downloadPath, 'utf8')
  assert.match(downloadedFile, /Sample client upload for the DataBridge workflow test/)
  await pause(1000)
  console.log('Passed: two client uploads, global analyst inbox, legacy file metadata recovery, and cross-client download.')
}

try {
  await testFlow()
} finally {
  if (context) await context.close()
  if (browser) await browser.close()
  await rm(downloadPath, { force: true })
  if (videoTemporaryDirectory) {
    const [recordedVideo] = await readdir(videoTemporaryDirectory)
    if (recordedVideo) {
      await mkdir(path.dirname(videoOutput), { recursive: true })
      await rename(path.join(videoTemporaryDirectory, recordedVideo), videoOutput)
      console.log(`Recorded 1920x1080 walkthrough: ${videoOutput}`)
    }
    await rm(videoTemporaryDirectory, { recursive: true, force: true })
  }
  await removeTestData()
}
