'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Inicio', href: '/home', icon: '🏠' },
    { label: 'Categorías', href: '/categories', icon: '🏷️' },
    { label: 'Carrito', href: '/cart', icon: '🛒' },
    { label: 'Perfil', href: '/profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <main className="max-w-md mx-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 max-w-md mx-auto z-40">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center text-[10px] font-bold transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}