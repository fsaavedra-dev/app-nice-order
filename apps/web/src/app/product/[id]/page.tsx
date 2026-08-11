'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUSD } from '@nice-order/shared-types';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetch(`http://localhost:4000/products`)
      .then((res) => res.json())
      .then((products) => {
        const found = products.find((p: any) => p.id === params.id);
        setProduct(found);
      });
  }, [params.id]);

  if (!product) return <p className="p-4 text-center text-xs text-slate-400">Cargando producto...</p>;

  const handleAddToCart = () => {
    const currentCart = JSON.parse(localStorage.getItem('nice_order_cart') || '{}');
    currentCart[product.id] = (currentCart[product.id] || 0) + quantity;
    localStorage.setItem('nice_order_cart', JSON.stringify(currentCart));
    router.push('/cart');
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen p-4 pb-20 space-y-4">
      <button onClick={() => router.back()} className="text-xs font-bold text-slate-500 mb-2">
        ← Volver
      </button>

      <div className="h-64 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-slate-400">Sin foto</span>
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-bold text-slate-800">{product.title}</h1>
        <p className="text-xl font-extrabold text-indigo-600">{formatUSD(product.price)}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{product.description || 'Sin descripción disponible.'}</p>
      </div>

      {/* Selector de Unidades */}
      <div className="flex items-center gap-3 py-3 border-y border-slate-100">
        <span className="text-xs font-bold text-slate-600">Cantidad:</span>
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="w-8 h-8 bg-slate-100 font-bold rounded-lg"
        >
          -
        </button>
        <span className="text-xs font-bold">{quantity}</span>
        <button
          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
          className="w-8 h-8 bg-slate-100 font-bold rounded-lg"
        >
          +
        </button>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={product.stock <= 0}
        className="w-full py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-indigo-700 disabled:bg-slate-300"
      >
        {product.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
      </button>
    </div>
  );
}