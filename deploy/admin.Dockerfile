# Shopio Admin (Vite SPA → nginx) — per `38-deployment-guide.md`.
# Build context: repository root.
#   docker build -f deploy/admin.Dockerfile -t shopio-admin .

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/authz/package.json packages/authz/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @shopio/admin...

COPY packages/authz packages/authz
COPY packages/ui packages/ui
COPY apps/admin apps/admin

# API base is baked into the bundle (VITE_*)
ARG VITE_SHOPIO_API_URL=http://localhost:4040
ENV VITE_SHOPIO_API_URL=$VITE_SHOPIO_API_URL
RUN pnpm --filter @shopio/admin build

# ---- Runtime ----------------------------------------------------------------
FROM nginx:1.27-alpine AS runner
COPY deploy/admin-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
