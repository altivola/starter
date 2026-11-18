# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@app/server..." \
 && pnpm --filter @app/server build

# The bundle has every dependency inside, so the runtime image needs no node_modules.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/node.js"]
