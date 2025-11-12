# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Устанавливаем необходимые зависимости для сборки нативных модулей
RUN apk add --no-cache python3 make g++

COPY package.json ./

# Удаляем package-lock.json если он есть и пересоздаём в Docker
# Это гарантирует, что будут установлены правильные нативные модули для Alpine
RUN npm install

COPY . .

EXPOSE 5173

# Build the application and run in preview mode (production-like server)
RUN npm run build
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
