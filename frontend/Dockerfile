FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Копіюємо конфігурацію воркспейсу
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY frontend/package.json ./frontend/

# Встановлюємо залежності (ігноруємо нативні білд-скрипти root canvas)
RUN pnpm install --frozen-lockfile --filter frontend... --filter @sf/shared-types... --ignore-scripts

# Копіюємо вихідний код
COPY packages/shared-types ./packages/shared-types
COPY frontend ./frontend

# Збираємо типи та фронтенд
RUN pnpm --filter @sf/shared-types run build && \
    pnpm --filter frontend run build

# Етап роздачі статики через Nginx
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
