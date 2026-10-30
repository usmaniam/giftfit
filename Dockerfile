# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@12.16.1
WORKDIR /app

FROM base AS build
# better-sqlite3 compiles a native module when no prebuilt binary matches
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 DEMO_MODE=true \
    DATABASE_URL=file:/data/giftfit.db STORAGE_DIR=/data/storage SECRET_FILE=/data/.invite-secret
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/scripts/start.sh ./scripts/start.sh
COPY --from=build /app/package.json /app/tsconfig.json /app/next.config.mjs /app/postcss.config.mjs /app/drizzle.config.ts ./
RUN mkdir -p /data && chmod +x scripts/start.sh
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./scripts/start.sh"]
