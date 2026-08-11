'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatUSD } from '@nice-order/shared-types';

interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  _count?: { products: number };
}

interface Product {
  id: string;
  title: string;
  price: number;
  stock: number;
  imageUrl?: string;
  categoryId?: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:4000/categories').then((res) => res.json()),
      fetch('http://localhost:4000/products').then((res) => res.json()),
    ])
      .then(([catData, prodData]) => {
        setCategories(catData);
        setProducts(prodData);
      })
      .catch((err) => console.error('Error al cargar categorías y productos:', err))
      .finally(() => setLoading(false));
  }, []);

  // Filtrado reactivo en memoria según la categoría seleccionada
  const filteredProducts = selectedCategoryId
    ? products.filter((p) => p.categoryId === selectedCategoryId)
    : products;

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      <header className="py-2">
        <h1 className="text-lg font-bold text-slate-800">Explorar Categorías</h1>
        <p className="text-xs text-slate-500">Filtra nuestro catálogo por tipo de producto.</p>
      </header>

      {/* Selector Horizontal de Categorías */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors border ${
            selectedCategoryId === null
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          Todas ({products.length})
        </button>

        {categories.map((cat) => {
          const isActive = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {cat.name} ({cat._count?.products || 0})
            </button>
          );
        })}
      </div>

      {/* Grilla E-Commerce de Productos Filtrados */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          {selectedCategoryId
            ? categories.find((c) => c.id === selectedCategoryId)?.name
            : 'Todos los Productos'}
        </h2>

        {loading ? (
          <p className="text-xs text-slate-400 py-8 text-center">Cargando catálogo...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed text-center">
            <p className="text-xs text-slate-400">No hay productos disponibles en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
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
                  <h3 className="font-bold text-xs text-slate-800 line-clamp-1">{p.title}</h3>
                  <p className="text-xs font-black text-indigo-600">{formatUSD(p.price)}</p>
                  <span className="inline-block text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 font-medium rounded">
                    Stock: {p.stock}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}