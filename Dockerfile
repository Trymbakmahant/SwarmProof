# ── SwarmProof Multi-Stage Production Dockerfile ──────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# ── Dependencies Stage ───────────────────────────────────────────────────
FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/agents/package.json packages/agents/
COPY packages/consensus/package.json packages/consensus/
COPY packages/hedera/package.json packages/hedera/
COPY packages/mcp/package.json packages/mcp/
COPY packages/payments/package.json packages/payments/
COPY packages/plugins/package.json packages/plugins/
COPY packages/swarm/package.json packages/swarm/
COPY packages/verification/package.json packages/verification/
COPY packages/x402/package.json packages/x402/
COPY contracts/vulnerable/package.json contracts/vulnerable/
COPY tests/package.json tests/

RUN pnpm install --frozen-lockfile

# ── Builder Stage ────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter "@swarmproof/*" --filter "swarmproof-mcp" build

# ── Production Runner (API Gateway) ──────────────────────────────────────
FROM node:22-slim AS api-runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app ./
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# ── Production Runner (Next.js Web) ──────────────────────────────────────
FROM node:22-slim AS web-runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./
EXPOSE 3000
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web"]
