FROM node:22-bookworm

# Установка системних залежностей для Firefox, Camoufox, Xvfb та Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    xvfb \
    libgtk-3-0 \
    libx11-xcb1 \
    libdbus-glib-1-2 \
    libxt6 \
    libasound2 \
    libpci3 \
    libegl1 \
    libgl1 \
    lsof \
    curl \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Встановлення Camoufox через pip та завантаження антидетект-бінарника
RUN pip install --no-cache-dir --break-system-packages camoufox && \
    python3 -m camoufox fetch && \
    CAMOUFOX_DIR=$(python3 -m camoufox path) && \
    chmod -R 755 "$CAMOUFOX_DIR" && \
    ln -sf "$CAMOUFOX_DIR/camoufox-bin" /usr/local/bin/camoufox-bin

# Налаштування pnpm (версія 9 сумісна з lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Копіюємо файли воркспейсу для кешування залежностей
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY backend/package.json ./backend/

# Встановлюємо залежності для backend і shared-types (без root canvas)
RUN pnpm install --frozen-lockfile --filter bot-builder-backend... --filter @sf/shared-types... --ignore-scripts

# Копіюємо вихідний код
COPY packages/shared-types ./packages/shared-types
COPY backend ./backend

# Збираємо shared-types
RUN pnpm --filter @sf/shared-types run build

WORKDIR /app/backend

EXPOSE 3001

ENV NODE_ENV=production
ENV CAMOUFOX_PROFILES_DIR=/app/profiles
ENV CAMOUFOX_DEFAULT_PROFILE=default
ENV CAMOUFOX_EXECUTABLE_PATH=/usr/local/bin/camoufox-bin
ENV DISPLAY=:99

# Створюємо директорії для профілів та даних
RUN mkdir -p /app/profiles /app/data /app/backend/projects

# Запуск з Xvfb віртуальним дисплеєм для стабільної роботи Firefox без крашів
CMD ["sh", "-c", "rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 && Xvfb :99 -screen 0 1280x720x24 -ac & exec pnpm start"]
