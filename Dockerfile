# TriVE $0 High-Performance Standalone Container
# Compatible with Hugging Face Spaces (16GB Free Tier, Always-On), Render, Koyeb, Railway

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl bash git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json* bun.lock* ./
RUN npm install --no-audit --no-fund

FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN npx prisma@6 generate
RUN npx next build --webpack

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/db/custom.db"

# The official node:20-bookworm-slim image already contains user 'node' with UID 1000 (which Hugging Face Spaces expects)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node start.sh ./start.sh

RUN chmod +x ./start.sh && mkdir -p /app/db /app/data && chown -R node:node /app

USER node

EXPOSE 7860

CMD ["./start.sh"]
