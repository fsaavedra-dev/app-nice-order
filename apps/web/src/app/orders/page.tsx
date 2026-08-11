'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUSD } from '@nice-order/shared-types';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('nice_order_user') || 'null');
    if (!user) return router.push('/login');

    fetch(`http://localhost:4000/orders/user/${user.id}`)
      .then((res) => res.json())
      .then((data) => setOrders(data))
      .catch((err) => console.error(err));
  }, [router]);

  return (
    <div className="max-w-md mx-auto p-4 min-h-screen bg-slate-50 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <button onClick={() => router.push('/home')} className="text-xs font-bold text-slate-500">
          ← Volver
        </button>
        <h1 className="text-base font-bold text-slate-800">Mis Pedidos</h1>
      </div>

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="p-4 bg-white rounded-xl border shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-slate-400">#{o.id.slice(0, 8)}</span>
              <span className="font-bold text-indigo-600">{o.status}</span>
            </div>
            <div className="border-y py-2 text-xs space-y-1">
              {o.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-slate-600">
                  <span>{item.quantity}x {item.product.title}</span>
                  <span>{formatUSD(Number(item.price) * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-xs text-slate-800 pt-1">
              <span>Total:</span>
              <span>{formatUSD(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}