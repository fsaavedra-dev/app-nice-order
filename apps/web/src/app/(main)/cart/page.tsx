'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateOrderDto, formatUSD } from '@nice-order/shared-types';

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('nice_order_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    const cart = JSON.parse(localStorage.getItem('nice_order_cart') || '{}');
    fetch('http://localhost:4000/products')
      .then((res) => res.json())
      .then((products) => {
        const items = Object.entries(cart)
          .map(([id, qty]) => {
            const prod = products.find((p: any) => p.id === id);
            return prod ? { ...prod, quantity: qty } : null;
          })
          .filter(Boolean);
        setCartItems(items);
      });
  }, []);

  const total = cartItems.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      alert('Debes iniciar sesión con tu DUI antes de confirmar.');
      return router.push('/login');
    }

    setLoading(true);
    const orderPayload: CreateOrderDto = {
      userId: user.id,
      items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
      notes: 'Pedido generado desde Carrito Web',
    };

    try {
      const res = await fetch('http://localhost:4000/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error procesando pedido');

      localStorage.removeItem('nice_order_cart');
      alert('🎉 ¡Pedido registrado exitosamente!');
      router.push('/orders');
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold text-slate-800">Carrito de Compras</h1>

      {cartItems.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-12">El carrito está vacío.</p>
      ) : (
        <div className="space-y-3">
          {cartItems.map((item) => (
            <div key={item.id} className="p-3 bg-white rounded-xl border flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xs">{item.title}</h3>
                <p className="text-[10px] text-indigo-600 font-bold">{formatUSD(item.price)} x {item.quantity}</p>
              </div>
              <span className="font-bold text-xs text-slate-800">{formatUSD(Number(item.price) * item.quantity)}</span>
            </div>
          ))}

          <div className="p-4 bg-white rounded-xl border space-y-2">
            <div className="flex justify-between font-bold text-sm text-slate-800">
              <span>Total USD:</span>
              <span className="text-indigo-600">{formatUSD(total)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {loading ? 'Procesando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}