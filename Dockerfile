FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY apps ./apps
ARG PORTAL=client
RUN npm run build:${PORTAL}

FROM nginx:1.27-alpine
ARG PORTAL=client
COPY apps/${PORTAL}-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist-${PORTAL} /usr/share/nginx/html
EXPOSE 80
