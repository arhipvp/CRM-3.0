# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Устанавливаем необходимые зависимости для сборки нативных модулей
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm install

COPY . .

EXPOSE 5173

# Запускаем dev сервер Vite для разработки
# Это обеспечивает правильную загрузку CSS и других статических файлов
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
