# Build context is the repository root so shared/layouts is available.
FROM node:22-bookworm-slim AS deps
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
# Optional native binaries are skipped silently when a download fails: retry, then check.
RUN npm config set fetch-retries 5 && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --no-audit --no-fund \
    && node -e "require.resolve('@next/swc-linux-x64-gnu')"

FROM node:22-bookworm-slim AS builder
WORKDIR /build
COPY shared ./shared
COPY frontend ./frontend
COPY --from=deps /build/frontend/node_modules ./frontend/node_modules
WORKDIR /build/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /build/frontend/.next/standalone ./
COPY --from=builder /build/frontend/.next/static ./.next/static
COPY --from=builder /build/frontend/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
