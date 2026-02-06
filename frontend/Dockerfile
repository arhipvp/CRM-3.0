# syntax=docker/dockerfile:1
FROM node:20-alpine AS build

WORKDIR /app

# Устанавливаем зависимости для сборки нативных модулей.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_TELEGRAM_BOT_USERNAME
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TELEGRAM_BOT_USERNAME=${VITE_TELEGRAM_BOT_USERNAME}

RUN npm run build

FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist/ .
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
