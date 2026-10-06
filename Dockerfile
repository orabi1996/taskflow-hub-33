# ==============================================================================
# CRM-X Enterprise — Multi-Stage Production Dockerfile
# People · Pipelines · Possibilities
# ==============================================================================

# --- Stage 1: Build & Bundle ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install native dependencies required for build
RUN apk add --no-cache libc6-compat

# Copy dependency manifests
COPY package.json package-lock.json ./

# Clean install with lockfile
RUN npm ci

# Copy application source code
COPY . .

# Set environment and build bundle
ENV NODE_ENV=production
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Security: Add non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 crmx

# Copy built artifacts and dependencies from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/.output ./.output 2>/dev/null || true

# Set appropriate directory permissions
RUN chown -R crmx:nodejs /app

USER crmx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8080"]
