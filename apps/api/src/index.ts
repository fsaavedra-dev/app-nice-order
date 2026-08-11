import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { db, OrderStatus, LoanStatus } from '@nice-order/database';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const resolveActorId = async (providedActorId?: string): Promise<string | null> => {
  if (providedActorId && providedActorId !== 'undefined') return providedActorId;
  const rootUser = await db.user.findFirst({ where: { roleName: 'ROOT', deletedAt: null } });
  return rootUser ? rootUser.id : null;
};

const logActivity = async (actorId: string | undefined, action: string, details?: string) => {
  try {
    const finalUserId = await resolveActorId(actorId);
    if (!finalUserId) return null;
    return await db.auditLog.create({ data: { userId: finalUserId, action, details } });
  } catch (err) {
    console.error('Error al insertar en AuditLog:', err);
    return null;
  }
};

const getDistributionConfig = async () => {
  let config = await db.financialDistributionConfig.findFirst();
  if (!config) {
    config = await db.financialDistributionConfig.create({
      data: { companyPct: 50.00, payrollPct: 30.00, shareholdersPct: 20.00 },
    });
  }
  return config;
};

// Helper de cálculo de rango de fechas por código de periodo
const getPeriodDateRange = (year: number, periodCode: string) => {
  let startDate = new Date(year, 0, 1, 0, 0, 0);
  let endDate = new Date(year, 11, 31, 23, 59, 59);

  if (periodCode.startsWith('M')) {
    const month = parseInt(periodCode.replace('M', ''), 10) - 1;
    startDate = new Date(year, month, 1, 0, 0, 0);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else if (periodCode.startsWith('Q')) {
    const quarter = parseInt(periodCode.replace('Q', ''), 10);
    const startMonth = (quarter - 1) * 3;
    startDate = new Date(year, startMonth, 1, 0, 0, 0);
    endDate = new Date(year, startMonth + 3, 0, 23, 59, 59);
  } else if (periodCode.startsWith('H')) {
    const half = parseInt(periodCode.replace('H', ''), 10);
    const startMonth = (half - 1) * 6;
    startDate = new Date(year, startMonth, 1, 0, 0, 0);
    endDate = new Date(year, startMonth + 6, 0, 23, 59, 59);
  }

  return { startDate, endDate };
};

// ==========================================
// MÓDULO DE ENTREGABLES Y REPORTES FISCALES
// ==========================================

// 1. Calcular o Consultar Cierre de Periodo
app.get('/admin/reports/calculate', async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
  const periodCode = (req.query.periodCode as string) || 'Q1';
  const fullPeriodCode = `${year}-${periodCode}`;

  try {
    // Si el periodo ya fue cerrado, retornar la captura inmutable
    const existingSnapshot = await db.financialPeriod.findUnique({ where: { periodCode: fullPeriodCode } });
    if (existingSnapshot) {
      return res.json({ isClosed: true, snapshot: existingSnapshot });
    }

    const { startDate, endDate } = getPeriodDateRange(year, periodCode);
    const config = await getDistributionConfig();

    // Consultar pedidos entregados en la ventana de tiempo
    const orders = await db.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'CONFIRMED'] },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { items: { include: { product: true } } },
    });

    const totalSales = orders.reduce((acc, o) => acc + Number(o.total), 0);
    
    // COGS (Cost of Goods Sold / Costo de Ventas Directo)
    let cogs = 0;
    orders.forEach((o) => {
      o.items.forEach((item) => {
        cogs += Number(item.product.costPrice) * item.quantity;
      });
    });

    const grossProfit = totalSales - cogs;

    const injections = await db.capitalInjection.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });
    const capitalInjections = injections.reduce((acc, i) => acc + Number(i.amount), 0);

    const payments = await db.loanPayment.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });
    const debtPayments = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    const netGrossCash = (totalSales + capitalInjections) - debtPayments;

    const companyVault = netGrossCash * (Number(config.companyPct) / 100);
    const payrollVault = netGrossCash * (Number(config.payrollPct) / 100);
    const shareholdersVault = netGrossCash * (Number(config.shareholdersPct) / 100);

    return res.json({
      isClosed: false,
      calculated: {
        periodCode: fullPeriodCode,
        year,
        periodType: periodCode.startsWith('M') ? 'MONTHLY' : periodCode.startsWith('Q') ? 'QUARTERLY' : periodCode.startsWith('H') ? 'SEMIANNUAL' : 'ANNUAL',
        startDate,
        endDate,
        totalSales,
        cogs,
        grossProfit,
        capitalInjections,
        debtPayments,
        netGrossCash,
        companyVault,
        payrollVault,
        shareholdersVault,
        config: {
          companyPct: Number(config.companyPct),
          payrollPct: Number(config.payrollPct),
          shareholdersPct: Number(config.shareholdersPct),
        },
      },
    });
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

// 2. Congelar y Cerrar Periodo Fiscal (Snapshot Inmutable)
app.post('/admin/reports/close-period', async (req: Request, res: Response) => {
  const { year, periodCode, requesterId } = req.body;
  if (!year || !periodCode || !requesterId) return res.status(400).json({ error: 'Parámetros incompletos.' });

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) {
      return res.status(403).json({ error: 'Operación denegada. Solo ROOT puede realizar cierres contables.' });
    }

    const fullPeriodCode = `${year}-${periodCode}`;
    const existing = await db.financialPeriod.findUnique({ where: { periodCode: fullPeriodCode } });
    if (existing) return res.status(400).json({ error: 'Este periodo fiscal ya se encuentra cerrado e inmutable.' });

    const { startDate, endDate } = getPeriodDateRange(Number(year), periodCode);
    const config = await getDistributionConfig();

    const orders = await db.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'CONFIRMED'] },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { items: { include: { product: true } } },
    });

    const totalSales = orders.reduce((acc, o) => acc + Number(o.total), 0);
    let cogs = 0;
    orders.forEach((o) => {
      o.items.forEach((item) => { cogs += Number(item.product.costPrice) * item.quantity; });
    });
    const grossProfit = totalSales - cogs;

    const injections = await db.capitalInjection.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });
    const capitalInjections = injections.reduce((acc, i) => acc + Number(i.amount), 0);

    const payments = await db.loanPayment.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });
    const debtPayments = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    const netGrossCash = (totalSales + capitalInjections) - debtPayments;

    const companyVault = netGrossCash * (Number(config.companyPct) / 100);
    const payrollVault = netGrossCash * (Number(config.payrollPct) / 100);
    const shareholdersVault = netGrossCash * (Number(config.shareholdersPct) / 100);

    const periodType = periodCode.startsWith('M') ? 'MONTHLY' : periodCode.startsWith('Q') ? 'QUARTERLY' : periodCode.startsWith('H') ? 'SEMIANNUAL' : 'ANNUAL';

    const periodSnapshot = await db.financialPeriod.create({
      data: {
        periodCode: fullPeriodCode,
        year: Number(year),
        periodType,
        startDate,
        endDate,
        totalSales,
        cogs,
        grossProfit,
        capitalInjections,
        debtPayments,
        netGrossCash,
        companyVault,
        payrollVault,
        shareholdersVault,
        isClosed: true,
        closedByUserId: requesterId,
      },
    });

    await logActivity(
      requesterId,
      'CLOSE_FINANCIAL_PERIOD',
      `CIERRE FISCAL CONGELADO: Periodo ${fullPeriodCode} ($${totalSales.toFixed(2)} ventas, $${grossProfit.toFixed(2)} margen bruto)`
    );

    return res.status(201).json(periodSnapshot);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

// 3. Exportar Libro Contable a formato CSV para Excel
app.get('/admin/reports/export/csv', async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
  const periodCode = (req.query.periodCode as string) || 'Q1';
  const { startDate, endDate } = getPeriodDateRange(year, periodCode);

  try {
    const orders = await db.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'CONFIRMED'] },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { user: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Encabezados CSV compatibles con Excel
    let csv = 'ID Pedido,Fecha,Cliente,DUI,Producto,Cantidad,Costo Unitario ($),Precio Venta ($),Subtotal Venta ($),Ganancia Bruta ($)\n';

    orders.forEach((o) => {
      const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
      o.items.forEach((item) => {
        const cost = Number(item.product.costPrice);
        const price = Number(item.price);
        const subtotal = price * item.quantity;
        const profit = (price - cost) * item.quantity;

        csv += `"${o.id.slice(0, 8)}","${dateStr}","${o.user.fullName}","${o.user.dui}","${item.product.title}",${item.quantity},${cost.toFixed(2)},${price.toFixed(2)},${subtotal.toFixed(2)},${profit.toFixed(2)}\n`;
      });
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Contable_${year}-${periodCode}.csv`);
    return res.status(200).send(csv);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

// ==========================================
// MÓDULO DE PRÉSTAMOS
// ==========================================

app.get('/admin/lenders', async (_req: Request, res: Response) => {
  try {
    const lenders = await db.lender.findMany({ include: { _count: { select: { loans: true } } }, orderBy: { name: 'asc' } });
    return res.json(lenders);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/admin/lenders', async (req: Request, res: Response) => {
  const { name, contactInfo, actorId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre del prestamista requerido.' });
  try {
    const lender = await db.lender.create({ data: { name: name.trim(), contactInfo: contactInfo?.trim() || null } });
    await logActivity(actorId, 'CREATE_LENDER', `Prestamista registrado: '${lender.name}'`);
    return res.status(201).json(lender);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.get('/admin/loans', async (_req: Request, res: Response) => {
  try {
    const loans = await db.loan.findMany({ include: { lender: true, payments: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    return res.json(loans);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/admin/loans', async (req: Request, res: Response) => {
  const { lenderId, principal, interestRate, notes, actorId } = req.body;
  if (!lenderId || !principal || Number(principal) <= 0) return res.status(400).json({ error: 'Monto y prestamista válidos obligatorios.' });

  try {
    const numPrincipal = Number(principal);
    const loan = await db.loan.create({
      data: { lenderId, principal: numPrincipal, remainingBal: numPrincipal, interestRate: Number(interestRate) || 0, notes: notes?.trim() || null },
      include: { lender: true },
    });
    await logActivity(actorId, 'CREATE_LOAN', `Préstamo registrado de $${numPrincipal}`);
    return res.status(201).json(loan);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.post('/admin/loans/:id/payments', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { amount, notes, actorId } = req.body;
  const payAmount = Number(amount);

  if (!payAmount || payAmount <= 0) return res.status(400).json({ error: 'Monto de pago inválido.' });

  try {
    const updatedLoan = await db.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id }, include: { lender: true } });
      if (!loan) throw new Error('Préstamo no encontrado.');
      if (loan.status === LoanStatus.PAID) throw new Error('Préstamo saldado.');

      const currentBal = Number(loan.remainingBal);
      if (payAmount > currentBal) throw new Error(`Abono excede el saldo pendiente.`);

      const newBal = currentBal - payAmount;
      await tx.loanPayment.create({ data: { loanId: id, amount: payAmount, notes: notes?.trim() || null, actorId } });

      return await tx.loan.update({
        where: { id },
        data: { remainingBal: newBal, status: newBal === 0 ? LoanStatus.PAID : LoanStatus.ACTIVE },
        include: { lender: true, payments: true },
      });
    });

    await logActivity(actorId, 'LOAN_PAYMENT', `Abono de $${payAmount} a ${updatedLoan.lender.name}`);
    return res.status(201).json(updatedLoan);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

// ==========================================
// INVENTARIO Y CATEGORÍAS
// ==========================================

app.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await db.product.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    return res.json(products);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/products', async (req: Request, res: Response) => {
  const { title, description, totalCost, price, stock, categoryId, actorId } = req.body;
  const numStock = Number(stock) || 1;
  const numTotalCost = Number(totalCost) || 0;
  const numPrice = Number(price) || 0;
  const calculatedCostPrice = numStock > 0 ? numTotalCost / numStock : 0;

  try {
    const product = await db.product.create({
      data: {
        title, description, totalCost: numTotalCost, costPrice: calculatedCostPrice,
        price: numPrice, stock: numStock, categoryId: categoryId || null,
      },
    });

    await logActivity(actorId, 'CREATE_PRODUCT', `Producto registrado: '${title}'`);
    return res.status(201).json(product);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.put('/products/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { title, description, totalCost, price, stock, categoryId, actorId } = req.body;
  const numStock = Number(stock) || 1;
  const numTotalCost = Number(totalCost) || 0;
  const numPrice = Number(price) || 0;
  const calculatedCostPrice = numStock > 0 ? numTotalCost / numStock : 0;

  try {
    const product = await db.product.update({
      where: { id },
      data: {
        title, description, totalCost: numTotalCost, costPrice: calculatedCostPrice,
        price: numPrice, stock: numStock, categoryId: categoryId || null,
      },
    });

    await logActivity(actorId, 'UPDATE_PRODUCT', `Producto '${title}' actualizado.`);
    return res.json(product);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.patch('/products/:id/stock', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { stock, actorId } = req.body;
  try {
    const product = await db.product.update({ where: { id }, data: { stock: Number(stock) } });
    await logActivity(actorId, 'UPDATE_STOCK', `Stock de '${product.title}' a ${stock}`);
    return res.json(product);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await db.category.findMany({ include: { _count: { select: { products: true } } } });
    return res.json(categories);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/categories', async (req: Request, res: Response) => {
  const { name, actorId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre de categoría requerido.' });
  try {
    const category = await db.category.create({ data: { name: name.trim() } });
    await logActivity(actorId, 'CREATE_CATEGORY', `Categoría creada: '${name.trim()}'`);
    return res.status(201).json(category);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

// ==========================================
// FINANZAS GLOBALES
// ==========================================

app.get('/admin/analytics', async (_req: Request, res: Response) => {
  try {
    const config = await getDistributionConfig();

    const completedOrders = await db.order.findMany({
      where: { status: { in: ['DELIVERED', 'CONFIRMED'] } },
      include: { items: { include: { product: { include: { category: true } } } } },
    });
    const totalSalesRevenue = completedOrders.reduce((acc, order) => acc + Number(order.total), 0);

    const injections = await db.capitalInjection.findMany();
    const totalCapitalInjected = injections.reduce((acc, inj) => acc + Number(inj.amount), 0);

    const loanPayments = await db.loanPayment.findMany();
    const totalDebtPaid = loanPayments.reduce((acc, p) => acc + Number(p.amount), 0);

    const netGrossCash = (totalSalesRevenue + totalCapitalInjected) - totalDebtPaid;

    const companyVault = netGrossCash * (Number(config.companyPct) / 100);
    const payrollVault = netGrossCash * (Number(config.payrollPct) / 100);
    const shareholdersVault = netGrossCash * (Number(config.shareholdersPct) / 100);

    const activeProducts = await db.product.findMany({ where: { isActive: true } });
    const inventoryValuation = activeProducts.reduce((acc, p) => acc + (Number(p.price) * p.stock), 0);
    const totalStockItems = activeProducts.reduce((acc, p) => acc + p.stock, 0);

    const activeLoans = await db.loan.findMany();
    const totalDebt = activeLoans.reduce((acc, l) => acc + Number(l.remainingBal), 0);

    const categorySalesMap: Record<string, number> = {};
    const productSalesMap: Record<string, { title: string; units: number; revenue: number }> = {};

    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const catName = item.product.category?.name || 'Sin Categoría';
        const itemRevenue = Number(item.price) * item.quantity;

        categorySalesMap[catName] = (categorySalesMap[catName] || 0) + itemRevenue;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = { title: item.product.title, units: 0, revenue: 0 };
        }
        productSalesMap[item.productId].units += item.quantity;
        productSalesMap[item.productId].revenue += itemRevenue;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return res.json({
      summary: {
        totalSalesRevenue,
        totalCapitalInjected,
        netGrossCash,
        inventoryValuation,
        totalStockItems,
        totalDebt,
      },
      vaults: {
        companyVault,
        payrollVault,
        shareholdersVault,
        config: {
          companyPct: Number(config.companyPct),
          payrollPct: Number(config.payrollPct),
          shareholdersPct: Number(config.shareholdersPct),
        },
      },
      categorySales: Object.entries(categorySalesMap).map(([name, total]) => ({ name, total })),
      topProducts,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/admin/capital-injections', async (_req: Request, res: Response) => {
  try {
    const injections = await db.capitalInjection.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(injections);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/admin/capital-injections', async (req: Request, res: Response) => {
  const { amount, notes, actorId } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Monto de inyección inválido.' });

  try {
    const resolvedActorId = (await resolveActorId(actorId)) || 'SYSTEM';
    const injection = await db.capitalInjection.create({
      data: { amount: numAmount, notes: notes?.trim() || null, actorId: resolvedActorId },
    });

    await logActivity(resolvedActorId, 'CAPITAL_INJECTION', `Aporte de capital personal por $${numAmount}`);
    return res.status(201).json(injection);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.get('/admin/financial-config', async (_req: Request, res: Response) => {
  try {
    const config = await getDistributionConfig();
    return res.json(config);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.patch('/admin/financial-config', async (req: Request, res: Response) => {
  const { companyPct, payrollPct, shareholdersPct, actorId } = req.body;
  const cPct = Number(companyPct);
  const pPct = Number(payrollPct);
  const sPct = Number(shareholdersPct);

  if ((cPct + pPct + sPct) !== 100) return res.status(400).json({ error: 'La suma de porcentajes debe ser 100%.' });

  try {
    const currentConfig = await getDistributionConfig();
    const updated = await db.financialDistributionConfig.update({
      where: { id: currentConfig.id },
      data: { companyPct: cPct, payrollPct: pPct, shareholdersPct: sPct },
    });

    await logActivity(actorId, 'UPDATE_FINANCIAL_CONFIG', `Reglas de reparto actualizadas`);
    return res.json(updated);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

// ==========================================
// AUTENTICACIÓN Y USUARIOS
// ==========================================

app.post('/users/register', async (req: Request, res: Response) => {
  const { dui, fullName, phone, password } = req.body;
  if (!dui || !fullName || !phone || !password) return res.status(400).json({ error: 'Campos obligatorios.' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db.user.create({ data: { dui: dui.trim(), fullName: fullName.trim(), phone: phone.trim(), passwordHash, roleName: 'CUSTOMER' } });
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.post('/users/login', async (req: Request, res: Response) => {
  const { dui, password } = req.body;
  try {
    const user = await db.user.findFirst({ where: { dui: dui.trim(), deletedAt: null }, include: { role: true } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Credenciales inválidas.' });
    const { passwordHash: _, ...userWithoutPassword } = user;
    return res.json({ ...userWithoutPassword, role: user.roleName });
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/admin/login', async (req: Request, res: Response) => {
  const { dui, password } = req.body;
  try {
    const user = await db.user.findFirst({ where: { dui: dui.trim(), deletedAt: null }, include: { role: true } });
    if (!user || user.roleName === 'CUSTOMER') return res.status(403).json({ error: 'Acceso denegado.' });
    if (user.isBlacklisted) return res.status(403).json({ error: 'Cuenta suspendida.' });
    if (!(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    await logActivity(user.id, 'ADMIN_LOGIN', 'Inicio de sesión en panel');
    const { passwordHash: _, ...adminUserData } = user;
    return res.json({ ...adminUserData, role: user.roleName });
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.get('/admin/roles', async (_req: Request, res: Response) => {
  try {
    const roles = await db.role.findMany({ include: { _count: { select: { users: { where: { deletedAt: null } } } }, permissions: true }, orderBy: { createdAt: 'asc' } });
    return res.json(roles);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/admin/roles', async (req: Request, res: Response) => {
  const { requesterId, name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre de rol requerido.' });

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });

    const formattedName = name.trim().toUpperCase();
    const newRole = await db.role.create({
      data: { name: formattedName, description: description?.trim() || null, permissions: { create: { canManageOrders: true, canCreateProduct: false, canEditProduct: false, canUpdateStock: true, canManageCategories: false, canManageBlacklist: false } } },
      include: { permissions: true },
    });

    await logActivity(requesterId, 'CREATE_ROLE', `Rol creado: '${formattedName}'`);
    return res.status(201).json(newRole);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.delete('/admin/roles/:name', async (req: Request<{ name: string }>, res: Response) => {
  const { name } = req.params;
  const { requesterId } = req.body;

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });

    const targetRole = await db.role.findUnique({ where: { name }, include: { _count: { select: { users: { where: { deletedAt: null } } } } } });
    if (!targetRole) return res.status(404).json({ error: 'Rol no encontrado.' });
    if (targetRole.isSystem) return res.status(400).json({ error: 'No se pueden eliminar roles del sistema.' });
    if (targetRole._count.users > 0) return res.status(400).json({ error: `Hay ${targetRole._count.users} usuario(s) activos en este rol.` });

    await db.role.delete({ where: { name } });
    await logActivity(requesterId, 'DELETE_ROLE', `Rol eliminado: '${name}'`);
    return res.json({ message: `Rol ${name} eliminado.` });
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.get('/admin/staff-users', async (_req: Request, res: Response) => {
  try {
    const users = await db.user.findMany({ where: { roleName: { not: 'CUSTOMER' }, deletedAt: null }, select: { id: true, dui: true, fullName: true, phone: true, roleName: true, isBlacklisted: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    return res.json(users);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.post('/admin/users', async (req: Request, res: Response) => {
  const { requesterId, dui, fullName, phone, password, role } = req.body;
  if (!requesterId || !dui || !fullName || !phone || !password || !role) return res.status(400).json({ error: 'Campos requeridos.' });

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db.user.create({ data: { dui: dui.trim(), fullName: fullName.trim(), phone: phone.trim(), passwordHash, roleName: role } });
    await logActivity(requesterId, 'CREATE_STAFF_USER', `Usuario ${role} creado: ${fullName.trim()}`);
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.put('/admin/users/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { requesterId, fullName, phone, newPassword } = req.body;
  if (!requesterId || !fullName || !phone) return res.status(400).json({ error: 'Faltan datos obligatorios.' });

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });

    const updateData: any = { fullName: fullName.trim(), phone: phone.trim() };
    if (newPassword && newPassword.trim().length >= 6) updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);

    const updatedUser = await db.user.update({ where: { id }, data: updateData });
    await logActivity(requesterId, 'UPDATE_USER_DATA', `Datos actualizados para ${updatedUser.fullName}`);
    const { passwordHash: _, ...result } = updatedUser;
    return res.json(result);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.patch('/admin/users/:id/role', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { requesterId, newRoleName } = req.body;

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });

    const updatedUser = await db.user.update({ where: { id }, data: { roleName: newRoleName } });
    await logActivity(requesterId, 'UPDATE_USER_ROLE', `Rol cambiado a ${newRoleName}`);
    const { passwordHash: _, ...result } = updatedUser;
    return res.json(result);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.delete('/admin/users/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { requesterId, confirmDui, confirmPassword } = req.body;

  if (!requesterId || !confirmDui || !confirmPassword) return res.status(400).json({ error: 'Se requiere validación completa.' });

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });
    if (id === requesterId) return res.status(400).json({ error: 'No puedes darte de baja a ti mismo.' });

    const targetUser = await db.user.findFirst({ where: { id, deletedAt: null } });
    if (!targetUser) return res.status(404).json({ error: 'Usuario activo no encontrado.' });
    if (targetUser.dui.trim() !== confirmDui.trim()) return res.status(400).json({ error: 'El DUI no coincide.' });

    const isPasswordValid = await bcrypt.compare(confirmPassword, targetUser.passwordHash);
    if (!isPasswordValid) return res.status(401).json({ error: 'Contraseña de confirmación incorrecta.' });

    await db.user.update({ where: { id }, data: { deletedAt: new Date() } });
    await logActivity(requesterId, 'SOFT_DELETE_STAFF_USER', `Usuario ${targetUser.fullName} dado de baja.`);
    return res.json({ message: 'Usuario dado de baja exitosamente.' });
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.get('/admin/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await db.auditLog.findMany({ include: { user: { select: { fullName: true, dui: true, roleName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(logs);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.get('/admin/permissions', async (_req: Request, res: Response) => {
  try {
    const permissions = await db.rolePermission.findMany();
    return res.json(permissions);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.patch('/admin/permissions/:role', async (req: Request<{ role: string }>, res: Response) => {
  const { role } = req.params;
  const { requesterId, ...permissionsData } = req.body;

  try {
    const requester = await db.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.roleName !== 'ROOT' || requester.deletedAt) return res.status(403).json({ error: 'Exclusivo para ROOT.' });

    const updatedPermissions = await db.rolePermission.upsert({
      where: { roleName: role },
      update: permissionsData,
      create: { roleName: role, ...permissionsData },
    });

    await logActivity(requesterId, 'CHANGE_PERMISSIONS', `Permisos modificados para ${role}`);
    return res.json(updatedPermissions);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.get('/orders/admin', async (_req: Request, res: Response) => {
  try {
    const orders = await db.order.findMany({ include: { user: true, items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } });
    return res.json(orders);
  } catch (error: any) { return res.status(500).json({ error: error.message }); }
});

app.patch('/orders/:id/status', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { status, actorId } = req.body;
  try {
    const updatedOrder = await db.order.update({ where: { id }, data: { status } });
    await logActivity(actorId, 'UPDATE_ORDER_STATUS', `Pedido #${id.slice(0, 8)} estado: ${status}`);
    return res.json(updatedOrder);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.patch('/users/:id/blacklist', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { isBlacklisted, actorId } = req.body;
  try {
    const user = await db.user.update({ where: { id }, data: { isBlacklisted: Boolean(isBlacklisted) } });
    await logActivity(actorId, 'TOGGLE_BLACKLIST', `Usuario ${user.fullName} ${isBlacklisted ? 'bloqueado' : 'desbloqueado'}`);
    return res.json(user);
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
});

app.listen(PORT, () => {
  console.log(`🚀 API en ejecución en http://localhost:${PORT}`);
});