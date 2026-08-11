'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatUSD } from '@nice-order/shared-types';

interface Product {
  id: string;
  title: string;
  price: number;
  stock: number;
  imageUrl?: string;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch('http://localhost:4000/products')
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <header className="flex justify-between items-center py-2">
        <div>
          <h1 className="text-lg font-black text-indigo-600">Nice Order</h1>
          <p className="text-[10px] text-slate-400">El Salvador 🇸🇻</p>
        </div>
        <Link href="/orders" className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold">
          📋 Mis Pedidos
        </Link>
      </header>

      <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl text-white shadow-md">
        <p className="text-[10px] font-bold uppercase text-indigo-200">Destacados</p>
        <h2 className="text-base font-bold">Catálogo Oficial</h2>
        <p className="text-xs text-indigo-100 mt-0.5">Precios transparentes en $USD</p>
      </div>

      <h3 className="font-bold text-xs text-slate-800">Productos Disponibles</h3>

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/product/${p.id}`}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all"
          >
            <div className="h-32 bg-slate-100 flex items-center justify-center overflow-hidden">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400">Sin foto</span>
              )}
            </div>
            <div className="p-2.5 space-y-1">
              <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{p.title}</h4>
              <p className="text-xs font-black text-indigo-600">{formatUSD(p.price)}</p>
              <span className="inline-block text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 font-medium rounded">
                Stock: {p.stock}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}