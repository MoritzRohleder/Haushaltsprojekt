# Haushalt – Produktions-Image
# Fertige Images: ghcr.io/moritzrohleder/haushaltsprojekt (entstehen automatisch bei jedem Release)
# Selbst bauen:   docker build -t haushalt .

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/MoritzRohleder/Haushaltsprojekt" \
      org.opencontainers.image.description="Haushalt – Verwaltung der monatlichen Finanzen" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public
COPY docs/wiki ./docs/wiki

# Daten gehören dem unprivilegierten Nutzer "node" (UID 1000).
RUN mkdir -p /app/data && chown node:node /app/data
USER node

VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "src/server.js"]
