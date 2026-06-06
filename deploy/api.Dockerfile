# Shopio API — per `38-deployment-guide.md` single-server Docker stage.
#
# Runtime uses tsx because workspace packages (@shopio/db, @shopio/authz)
# export TypeScript sources (main: src/index.ts). A dist-only slim image is a
# later optimization (requires conditional exports across packages).
#
# Build context: repository root.
#   docker build -f deploy/api.Dockerfile -t shopio-api .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Manifests first — dependency layer caches across source changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/authz/package.json packages/authz/

# @shopio/api + its workspace dependency tree (dev deps included — tsx, drizzle-kit)
RUN pnpm install --frozen-lockfile --filter @shopio/api...

# Sources
COPY packages/db packages/db
COPY packages/authz packages/authz
COPY apps/api apps/api

ENV NODE_ENV=production
EXPOSE 4040

# Migrations run first (idempotent; the custom runner installs the uuidv7()
# pre-migration before drizzle migrations), then the server. DATABASE_URL etc.
# come from the orchestrator environment.
CMD ["sh", "-c", "pnpm --filter @shopio/db migrate && pnpm --filter @shopio/api exec tsx src/index.ts"]
