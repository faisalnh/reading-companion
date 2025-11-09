# Reading Buddy - Production Dockerfile
FROM node:20-alpine AS base

# Install dependencies for native modules (canvas, pdf2pic)
RUN apk add --no-cache \
    libc6-compat \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    python3 \
    make \
    g++

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root package.json first
COPY package*.json ./
# Copy web package.json
COPY web/package*.json ./web/

# Install dependencies
WORKDIR /app/web
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY web ./web

# Copy root files
COPY package*.json ./

WORKDIR /app/web

# Set environment variables for build
# Next.js collects anonymous telemetry data - disable it
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/web/public ./web/public

# Set the correct permission for prerender cache
RUN mkdir -p ./web/.next
RUN chown nextjs:nodejs ./web/.next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static

# Copy scripts for background jobs (PDF rendering)
COPY --from=builder --chown=nextjs:nodejs /app/web/scripts ./web/scripts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "web/server.js"]
