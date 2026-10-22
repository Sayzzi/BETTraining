# syntax=docker/dockerfile:1
FROM node:26-alpine AS base
RUN npm install -g pnpm@11.20.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Full toolchain image: builds the app and runs database migrations.
FROM deps AS builder
COPY . .
# Placeholders so `next build` can load the auth module; the runner stage gets real values.
ENV NEXT_TELEMETRY_DISABLED=1 \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    BETTER_AUTH_URL=http://localhost:3000
RUN pnpm build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
