import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const db = new PrismaClient();

async function main() {
  // Cargar credenciales desde variables de entorno con fallback seguro
  const rootDui = process.env.INITIAL_ROOT_DUI || '00000000-0';
  const rootPassword = process.env.INITIAL_ROOT_PASSWORD;
  const adminDui = process.env.INITIAL_ADMIN_DUI || '00000000-1';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!rootPassword || !adminPassword) {
    throw new Error(
      '❌ ERROR DE SEGURIDAD: Debes definir INITIAL_ROOT_PASSWORD e INITIAL_ADMIN_PASSWORD en tu archivo .env antes de ejecutar el seed.'
    );
  }

  // Hasheo dinámico de contraseñas de entorno
  const rootHash = bcrypt.hashSync(rootPassword, 10);
  const adminHash = bcrypt.hashSync(adminPassword, 10);

  // Crear usuario ROOT
  await db.user.create({
    data: {
      dui: rootDui,
      fullName: 'Sistemas (Root SysAdmin)',
      phone: process.env.INITIAL_ROOT_PHONE || '+50370000000',
      passwordHash: rootHash,
      roleName: 'ROOT',
    },
  });

  // Crear usuario ADMIN
  await db.user.create({
    data: {
      dui: adminDui,
      fullName: 'CEO / Dueña de Tienda',
      phone: process.env.INITIAL_ADMIN_PHONE || '+50370000001',
      passwordHash: adminHash,
      roleName: 'ADMIN',
    },
  });

  console.log('✅ Base de datos poblada de forma segura.');
}

main().catch(console.error).finally(() => db.$disconnect());