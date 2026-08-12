# --- Stage 1: Base & Dependencies ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# --- Stage 2: Builder ---
FROM base AS builder
WORKDIR /app

# Copiar manifiestos de dependencias del monorepo
COPY package*.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
COPY packages/database/package*.json ./packages/database/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY apps/api/package*.json ./apps/api/

# Instalar todas las dependencias
RUN pnpm install

# Copiar el código fuente completo
COPY packages/database ./packages/database
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

# Generar cliente de Prisma y construir los paquetes
RUN pnpm --filter @nice-order/database generate
RUN pnpm --filter @nice-order/api build

# --- Stage 3: Runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiar el monorepo preparado
COPY --from=builder /app /app

EXPOSE 3000

# Comando de arranque del contenedor
CMD ["pnpm", "--filter", "@nice-order/api", "start"]