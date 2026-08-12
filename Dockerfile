FROM node:20-alpine

# 1. Instalar dependencias del sistema requeridas por Prisma en Alpine Linux
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# 2. Copiar el monorepo completo
COPY . .

# 3. Instalar dependencias
RUN npm install

# 4. Generar el cliente de Prisma
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# 5. Compilar la API Express
RUN npm --prefix apps/api run build

ENV NODE_ENV=production
EXPOSE 3000

# 6. Iniciar la API
CMD ["npm", "--prefix", "apps/api", "start"]