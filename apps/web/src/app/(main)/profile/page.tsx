'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUSD, OrderStatus } from '@nice-order/shared-types';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    title: string;
  };
}

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    // Deserialización (conversión de JSON a objeto TypeScript en memoria) del usuario local
    const savedUser = localStorage.getItem('nice_order_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      fetchUserOrders(parsedUser.id);
    } else {
      router.push('/login');
    }
  }, [router]);

  const fetchUserOrders = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/orders/user/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error al consultar historial de pedidos:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogout = () => {
    // Purga de sesión (eliminación de claves en Web Storage API)
    localStorage.removeItem('nice_order_user');
    localStorage.removeItem('nice_order_cart');
    router.push('/login');
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md">⏳ Pendiente</span>;
      case 'DELIVERED':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">✅ Entregado</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-md">❌ Cancelado</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-800 rounded-md">{status}</span>;
    }
  };

  if (!user) return <p className="p-4 text-center text-xs text-slate-400">Cargando perfil...</p>;

  return (
    <div className="p-4 space-y-5 max-w-md mx-auto pb-24">
      <h1 className="text-lg font-bold text-slate-800">Perfil de Usuario</h1>

      {/* Tarjeta de Datos del Cliente */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre Completo</label>
          <p className="text-sm font-bold text-slate-800">{user.fullName}</p>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DUI (El Salvador)</label>
          <p className="text-xs font-mono font-bold text-indigo-600">{user.dui}</p>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teléfono / WhatsApp</label>
          <p className="text-xs text-slate-600">{user.phone}</p>
        </div>
      </div>

      {/* Sección de Seguimiento de Pedidos */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          📦 Seguimiento de Mis Pedidos ({orders.length})
        </h2>

        {loadingOrders ? (
          <p className="text-xs text-slate-400 py-4 text-center">Cargando pedidos en tiempo real...</p>
        ) : orders.length === 0 ? (
          <div className="p-4 bg-white rounded-xl border border-dashed text-center">
            <p className="text-xs text-slate-400">No tienes pedidos registrados activos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-[10px] font-mono text-slate-400">ID: #{o.id.slice(0, 8)}</span>
                  {getStatusBadge(o.status)}
                </div>

                <div className="space-y-1 py-1 text-xs">
                  {o.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-slate-600">
                      <span>{item.quantity}x {item.product.title}</span>
                      <span className="font-mono">{formatUSD(Number(item.price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t font-bold text-xs text-slate-800">
                  <span>Total:</span>
                  <span className="text-indigo-600 font-extrabold">{formatUSD(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Botón de Cierre de Sesión */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-rose-700 transition-colors"
      >
        🚪 Cerrar Sesión
      </button>
    </div>
  );
}