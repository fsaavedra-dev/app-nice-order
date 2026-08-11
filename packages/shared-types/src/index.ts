// ==========================================
// ENUMERACIONES Y TIPOS BASE
// ==========================================

export type Role = 'ROOT' | 'ADMIN' | 'STAFF' | 'CUSTOMER';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

// ==========================================
// ENTIDADES Y DTOs DE USUARIO
// ==========================================

export interface User {
  id: string;
  dui: string;
  fullName: string;
  phone: string;
  role: Role;
  isBlacklisted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterUserDto {
  dui: string;
  fullName: string;
  phone: string;
  password?: string;
}

export interface LoginUserDto {
  dui: string;
  password?: string;
}

export interface UpdatePasswordDto {
  dui: string;
  oldPassword?: string;
  newPassword?: string;
}

// ==========================================
// ENTIDADES Y DTOs DE CATÁLOGO Y INVENTARIO
// ==========================================

export interface Category {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  isActive?: boolean;
  categoryId?: string;
}

export interface CreateProductDto {
  title: string;
  description?: string;
  price: number | string;
  stock: number | string;
  imageUrl?: string;
  categoryId?: string;
}

export interface UpdateProductDto {
  title?: string;
  description?: string;
  price?: number | string;
  stock?: number | string;
  imageUrl?: string;
  categoryId?: string;
}

// ==========================================
// ENTIDADES Y DTOs DE PEDIDOS Y TRANSACCIONES
// ==========================================

export interface OrderItemDto {
  productId: string;
  quantity: number;
}

export interface CreateOrderDto {
  userId: string;
  items: OrderItemDto[];
  notes?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  product?: Product;
}

export interface Order {
  id: string;
  userId: string;
  user?: User;
  status: OrderStatus;
  total: number;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// FUNCIONES DE UTILIDAD COMPARTIDAS
// ==========================================

/**
 * Formatea cifras numéricas a estándar monetario en dólares americanos ($USD).
 * Utiliza Intl.NumberFormat (API nativa de internacionalización del motor de JavaScript)
 * para asegurar precisión fija de centavos.
 */
export const formatUSD = (amount: number | string): string => {
  const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericValue)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

/**
 * Validación matemática según el algoritmo Módulo 10 para el Documento Único de Identidad (DUI) de El Salvador.
 * Verifica la máscara mediante Regex (expresión regular para coincidencia de patrones de texto: 00000000-0)
 * y evalúa la ponderación descendente para contrastar el dígito verificador final.
 */
export const isValidDUI = (dui: string): boolean => {
  const regex = /^\d{8}-\d{1}$/;
  if (!regex.test(dui)) return false;

  const [digits, checkDigit] = dui.split('-');
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(digits[i], 10) * (9 - i);
  }

  const remainder = sum % 10;
  const computedCheckDigit = remainder === 0 ? 0 : (10 - remainder) % 10;

  return computedCheckDigit === parseInt(checkDigit, 10);
};