# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN npm ci

# Copy and compile shared package
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@school-erp/shared

# Copy web application source and build
COPY apps/web ./apps/web
WORKDIR /app/apps/web

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ── Stage 2: Production Runner ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled shared package
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy web build artifacts and public assets
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
