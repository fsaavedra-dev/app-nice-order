import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const db = new PrismaClient();

async function main() {
  try {
    const rootDui = process.env.INITIAL_ROOT_DUI || '00000000-0';
    const rootPassword = process.env.INITIAL_ROOT_PASSWORD || 'RootPass123!';
    const adminDui = process.env.INITIAL_ADMIN_DUI || '00000000-1';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPass123!';

    // 1. Garantizar roles obligatorios
    const roles = ['ROOT', 'ADMIN', 'USER'];
    for (const roleName of roles) {
      await db.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
    }

    // 2. Hash de contraseñas
    const rootHash = bcrypt.hashSync(rootPassword, 10);
    const adminHash = bcrypt.hashSync(adminPassword, 10);

    // 3. Crear o actualizar usuario ROOT
    await db.user.upsert({
      where: { dui: rootDui },
      update: {
        fullName: 'Super Admin Root',
        phone: '00000000',
        passwordHash: rootHash,
        roleName: 'ROOT',
      },
      create: {
        dui: rootDui,
        fullName: 'Super Admin Root',
        phone: '00000000',
        passwordHash: rootHash,
        roleName: 'ROOT',
      },
    });

    // 4. Crear o actualizar usuario ADMIN
    await db.user.upsert({
      where: { dui: adminDui },
      update: {
        fullName: 'Administrador Principal',
        phone: '70000000',
        passwordHash: adminHash,
        roleName: 'ADMIN',
      },
      create: {
        dui: adminDui,
        fullName: 'Administrador Principal',
        phone: '70000000',
        passwordHash: adminHash,
        roleName: 'ADMIN',
      },
    });

    console.log('✅ Seed ejecutado con éxito.');
  } catch (error: any) {
    console.error('\n❌ DETALLE DEL ERROR DE SEED:');
    console.error(error.message || error);
  }
}

main().finally(async () => {
  await db.$disconnect();
});