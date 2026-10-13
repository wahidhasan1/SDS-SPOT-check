# Static web app served by nginx. Build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t fluentpath-web .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN npm ci --workspace apps/web --workspace packages/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_API_URL
ARG VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL VITE_APP_NAME=$VITE_APP_NAME
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
