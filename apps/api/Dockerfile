# ── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

# Copy only manifests first (maximizes layer cache reuse)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install ALL dependencies (includes dev deps needed for build/prisma)
RUN npm ci

# ── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# Build shared package
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@school-erp/shared

# Copy API source and build
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production Runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl curl

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

# Copy manifests & install only production deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Generate Prisma Client in the runner environment
WORKDIR /app/apps/api
RUN npx prisma generate

# Ensure uploads directory exists with correct ownership
RUN mkdir -p /app/apps/api/uploads && chown -R nestjs:nodejs /app/apps/api

USER nestjs

EXPOSE 4000

# Health check for Docker / orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
