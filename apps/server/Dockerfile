# API server image. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t fluentpath-api .
FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/server --workspace packages/shared --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/server apps/server
ENV NODE_ENV=production PORT=4000 HOST=0.0.0.0
EXPOSE 4000
USER node
WORKDIR /app/apps/server
# Runs pending migrations on start, then serves HTTP + WebSocket.
CMD ["node", "--import", "tsx", "src/index.ts"]
