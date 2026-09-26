FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies first so this layer is cached across code-only changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 4100

# Migrations are applied explicitly via `npx prisma migrate deploy` as a
# separate, controlled step (see docs/deploy.md) — never automatically on
# every container start, so a multi-replica rollout can't race migrations.
CMD ["node", "src/server.js"]
