FROM node:20-alpine

# Activar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 1. Copiar todo el monorepo
COPY . .

# 2. Instalar dependencias completas del monorepo
RUN pnpm install

# 3. Generar cliente de Prisma
RUN pnpm --filter @nice-order/database generate

# 4. Compilar la API Express
RUN pnpm --filter @nice-order/api build

ENV NODE_ENV=production
EXPOSE 3000

# 5. Iniciar la API
CMD ["pnpm", "--filter", "@nice-order/api", "start"]