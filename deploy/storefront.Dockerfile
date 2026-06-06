# Shopio Storefront (Next.js standalone) — per `38-deployment-guide.md`.
# Build context: repository root.
#   docker build -f deploy/storefront.Dockerfile -t shopio-storefront .

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/storefront/package.json apps/storefront/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @shopio/storefront...

COPY packages/ui packages/ui
COPY apps/storefront apps/storefront

# Browser-visible API base is baked at build time (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_SHOPIO_API_URL=http://localhost:4040
ENV NEXT_PUBLIC_SHOPIO_API_URL=$NEXT_PUBLIC_SHOPIO_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @shopio/storefront build

# ---- Runtime (standalone output is self-contained) --------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/storefront/.next/standalone ./
COPY --from=builder /app/apps/storefront/.next/static ./apps/storefront/.next/static
# (no public/ dir yet — add a COPY when static assets land)

EXPOSE 3030
ENV PORT=3030
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/storefront/server.js"]
