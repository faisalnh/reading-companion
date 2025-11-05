# syntax=docker/dockerfile:1.5

# Stage 1 – install all dependencies (dev + prod)
FROM node:20-alpine AS deps
RUN apk add --no-cache bash libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2 – build Next.js and generate Prisma client
FROM node:20-alpine AS builder
RUN apk add --no-cache bash libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema prisma/schema.prisma \
  && npm run build

# Stage 3 – runtime image
FROM node:20-alpine AS runner
RUN apk add --no-cache bash libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# Copy only the production artefacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh /app/

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p public/books public/covers public/badges \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000 \
    HOSTNAME=0.0.0.0
CMD ["/app/docker-entrypoint.sh"]
