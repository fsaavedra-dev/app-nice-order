import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Limpiando y poblando BD con Roles Dinámicos...');

  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.auditLog.deleteMany();
  await db.rolePermission.deleteMany();
  await db.user.deleteMany();
  await db.role.deleteMany();

  // 1. Crear Entidades de Roles
  const roles = [
    { name: 'ROOT', description: 'Superadministrador de Sistemas', isSystem: true },
    { name: 'ADMIN', description: 'CEO / Dueña de la Tienda', isSystem: false },
    { name: 'STAFF', description: 'Personal de Ventas y Operaciones', isSystem: false },
    { name: 'CUSTOMER', description: 'Cliente Comprador', isSystem: true },
  ];

  for (const r of roles) {
    await db.role.create({ data: r });
  }

  // 2. Permisos por Defecto
  await db.rolePermission.create({
    data: {
      roleName: 'ADMIN',
      canManageOrders: true, canCreateProduct: true, canEditProduct: true,
      canUpdateStock: true, canManageCategories: true, canManageBlacklist: true, canCancelOrders: true,
    },
  });

  await db.rolePermission.create({
    data: {
      roleName: 'STAFF',
      canManageOrders: true, canCreateProduct: false, canEditProduct: false,
      canUpdateStock: true, canManageCategories: false, canManageBlacklist: false, canCancelOrders: false,
    },
  });

  // 3. Crear Usuarios Iniciales
  const passwordHash = bcrypt.hashSync('123456', 10);

  await db.user.create({
    data: { dui: '00000000-0', fullName: 'Sistemas (Root SysAdmin)', phone: '+50370000000', passwordHash, roleName: 'ROOT' },
  });

  await db.user.create({
    data: { dui: '00000000-1', fullName: 'CEO / Dueña de Tienda', phone: '+50370000001', passwordHash, roleName: 'ADMIN' },
  });

  await db.user.create({
    data: { dui: '00000000-2', fullName: 'Vendedor Tienda', phone: '+50370000002', passwordHash, roleName: 'STAFF' },
  });

  // 4. Categoría y Producto Base
  const cat = await db.category.create({ data: { name: 'Ropa y Calzado' } });
  await db.product.create({
    data: { title: 'Polerón Oversize Negro', description: 'Algodón 100%', price: 24.99, stock: 5, categoryId: cat.id },
  });

  console.log('✅ Base de datos re-poblada con éxito.');
}

main().catch(console.error).finally(() => db.$disconnect());