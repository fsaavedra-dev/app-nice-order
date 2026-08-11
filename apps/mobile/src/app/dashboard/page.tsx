'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderStatus, formatUSD } from '@nice-order/shared-types';

interface Category { id: string; name: string; }
interface Product {
  id: string;
  title: string;
  description?: string;
  totalCost: number;
  costPrice: number;
  price: number;
  stock: number;
  imageUrl?: string;
  categoryId?: string;
}
interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  user: { id: string; dui: string; fullName: string; phone: string; isBlacklisted: boolean };
  items: { id: string; quantity: number; price: number; product: { title: string } }[];
}

interface Lender { id: string; name: string; contactInfo?: string; _count?: { loans: number }; }
interface LoanPayment { id: string; amount: number; notes?: string; createdAt: string; }
interface Loan {
  id: string;
  principal: number;
  remainingBal: number;
  interestRate: number;
  status: 'ACTIVE' | 'PAID' | 'DEFAULTED';
  notes?: string;
  lender: Lender;
  payments: LoanPayment[];
  createdAt: string;
}

interface AnalyticsData {
  summary: {
    totalSalesRevenue: number;
    totalCapitalInjected: number;
    netGrossCash: number;
    inventoryValuation: number;
    totalStockItems: number;
    totalDebt: number;
  };
  vaults: {
    companyVault: number;
    payrollVault: number;
    shareholdersVault: number;
    config: {
      companyPct: number;
      payrollPct: number;
      shareholdersPct: number;
    };
  };
  categorySales: { name: string; total: number }[];
  topProducts: { title: string; units: number; revenue: number }[];
}

interface FinancialReportData {
  isClosed: boolean;
  snapshot?: any;
  calculated?: any;
}

interface StaffUser {
  id: string;
  dui: string;
  fullName: string;
  phone: string;
  roleName: string;
  isBlacklisted: boolean;
  createdAt: string;
}

interface DynamicRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  _count?: { users: number };
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { fullName: string; dui: string; roleName?: string };
}

interface RolePermission {
  id?: string;
  roleName: string;
  canManageOrders: boolean;
  canCreateProduct: boolean;
  canEditProduct: boolean;
  canUpdateStock: boolean;
  canManageCategories: boolean;
  canManageBlacklist: boolean;
  canCancelOrders: boolean;
}

const DEFAULT_PERMISSIONS: Record<string, RolePermission> = {
  ADMIN: { roleName: 'ADMIN', canManageOrders: true, canCreateProduct: true, canEditProduct: true, canUpdateStock: true, canManageCategories: true, canManageBlacklist: true, canCancelOrders: true },
  STAFF: { roleName: 'STAFF', canManageOrders: true, canCreateProduct: false, canEditProduct: false, canUpdateStock: true, canManageCategories: false, canManageBlacklist: false, canCancelOrders: false },
};

export default function DashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'categories' | 'permissions' | 'logs' | 'finances' | 'loans' | 'reports'>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [rolesList, setRolesList] = useState<DynamicRole[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, RolePermission>>(DEFAULT_PERMISSIONS);

  // Estados Módulo de Reportes
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedPeriodCode, setSelectedPeriodCode] = useState<string>('Q1');
  const [reportData, setReportData] = useState<FinancialReportData | null>(null);

  // Formulario Producto con Costeo por Lote e Imagen
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Edición Producto
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTotalCost, setEditTotalCost] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  // Formulario Inyección Capital
  const [injectionAmount, setInjectionAmount] = useState('');
  const [injectionNotes, setInjectionNotes] = useState('');

  // Formulario Regla de Reparto (%)
  const [companyPct, setCompanyPct] = useState('50');
  const [payrollPct, setPayrollPct] = useState('30');
  const [shareholdersPct, setShareholdersPct] = useState('20');
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Formulario Prestamista y Préstamo
  const [newLenderName, setNewLenderName] = useState('');
  const [newLenderContact, setNewLenderContact] = useState('');
  const [selectedLenderId, setSelectedLenderId] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanInterestRate, setLoanInterestRate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  // Modal Abono Préstamo
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Formulario Nuevo Rol
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Formulario Nuevo Usuario
  const [staffDui, setStaffDui] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('STAFF');

  // Modal Edición Usuario
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserNewPassword, setEditUserNewPassword] = useState('');

  // Modal Eliminación Desafío (Soft Delete)
  const [deletingUser, setDeletingUser] = useState<StaffUser | null>(null);
  const [confirmDuiInput, setConfirmDuiInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Formulario Categoría
  const [newCategoryName, setNewCategoryName] = useState('');

  // Cálculos dinámicos en tiempo real para el lote
  const parsedTotalCost = Number(totalCost) || 0;
  const parsedStock = Number(stock) || 0;
  const parsedPrice = Number(price) || 0;
  const computedUnitCost = parsedStock > 0 ? parsedTotalCost / parsedStock : 0;
  const computedUnitProfit = parsedPrice - computedUnitCost;
  const computedTotalBatchProfit = computedUnitProfit * parsedStock;

  const getActiveUser = () => {
    if (adminUser) return adminUser;
    const session = localStorage.getItem('nice_order_admin_session');
    return session ? JSON.parse(session) : null;
  };

  useEffect(() => {
    const user = getActiveUser();
    if (user) {
      setAdminUser(user);
      if (user.role === 'ROOT' || user.roleName === 'ROOT') {
        fetchPermissions();
        fetchLogs();
        fetchStaffUsers();
        fetchRoles();
      }
    } else {
      router.push('/login');
    }
    fetchOrders();
    fetchProducts();
    fetchCategories();
    fetchAnalytics();
    fetchLenders();
    fetchLoans();
    fetchReport();
  }, [router]);

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'nice_order_preset');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/nwjok751/image/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      return data.secure_url || null;
    } catch (err) {
      console.error('Error al subir imagen a Cloudinary:', err);
      return null;
    }
  };

  const fetchReport = async () => {
    try {
      const res = await fetch(`http://localhost:4000/admin/reports/calculate?year=${selectedYear}&periodCode=${selectedPeriodCode}`);
      if (res.ok) setReportData(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleClosePeriod = async () => {
    const currentUser = getActiveUser();
    if (currentUser?.roleName !== 'ROOT') return alert('Solo el usuario ROOT puede realizar cierres contables.');
    if (!confirm(`¿Estás seguro de CONGELAR el periodo ${selectedYear}-${selectedPeriodCode}?`)) return;

    try {
      const res = await fetch('http://localhost:4000/admin/reports/close-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, periodCode: selectedPeriodCode, requesterId: currentUser.id }),
      });

      if (res.ok) {
        alert('Periodo fiscal cerrado e inmutable.');
        fetchReport();
        fetchLogs();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al cerrar periodo.');
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const handleExportCSV = () => {
    window.open(`http://localhost:4000/admin/reports/export/csv?year=${selectedYear}&periodCode=${selectedPeriodCode}`, '_blank');
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const fetchLenders = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/lenders');
      if (res.ok) setLenders(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchLoans = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/loans');
      if (res.ok) setLoans(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/analytics');
      if (res.ok) {
        const data: AnalyticsData = await res.json();
        setAnalytics(data);
        if (data.vaults?.config) {
          setCompanyPct(String(data.vaults.config.companyPct));
          setPayrollPct(String(data.vaults.config.payrollPct));
          setShareholdersPct(String(data.vaults.config.shareholdersPct));
        }
      }
    } catch (err) { console.error(err); }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/roles');
      if (res.ok) setRolesList(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchStaffUsers = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/staff-users');
      if (res.ok) setStaffUsers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/permissions');
      if (res.ok) {
        const data: RolePermission[] = await res.json();
        const map = { ...DEFAULT_PERMISSIONS };
        data.forEach((p) => { map[p.roleName] = p; });
        setPermissionsMap(map);
      }
    } catch (err) { console.error(err); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:4000/admin/logs');
      if (res.ok) setLogs(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:4000/orders/admin');
      if (res.ok) setOrders(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:4000/products');
      if (res.ok) setProducts(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('http://localhost:4000/categories');
      if (res.ok) setCategories(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!title || !totalCost || !stock || !price) {
      return alert('Completa título, costo total del lote, stock y precio de venta.');
    }

    setUploadingImage(true);
    let uploadedUrl = null;
    if (imageFile) {
      uploadedUrl = await uploadToCloudinary(imageFile);
    }

    try {
      const res = await fetch('http://localhost:4000/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description,
          totalCost: parsedTotalCost,
          stock: parsedStock,
          price: parsedPrice,
          imageUrl: uploadedUrl,
          categoryId: categoryId || null,
          actorId: currentUser?.id,
        }),
      });

      if (res.ok) {
        alert('Lote de productos registrado exitosamente.');
        setTitle(''); setDescription(''); setTotalCost(''); setStock(''); setPrice(''); setCategoryId(''); setImageFile(null);
        fetchProducts();
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar producto.');
      }
    } catch (err) { alert('Error al crear producto'); }
    finally { setUploadingImage(false); }
  };

  const startEditing = (p: Product) => {
    setEditingProduct(p);
    setEditTitle(p.title);
    setEditDescription(p.description || '');
    setEditTotalCost(String(p.totalCost || 0));
    setEditStock(String(p.stock));
    setEditPrice(String(p.price));
    setEditCategoryId(p.categoryId || '');
    setEditImageFile(null);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!editingProduct) return;

    setUploadingImage(true);
    let uploadedUrl = editingProduct.imageUrl;

    if (editImageFile) {
      const newUrl = await uploadToCloudinary(editImageFile);
      if (newUrl) uploadedUrl = newUrl;
    }

    try {
      const res = await fetch(`http://localhost:4000/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          totalCost: editTotalCost,
          stock: editStock,
          price: editPrice,
          imageUrl: uploadedUrl,
          categoryId: editCategoryId || null,
          actorId: currentUser?.id,
        }),
      });

      if (res.ok) {
        alert('Producto actualizado.');
        setEditingProduct(null);
        setEditImageFile(null);
        fetchProducts();
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error al actualizar'); }
    finally { setUploadingImage(false); }
  };

  const handleInjectCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!injectionAmount || Number(injectionAmount) <= 0) return alert('Ingresa un monto válido.');

    try {
      const res = await fetch('http://localhost:4000/admin/capital-injections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: injectionAmount, notes: injectionNotes, actorId: currentUser?.id }),
      });

      if (res.ok) {
        alert('Aporte de capital registrado.');
        setInjectionAmount(''); setInjectionNotes('');
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const handleUpdateFinancialConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    const c = Number(companyPct);
    const p = Number(payrollPct);
    const s = Number(shareholdersPct);

    if ((c + p + s) !== 100) return alert('Suma debe ser 100%.');

    try {
      const res = await fetch('http://localhost:4000/admin/financial-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyPct: c, payrollPct: p, shareholdersPct: s, actorId: currentUser?.id }),
      });

      if (res.ok) {
        alert('Reglas actualizadas.');
        setShowConfigModal(false);
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const handleCreateLender = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!newLenderName.trim()) return alert('Nombre requerido.');

    try {
      const res = await fetch('http://localhost:4000/admin/lenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLenderName, contactInfo: newLenderContact, actorId: currentUser?.id }),
      });

      if (res.ok) {
        alert('Prestamista registrado.');
        setNewLenderName(''); setNewLenderContact('');
        fetchLenders();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!selectedLenderId || !loanPrincipal) return alert('Completa prestamista y monto.');

    try {
      const res = await fetch('http://localhost:4000/admin/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lenderId: selectedLenderId, principal: loanPrincipal,
          interestRate: loanInterestRate || 0, notes: loanNotes, actorId: currentUser?.id,
        }),
      });

      if (res.ok) {
        alert('Préstamo registrado.');
        setSelectedLenderId(''); setLoanPrincipal(''); setLoanInterestRate(''); setLoanNotes('');
        fetchLoans();
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!selectedLoanForPayment || !paymentAmount) return alert('Ingresa monto de abono.');

    try {
      const res = await fetch(`http://localhost:4000/admin/loans/${selectedLoanForPayment.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount, notes: paymentNotes, actorId: currentUser?.id }),
      });

      if (res.ok) {
        alert('Abono registrado.');
        setSelectedLoanForPayment(null); setPaymentAmount(''); setPaymentNotes('');
        fetchLoans();
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const openDeleteModal = (u: StaffUser) => {
    setDeletingUser(u);
    setConfirmDuiInput('');
    setConfirmPasswordInput('');
  };

  const handleConfirmDeleteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!deletingUser || !confirmDuiInput || !confirmPasswordInput) return alert('Completa DUI y Contraseña.');

    try {
      const res = await fetch(`http://localhost:4000/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, confirmDui: confirmDuiInput, confirmPassword: confirmPasswordInput }),
      });

      if (res.ok) {
        alert('Usuario dado de baja.');
        setDeletingUser(null);
        fetchStaffUsers();
        fetchLogs();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al eliminar usuario.');
      }
    } catch (err) { alert('Error de conexión.'); }
  };

  const startEditingUser = (u: StaffUser) => {
    setEditingUser(u);
    setEditUserFullName(u.fullName);
    setEditUserPhone(u.phone);
    setEditUserNewPassword('');
  };

  const handleUpdateUserData = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!editingUser || !editUserFullName || !editUserPhone) return alert('Completa nombre y teléfono.');

    try {
      const res = await fetch(`http://localhost:4000/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, fullName: editUserFullName, phone: editUserPhone, newPassword: editUserNewPassword || undefined }),
      });

      if (res.ok) {
        alert('Datos actualizados.');
        setEditingUser(null);
        fetchStaffUsers();
        fetchLogs();
      }
    } catch (err) { alert('Error de conexión'); }
  };

  const handleUserRoleChange = async (userId: string, newRoleName: string) => {
    const currentUser = getActiveUser();
    try {
      const res = await fetch(`http://localhost:4000/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, newRoleName }),
      });

      if (res.ok) {
        alert('Rol actualizado.');
        fetchStaffUsers();
        fetchRoles();
        fetchLogs();
      }
    } catch (err) { alert('Error de conexión'); }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!newRoleName.trim()) return alert('Nombre de rol requerido.');

    try {
      const res = await fetch('http://localhost:4000/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, name: newRoleName, description: newRoleDesc }),
      });

      if (res.ok) {
        alert('Rol creado.');
        setNewRoleName(''); setNewRoleDesc('');
        fetchRoles();
        fetchPermissions();
        fetchLogs();
      }
    } catch (err) { alert('Error al crear rol'); }
  };

  const handleDeleteRole = async (roleName: string) => {
    const currentUser = getActiveUser();
    if (!confirm(`¿Eliminar rol ${roleName}?`)) return;

    try {
      const res = await fetch(`http://localhost:4000/admin/roles/${roleName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id }),
      });

      if (res.ok) {
        alert('Rol eliminado.');
        fetchRoles();
        fetchPermissions();
        fetchLogs();
      }
    } catch (err) { alert('Error al eliminar rol'); }
  };

  const handleStaffDuiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 9) val = val.slice(0, 9);
    if (val.length > 8) val = `${val.slice(0, 8)}-${val.slice(8)}`;
    setStaffDui(val);
  };

  const handleCreateStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!staffDui || !staffFullName || !staffPhone || !staffPassword) return alert('Completa todos los campos.');

    try {
      const res = await fetch('http://localhost:4000/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, dui: staffDui, fullName: staffFullName, phone: staffPhone, password: staffPassword, role: staffRole }),
      });

      if (res.ok) {
        alert(`Usuario creado en rol ${staffRole}`);
        setStaffDui(''); setStaffFullName(''); setStaffPhone(''); setStaffPassword('');
        fetchStaffUsers();
        fetchRoles();
        fetchLogs();
      }
    } catch (err) { alert('Error al crear usuario.'); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getActiveUser();
    if (!newCategoryName.trim()) return alert('Nombre requerido.');

    try {
      const res = await fetch('http://localhost:4000/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), actorId: currentUser?.id }),
      });

      if (res.ok) {
        alert('Categoría creada');
        setNewCategoryName('');
        fetchCategories();
        fetchAnalytics();
        if (currentUser?.roleName === 'ROOT') fetchLogs();
      }
    } catch (err) { alert('Error al crear categoría'); }
  };

  const handleTogglePermission = async (roleName: string, field: keyof RolePermission) => {
    const currentUser = getActiveUser();
    const currentPerms = permissionsMap[roleName] || DEFAULT_PERMISSIONS[roleName] || { roleName, canManageOrders: true, canCreateProduct: false, canEditProduct: false, canUpdateStock: true, canManageCategories: false, canManageBlacklist: false };
    const updatedValue = !currentPerms[field];

    try {
      const res = await fetch(`http://localhost:4000/admin/permissions/${roleName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, [field]: updatedValue }),
      });

      if (res.ok) {
        setPermissionsMap((prev) => ({ ...prev, [roleName]: { ...currentPerms, [field]: updatedValue } }));
        fetchLogs();
      }
    } catch (err) { alert('Error al modificar permisos'); }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const currentUser = getActiveUser();
    try {
      const res = await fetch(`http://localhost:4000/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actorId: currentUser?.id }),
      });
      if (res.ok) { fetchOrders(); fetchProducts(); fetchAnalytics(); if (currentUser?.roleName === 'ROOT') fetchLogs(); }
    } catch (err) { alert('Error actualizando pedido'); }
  };

  const handleUpdateStock = async (productId: string, newStock: number) => {
    if (newStock < 0) return;
    const currentUser = getActiveUser();
    try {
      const res = await fetch(`http://localhost:4000/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, actorId: currentUser?.id }),
      });
      if (res.ok) { fetchProducts(); fetchAnalytics(); if (currentUser?.roleName === 'ROOT') fetchLogs(); }
    } catch (err) { alert('Error actualizando stock'); }
  };

  const handleToggleBlacklist = async (userId: string, currentStatus: boolean) => {
    const currentUser = getActiveUser();
    try {
      const res = await fetch(`http://localhost:4000/users/${userId}/blacklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlacklisted: !currentStatus, actorId: currentUser?.id }),
      });
      if (res.ok) { fetchOrders(); fetchStaffUsers(); if (currentUser?.roleName === 'ROOT') fetchLogs(); }
    } catch (err) { alert('Error actualizando lista negra'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('nice_order_admin_session');
    router.push('/login');
  };

  const isRoot = (adminUser?.roleName || adminUser?.role) === 'ROOT';
  const myRole = adminUser?.roleName || adminUser?.role || 'STAFF';
  const myPerms = isRoot ? DEFAULT_PERMISSIONS.ADMIN : (permissionsMap[myRole] || DEFAULT_PERMISSIONS.STAFF);
  const activeReport = reportData?.isClosed ? reportData.snapshot : reportData?.calculated;

  return (
    <main className="max-w-md mx-auto p-4 min-h-screen pb-12 bg-slate-50">
      {/* Header (Oculto al imprimir PDF) */}
      <header className="flex justify-between items-center pb-3 mb-4 border-b print:hidden">
        <div>
          <h1 className="font-extrabold text-slate-800 text-sm">{adminUser?.fullName}</h1>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
            isRoot ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {isRoot ? '👑 ROOT (SysAdmin)' : `🛡️ ROL: ${myRole}`}
          </span>
        </div>
        <button onClick={handleLogout} className="text-xs bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold">
          Salir 🚪
        </button>
      </header>

      {/* Navegación (Oculto al imprimir PDF) */}
      <nav className="flex gap-1 mb-4 bg-slate-200 p-1 rounded-lg text-[9px] print:hidden overflow-x-auto">
        <button onClick={() => setActiveTab('orders')} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'orders' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          📦 Pedidos
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'inventory' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          🏷️ Stock
        </button>
        <button onClick={() => { setActiveTab('finances'); fetchAnalytics(); }} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'finances' ? 'bg-emerald-600 text-white shadow' : 'text-emerald-700'}`}>
          📊 Bóvedas
        </button>
        <button onClick={() => { setActiveTab('loans'); fetchLoans(); fetchLenders(); }} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'loans' ? 'bg-amber-600 text-white shadow' : 'text-amber-700'}`}>
          🏦 Deudas
        </button>
        <button onClick={() => { setActiveTab('reports'); fetchReport(); }} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-700'}`}>
          📄 P&L
        </button>
        <button onClick={() => setActiveTab('categories')} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'categories' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          📁 Categorías
        </button>
        {isRoot && (
          <>
            <button onClick={() => { setActiveTab('permissions'); fetchRoles(); fetchStaffUsers(); }} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'permissions' ? 'bg-purple-600 text-white shadow' : 'text-purple-700'}`}>
              👑 Equipo
            </button>
            <button onClick={() => { setActiveTab('logs'); fetchLogs(); }} className={`px-2 py-1.5 font-bold rounded ${activeTab === 'logs' ? 'bg-slate-800 text-white shadow' : 'text-slate-700'}`}>
              📜 Logs
            </button>
          </>
        )}
      </nav>

      {/* PESTAÑA PEDIDOS */}
      {activeTab === 'orders' && (
        <section className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-xs">{o.user.fullName}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">DUI: {o.user.dui} | {o.user.phone}</p>
                </div>
                {(isRoot || myPerms.canManageBlacklist) && (
                  <button onClick={() => handleToggleBlacklist(o.user.id, o.user.isBlacklisted)} className={`text-[9px] px-2 py-0.5 rounded font-bold border ${o.user.isBlacklisted ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {o.user.isBlacklisted ? '⛔ Bloqueado' : '🛡️ Permitido'}
                  </button>
                )}
              </div>

              <div className="py-2 border-y border-slate-100 text-xs space-y-1">
                {o.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-slate-600">
                    <span>{item.quantity}x {item.product.title}</span>
                    <span>{formatUSD(Number(item.price) * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-slate-800 pt-1">
                  <span>Total:</span>
                  <span className="text-indigo-600">{formatUSD(o.total)}</span>
                </div>
              </div>

              {o.status === 'PENDING' && (isRoot || myPerms.canManageOrders) && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => updateOrderStatus(o.id, 'DELIVERED')} className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded">
                    Entregado
                  </button>
                  <button onClick={() => updateOrderStatus(o.id, 'CANCELLED')} className="flex-1 py-1.5 bg-rose-600 text-white text-xs font-bold rounded">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* PESTAÑA INVENTARIO Y COSTEO POR LOTE (AliExpress/Temu) CON IMAGEN */}
      {activeTab === 'inventory' && (
        <section className="space-y-6">
          {(isRoot || myPerms.canCreateProduct) && (
            <form onSubmit={handleCreateProduct} className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xs font-bold text-slate-800">📦 Registrar Lote / Compra (AliExpress / Temu)</h2>
                <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">Costeo Lote</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Producto</label>
                <input type="text" placeholder="Ej. Polerón Oversize" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 text-xs border rounded focus:outline-none mt-0.5" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">1. Costo Lote ($)</label>
                  <input type="number" step="0.01" placeholder="Producto + Envío" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className="w-full p-2 text-xs border rounded font-mono focus:outline-none mt-0.5" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">2. Unidades</label>
                  <input type="number" placeholder="Stock Lote" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full p-2 text-xs border rounded font-mono focus:outline-none mt-0.5" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">3. Precio Venta ($)</label>
                  <input type="number" step="0.01" placeholder="Por Unidad" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-2 text-xs border rounded font-mono focus:outline-none mt-0.5" />
                </div>
              </div>

              {/* Mapeo Automático Financiero del Lote */}
              {parsedStock > 0 && parsedTotalCost > 0 && (
                <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400 text-[10px]">Costo Unitario Desembarcado:</span>
                    <span className="font-mono font-bold text-amber-400">{formatUSD(computedUnitCost)} / u</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400 text-[10px]">Ganancia Unitaria Esperada:</span>
                    <span className={`font-mono font-bold ${computedUnitProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatUSD(computedUnitProfit)} / u
                    </span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-300 font-bold text-[10px]">Ganancia Total Lote:</span>
                    <span className="font-mono font-extrabold text-emerald-400">{formatUSD(computedTotalBatchProfit)}</span>
                  </div>
                </div>
              )}

              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-2 text-xs border rounded focus:outline-none bg-white">
                <option value="">Sin Categoría</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Imagen del Producto (Cloudinary)</label>
                <input
                  type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
                />
              </div>

              <button
                type="submit" disabled={uploadingImage}
                className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded shadow hover:bg-indigo-700 disabled:bg-slate-400"
              >
                {uploadingImage ? 'Subiendo imagen...' : '+ Guardar Lote en Inventario'}
              </button>
            </form>
          )}

          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📦 Existencias en Bodega ({products.length})</h2>
            {products.map((p) => {
              const unitCost = Number(p.costPrice) || 0;
              const unitPrice = Number(p.price) || 0;
              const unitMargin = unitPrice - unitCost;

              return (
                <div key={p.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-center gap-3 text-xs">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-cover rounded-lg border flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-xs">{p.title}</h3>
                    <div className="flex gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
                      <span>Costo: <strong className="text-slate-700">{formatUSD(unitCost)}</strong></span>
                      <span>Venta: <strong className="text-indigo-600">{formatUSD(unitPrice)}</strong></span>
                      <span>Margen: <strong className="text-emerald-600">+{formatUSD(unitMargin)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(isRoot || myPerms.canEditProduct) && (
                      <button onClick={() => startEditing(p)} className="px-2 py-1 bg-amber-50 text-amber-800 text-[10px] font-bold rounded border border-amber-200">
                        ✏️
                      </button>
                    )}
                    {(isRoot || myPerms.canUpdateStock) && (
                      <>
                        <button onClick={() => handleUpdateStock(p.id, p.stock - 1)} className="px-2 py-0.5 bg-slate-100 text-xs font-bold rounded">-</button>
                        <span className="text-xs font-bold font-mono w-6 text-center">{p.stock}</span>
                        <button onClick={() => handleUpdateStock(p.id, p.stock + 1)} className="px-2 py-0.5 bg-slate-100 text-xs font-bold rounded">+</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PESTAÑA BÓVEDAS FINANCIERAS Y SEGREGACIÓN DE CAJAS */}
      {activeTab === 'finances' && (
        <section className="space-y-4">
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Caja Líquida Bruta Disponible</h2>
                <p className="text-[9px] text-slate-400">Total en bóveda (Ventas + Inyecciones - Abonos Deuda)</p>
              </div>
              <button onClick={fetchAnalytics} className="text-[10px] font-mono text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded">🔄 Recargar</button>
            </div>

            <div className="text-center py-2">
              <span className="text-2xl font-extrabold text-emerald-400 font-mono block">
                {formatUSD(analytics?.summary.netGrossCash || 0)}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Ventas: {formatUSD(analytics?.summary.totalSalesRevenue || 0)} | Capital Aportado: {formatUSD(analytics?.summary.totalCapitalInjected || 0)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">💼 Segregación Contable por Cajas Virtuales</h3>
              {isRoot && (
                <button onClick={() => setShowConfigModal(true)} className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded hover:bg-purple-200">
                  ⚙️ Configurar %
                </button>
              )}
            </div>

            <div className="p-3 bg-white rounded-xl border border-indigo-200 shadow-sm flex justify-between items-center">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-indigo-900">🏢 Capital Operativo Empresa</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                    {analytics?.vaults.config.companyPct}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Para stock, compras, préstamos y reserva operativa.</p>
              </div>
              <span className="font-mono font-extrabold text-indigo-600 text-sm">
                {formatUSD(analytics?.vaults.companyVault || 0)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-sm flex justify-between items-center">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-amber-900">👥 Reserva Nómina (Sueldos)</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                    {analytics?.vaults.config.payrollPct}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Fondo para pago de planillas y colaboradores.</p>
              </div>
              <span className="font-mono font-extrabold text-amber-600 text-sm">
                {formatUSD(analytics?.vaults.payrollVault || 0)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm flex justify-between items-center">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-emerald-900">💎 Utilidades Reparto Accionistas</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                    {analytics?.vaults.config.shareholdersPct}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Único fondo disponible para retiros personales / CEO.</p>
              </div>
              <span className="font-mono font-extrabold text-emerald-600 text-sm">
                {formatUSD(analytics?.vaults.shareholdersVault || 0)}
              </span>
            </div>
          </div>

          <form onSubmit={handleInjectCapital} className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-slate-800">➕ Aporte / Inyección de Capital Personal</h3>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Ingreso Legal</span>
            </div>

            <div className="flex gap-2">
              <input
                type="number" step="0.01" placeholder="Monto USD ($)" value={injectionAmount} onChange={(e) => setInjectionAmount(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded font-mono focus:outline-none"
              />
              <input
                type="text" placeholder="Origen / Notas" value={injectionNotes} onChange={(e) => setInjectionNotes(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded focus:outline-none"
              />
            </div>

            <button type="submit" className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded shadow hover:bg-emerald-700">
              + Inyectar Capital a la Empresa
            </button>
          </form>
        </section>
      )}

      {/* PESTAÑA DEUDAS Y PRÉSTAMOS */}
      {activeTab === 'loans' && (
        <section className="space-y-6">
          <form onSubmit={handleCreateLender} className="p-4 bg-white rounded-xl border border-amber-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 border-b pb-2">🏢 Registrar Nuevo Prestamista / Acreedor</h2>
            <div className="flex gap-2">
              <input
                type="text" placeholder="Nombre (ej. Banco Agrícola)" value={newLenderName} onChange={(e) => setNewLenderName(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded focus:outline-none"
              />
              <input
                type="text" placeholder="Contacto / Teléfono" value={newLenderContact} onChange={(e) => setNewLenderContact(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded focus:outline-none"
              />
            </div>
            <button type="submit" className="w-full py-2 bg-amber-600 text-white text-xs font-bold rounded">
              + Guardar Prestamista
            </button>
          </form>

          <form onSubmit={handleCreateLoan} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 border-b pb-2">💰 Registrar Nuevo Préstamo para la Tienda</h2>

            <select
              value={selectedLenderId} onChange={(e) => setSelectedLenderId(e.target.value)}
              className="w-full p-2 text-xs border rounded focus:outline-none bg-white font-bold text-slate-700"
            >
              <option value="">-- Seleccionar Prestamista --</option>
              {lenders.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>

            <div className="flex gap-2">
              <input
                type="number" step="0.01" placeholder="Monto Principal USD ($)" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded focus:outline-none font-mono"
              />
              <input
                type="number" step="0.1" placeholder="Tasa Interés (%)" value={loanInterestRate} onChange={(e) => setLoanInterestRate(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded focus:outline-none font-mono"
              />
            </div>

            <input
              type="text" placeholder="Notas / Propósito" value={loanNotes} onChange={(e) => setLoanNotes(e.target.value)}
              className="w-full p-2 text-xs border rounded focus:outline-none"
            />

            <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded">
              + Registrar Préstamo
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📜 Pasivos y Obligaciones ({loans.length})</h3>
            {loans.map((loan) => (
              <div key={loan.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <span className="font-extrabold text-slate-800 text-sm block">{loan.lender.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Tasa: {Number(loan.interestRate)}% | Registrado: {new Date(loan.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                    loan.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {loan.status === 'PAID' ? '✅ SALDADO' : '⏳ ACTIVO'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 bg-slate-50 p-2.5 rounded-lg">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">Monto Inicial</span>
                    <span className="font-mono font-bold text-slate-600">{formatUSD(loan.principal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">Saldo Pendiente</span>
                    <span className={`font-mono font-extrabold text-sm ${Number(loan.remainingBal) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatUSD(loan.remainingBal)}
                    </span>
                  </div>
                </div>

                {loan.payments.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Histórico de Abonos ({loan.payments.length})</span>
                    {loan.payments.map((pay) => (
                      <div key={pay.id} className="flex justify-between text-[10px] font-mono text-slate-600 border-b border-slate-100 pb-1">
                        <span>{new Date(pay.createdAt).toLocaleDateString()} - {pay.notes || 'Abono'}</span>
                        <span className="font-bold text-emerald-600">-{formatUSD(pay.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {loan.status === 'ACTIVE' && (
                  <button
                    onClick={() => setSelectedLoanForPayment(loan)}
                    className="w-full py-1.5 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700"
                  >
                    💵 Registrar Abono / Pago
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PESTAÑA REPORTES Y P&L FISCAL */}
      {activeTab === 'reports' && (
        <section className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-sm space-y-3 print:hidden">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📅 Selector de Periodo Fiscal</h2>
            <div className="flex gap-2">
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-1/2 p-2 text-xs border rounded font-mono font-bold text-slate-700 bg-white">
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
              <select value={selectedPeriodCode} onChange={(e) => setSelectedPeriodCode(e.target.value)} className="w-1/2 p-2 text-xs border rounded font-bold text-indigo-700 bg-white">
                <option value="Q1">Trimestre 1 (Q1)</option>
                <option value="Q2">Trimestre 2 (Q2)</option>
                <option value="Q3">Trimestre 3 (Q3)</option>
                <option value="Q4">Trimestre 4 (Q4)</option>
                <option value="H1">Semestre 1 (H1)</option>
                <option value="H2">Semestre 2 (H2)</option>
                <option value="FY">Año Completo (FY)</option>
                <option value="M1">Enero (M1)</option>
                <option value="M2">Febrero (M2)</option>
                <option value="M3">Marzo (M3)</option>
              </select>
            </div>
            <button onClick={fetchReport} className="w-full py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded hover:bg-indigo-100">
              🔍 Cargar Datos de Periodo
            </button>
          </div>

          <div className={`p-3 rounded-xl border flex justify-between items-center text-xs ${
            reportData?.isClosed ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div>
              <span className="font-extrabold block">Estado: {reportData?.isClosed ? '🔒 Cierre Congelado e Inmutable' : '🔓 Libros Abiertos (Borrador)'}</span>
              <span className="text-[10px] font-mono">{selectedYear}-{selectedPeriodCode}</span>
            </div>
            {!reportData?.isClosed && isRoot && (
              <button onClick={handleClosePeriod} className="px-2.5 py-1 bg-purple-700 text-white font-bold rounded text-[10px] shadow hover:bg-purple-800">
                🔒 Cerrar Periodo
              </button>
            )}
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans text-slate-800">
            <div className="border-b pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Estado de Resultados (P&L)</h2>
              <p className="text-[10px] text-slate-500 font-mono">Periodo: {selectedYear}-{selectedPeriodCode}</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="font-bold text-slate-700">1. Ventas Brutas Totales</span>
                <span className="font-mono font-extrabold text-emerald-600">{formatUSD(activeReport?.totalSales || 0)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-600">2. Costo Directo de Mercadería (COGS)</span>
                <span className="font-mono font-bold text-rose-600">-{formatUSD(activeReport?.cogs || 0)}</span>
              </div>
              <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded font-extrabold">
                <span className="text-slate-900">(=) Ganancia Bruta Comercial</span>
                <span className="font-mono text-indigo-700">{formatUSD(activeReport?.grossProfit || 0)}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-2 border-t">
              <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Flujos de Caja y Bóvedas</h3>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">+ Aportes de Capital Personal:</span>
                <span className="font-mono text-slate-700">{formatUSD(activeReport?.capitalInjections || 0)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">- Abonos a Préstamos Realizados:</span>
                <span className="font-mono text-rose-600">-{formatUSD(activeReport?.debtPayments || 0)}</span>
              </div>
              <div className="flex justify-between py-1 bg-emerald-50 px-2 rounded font-bold text-emerald-900">
                <span>Caja Líquida Disponible:</span>
                <span className="font-mono">{formatUSD(activeReport?.netGrossCash || 0)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-[11px]">
              <span className="font-bold text-slate-700 block border-b pb-1">Distribución de Cajas:</span>
              <div className="flex justify-between">
                <span>🏢 Capital Operativo Empresa:</span>
                <span className="font-mono font-bold text-indigo-600">{formatUSD(activeReport?.companyVault || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>👥 Reserva Nómina Sueldos:</span>
                <span className="font-mono font-bold text-amber-600">{formatUSD(activeReport?.payrollVault || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>💎 Utilidades Accionistas:</span>
                <span className="font-mono font-bold text-emerald-600">{formatUSD(activeReport?.shareholdersVault || 0)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 print:hidden">
            <button onClick={handlePrintPDF} className="flex-1 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl shadow hover:bg-slate-900">
              🖨️ Imprimir PDF
            </button>
            <button onClick={handleExportCSV} className="flex-1 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow hover:bg-emerald-700">
              📊 Exportar Excel (.csv)
            </button>
          </div>
        </section>
      )}

      {/* PESTAÑA CATEGORÍAS */}
      {activeTab === 'categories' && (
        <section className="space-y-6">
          {(isRoot || myPerms.canManageCategories) && (
            <form onSubmit={handleCreateCategory} className="p-4 bg-white rounded-lg border shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-800">Crear Nueva Categoría</h2>
              <input type="text" placeholder="Nombre de categoría" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full p-2 text-xs border rounded focus:outline-none" />
              <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded">
                + Guardar Categoría
              </button>
            </form>
          )}

          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="p-3 bg-white rounded-lg border flex justify-between items-center text-xs font-bold text-slate-700">
                <span>{c.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">ID: #{c.id.slice(0, 6)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PESTAÑA EQUIPO Y ROLES (EXCLUSIVO ROOT) */}
      {activeTab === 'permissions' && isRoot && (
        <section className="space-y-6">
          <form onSubmit={handleCreateRole} className="p-4 bg-white rounded-xl border border-purple-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xs font-bold text-slate-800">✨ Crear Nuevo Rol Dinámico</h2>
              <span className="text-[9px] font-mono bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">SysAdmin</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text" placeholder="Nombre (ej. SUPERVISOR)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded font-mono uppercase focus:outline-none"
              />
              <input
                type="text" placeholder="Descripción breve" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)}
                className="w-1/2 p-2 text-xs border rounded focus:outline-none"
              />
            </div>

            <button type="submit" className="w-full py-2 bg-purple-600 text-white text-xs font-bold rounded shadow hover:bg-purple-700">
              + Registrar Rol en la BD
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📜 Roles del Sistema ({rolesList.length})</h3>
            {rolesList.map((r) => (
              <div key={r.id} className="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-purple-700">{r.name}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded">
                      {r._count?.users || 0} usuario(s)
                    </span>
                    {r.isSystem && <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 font-bold px-1.5 py-0.5 rounded">Protegido</span>}
                  </div>
                  <p className="text-[10px] text-slate-500">{r.description || 'Sin descripción'}</p>
                </div>

                {!r.isSystem && (
                  <button onClick={() => handleDeleteRole(r.name)} className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold text-[10px]">
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">👥 Cuentas de Personal ({staffUsers.length})</h3>
            {staffUsers.map((u) => (
              <div key={u.id} className={`p-3 bg-white rounded-xl border space-y-2 text-xs shadow-sm ${
                u.isBlacklisted ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
              }`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-slate-800">{u.fullName}</p>
                      <button onClick={() => startEditingUser(u)} className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                        ✏️ Editar
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">DUI: {u.dui} | Tel: {u.phone}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {u.roleName === 'ROOT' ? (
                      <span className="text-[9px] font-mono font-bold px-2 py-1 bg-purple-100 text-purple-800 rounded">ROOT</span>
                    ) : (
                      <>
                        <select
                          value={u.roleName} onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                          className="p-1 text-xs border rounded font-mono font-bold text-indigo-700 bg-slate-50"
                        >
                          {rolesList.filter((r) => r.name !== 'CUSTOMER').map((r) => (
                            <option key={r.id} value={r.name}>{r.name}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleToggleBlacklist(u.id, u.isBlacklisted)}
                          className={`p-1.5 rounded font-bold border ${u.isBlacklisted ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                        >
                          {u.isBlacklisted ? '🔴' : '🟢'}
                        </button>

                        <button onClick={() => openDeleteModal(u)} className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold">
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateStaffUser} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 border-b pb-2">➕ Registrar Nuevo Usuario en el Equipo</h2>

            <div className="flex gap-2">
              <input type="text" placeholder="DUI (00000000-0)" value={staffDui} onChange={handleStaffDuiChange} maxLength={10} className="w-1/2 p-2 text-xs border rounded font-mono" />
              <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} className="w-1/2 p-2 text-xs border rounded font-bold text-purple-700 bg-white">
                {rolesList.filter((r) => r.name !== 'CUSTOMER').map((r) => (<option key={r.id} value={r.name}>{r.name}</option>))}
              </select>
            </div>

            <input type="text" placeholder="Nombre Completo" value={staffFullName} onChange={(e) => setStaffFullName(e.target.value)} className="w-full p-2 text-xs border rounded" />
            <div className="flex gap-2">
              <input type="text" placeholder="Teléfono" value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)} className="w-1/2 p-2 text-xs border rounded" />
              <input type="password" placeholder="Contraseña Inicial" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} className="w-1/2 p-2 text-xs border rounded" />
            </div>

            <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded">
              + Guardar Usuario
            </button>
          </form>

          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">🛡️ Configuración de Permisos por Rol</h3>
            {rolesList.filter((r) => r.name !== 'ROOT' && r.name !== 'CUSTOMER').map((r) => {
              const perm = permissionsMap[r.name] || DEFAULT_PERMISSIONS[r.name] || { roleName: r.name, canManageOrders: true, canCreateProduct: false, canEditProduct: false, canUpdateStock: true, canManageCategories: false, canManageBlacklist: false };
              return (
                <div key={r.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 border-b pb-1">
                    Rol: <span className="text-purple-700 font-mono">{r.name}</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <label className="flex justify-between items-center text-slate-700 cursor-pointer">
                      <span>Administrar Pedidos</span>
                      <input type="checkbox" checked={perm.canManageOrders} onChange={() => handleTogglePermission(r.name, 'canManageOrders')} className="w-4 h-4 accent-purple-600" />
                    </label>
                    <label className="flex justify-between items-center text-slate-700 cursor-pointer">
                      <span>Crear Productos</span>
                      <input type="checkbox" checked={perm.canCreateProduct} onChange={() => handleTogglePermission(r.name, 'canCreateProduct')} className="w-4 h-4 accent-purple-600" />
                    </label>
                    <label className="flex justify-between items-center text-slate-700 cursor-pointer">
                      <span>Editar Productos</span>
                      <input type="checkbox" checked={perm.canEditProduct} onChange={() => handleTogglePermission(r.name, 'canEditProduct')} className="w-4 h-4 accent-purple-600" />
                    </label>
                    <label className="flex justify-between items-center text-slate-700 cursor-pointer">
                      <span>Ajustar Stock</span>
                      <input type="checkbox" checked={perm.canUpdateStock} onChange={() => handleTogglePermission(r.name, 'canUpdateStock')} className="w-4 h-4 accent-purple-600" />
                    </label>
                    <label className="flex justify-between items-center text-slate-700 cursor-pointer">
                      <span>Gestionar Categorías</span>
                      <input type="checkbox" checked={perm.canManageCategories} onChange={() => handleTogglePermission(r.name, 'canManageCategories')} className="w-4 h-4 accent-purple-600" />
                    </label>
                    <label className="flex justify-between items-center text-slate-700 cursor-pointer">
                      <span>Gestionar Blacklist</span>
                      <input type="checkbox" checked={perm.canManageBlacklist} onChange={() => handleTogglePermission(r.name, 'canManageBlacklist')} className="w-4 h-4 accent-purple-600" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PESTAÑA LOGS DE AUDITORÍA */}
      {activeTab === 'logs' && isRoot && (
        <section className="space-y-3">
          <div className="p-3 bg-slate-800 text-white rounded-xl shadow flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold">Bitácora de Eventos de Auditoría</h2>
              <p className="text-[10px] text-slate-400">Histórico de acciones ejecutadas en el sistema.</p>
            </div>
            <button onClick={fetchLogs} className="px-2 py-1 bg-slate-700 text-[10px] rounded font-mono">🔄 Recargar</button>
          </div>

          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1 text-xs">
                <div className="flex justify-between items-center border-b pb-1">
                  <span className="font-bold text-slate-800">{log.user?.fullName || 'Desconocido'}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{log.user?.roleName}</span>
                </div>
                <p className="font-mono text-[10px] text-indigo-600 font-bold">{log.action}</p>
                <p className="text-[11px] text-slate-600">{log.details}</p>
                <span className="block text-[9px] text-slate-400 text-right">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODALES */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateFinancialConfig} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl border border-purple-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-purple-900">⚙️ Configurar Reglas de Reparto (%)</h3>
              <button type="button" onClick={() => setShowConfigModal(false)} className="text-xs text-slate-400 font-bold">✕</button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">% Capital Operativo Empresa</label>
              <input type="number" value={companyPct} onChange={(e) => setCompanyPct(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">% Reserva Nómina Trabajadores</label>
              <input type="number" value={payrollPct} onChange={(e) => setPayrollPct(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">% Utilidades Accionistas / Dueña</label>
              <input type="number" value={shareholdersPct} onChange={(e) => setShareholdersPct(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowConfigModal(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">Cancelar</button>
              <button type="submit" className="flex-1 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow">Guardar Reglas</button>
            </div>
          </form>
        </div>
      )}

      {selectedLoanForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleRecordPayment} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl border border-emerald-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-emerald-800 flex items-center gap-1.5">💵 Registrar Abono de Deuda</h3>
              <button type="button" onClick={() => setSelectedLoanForPayment(null)} className="text-xs text-slate-400 font-bold">✕</button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-xs space-y-1 text-emerald-900 border border-emerald-100">
              <p className="font-bold">Prestamista: {selectedLoanForPayment.lender.name}</p>
              <p className="text-[10px] font-mono">Saldo Pendiente: <span className="font-bold text-rose-600">{formatUSD(selectedLoanForPayment.remainingBal)}</span></p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Monto a Abonar (USD)</label>
              <input type="number" step="0.01" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full p-2.5 text-xs border rounded-lg font-mono" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Comprobante / Notas</label>
              <input type="text" placeholder="Ej. Depósito Banco" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="w-full p-2.5 text-xs border rounded-lg" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setSelectedLoanForPayment(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg">Abonar Deuda</button>
            </div>
          </form>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateProduct} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Editar Producto y Costo de Lote</h3>
              <button type="button" onClick={() => setEditingProduct(null)} className="text-xs text-slate-400 font-bold">✕</button>
            </div>

            <input type="text" placeholder="Título" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full p-2 text-xs border rounded focus:outline-none" />
            <input type="text" placeholder="Descripción" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full p-2 text-xs border rounded focus:outline-none" />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase">Costo Lote ($)</label>
                <input type="number" step="0.01" value={editTotalCost} onChange={(e) => setEditTotalCost(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase">Stock</label>
                <input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase">Precio Venta ($)</label>
                <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" />
              </div>
            </div>

            <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className="w-full p-2 text-xs border rounded focus:outline-none bg-white">
              <option value="">Sin Categoría</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cambiar Imagen (Cloudinary)</label>
              <input
                type="file" accept="image/*" onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">Cancelar</button>
              <button type="submit" disabled={uploadingImage} className="flex-1 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl disabled:bg-slate-400">
                {uploadingImage ? 'Subiendo...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleConfirmDeleteUser} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl border border-rose-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-rose-700 flex items-center gap-1.5">⚠️ Confirma la Baja</h3>
              <button type="button" onClick={() => setDeletingUser(null)} className="text-xs text-slate-400 font-bold">✕</button>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl text-xs space-y-1 text-rose-900 border border-rose-100">
              <p className="font-bold">Vas a dar de baja a: <span className="underline">{deletingUser.fullName}</span></p>
              <p className="text-[10px] text-rose-700">La cuenta se desactivará de forma permanente (Soft Delete).</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">1. Digita el DUI del usuario objetivo</label>
              <input type="text" placeholder={deletingUser.dui} value={confirmDuiInput} onChange={(e) => setConfirmDuiInput(e.target.value)} className="w-full p-2.5 text-xs border rounded-lg font-mono" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">2. Digita la Contraseña del usuario objetivo</label>
              <input type="password" placeholder="••••••••" value={confirmPasswordInput} onChange={(e) => setConfirmPasswordInput(e.target.value)} className="w-full p-2.5 text-xs border rounded-lg" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setDeletingUser(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-lg">🔥 Confirmar Baja</button>
            </div>
          </form>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateUserData} className="bg-white rounded-lg p-5 w-full max-w-sm space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Editar Perfil de Usuario</h3>
              <button type="button" onClick={() => setEditingUser(null)} className="text-xs text-slate-400 font-bold">✕</button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">DUI (Inmutable)</label>
              <input type="text" value={editingUser.dui} disabled className="w-full p-2 text-xs border rounded font-mono bg-slate-100 text-slate-500" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre Completo</label>
              <input type="text" value={editUserFullName} onChange={(e) => setEditUserFullName(e.target.value)} className="w-full p-2 text-xs border rounded" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Teléfono</label>
              <input type="text" value={editUserPhone} onChange={(e) => setEditUserPhone(e.target.value)} className="w-full p-2 text-xs border rounded" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Restablecer Contraseña (Opcional)</label>
              <input type="password" placeholder="Nueva contraseña (mínimo 6)" value={editUserNewPassword} onChange={(e) => setEditUserNewPassword(e.target.value)} className="w-full p-2 text-xs border rounded" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded">Cancelar</button>
              <button type="submit" className="flex-1 py-2 bg-purple-600 text-white text-xs font-bold rounded">Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}