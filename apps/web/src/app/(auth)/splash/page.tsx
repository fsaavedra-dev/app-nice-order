'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const user = localStorage.getItem('nice_order_user');
      if (user) {
        router.push('/home');
      } else {
        router.push('/login');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center text-white p-4">
      <div className="animate-bounce text-6xl mb-4">🛍️</div>
      <h1 className="text-3xl font-black tracking-tight">Nice Order</h1>
      <p className="text-indigo-200 text-xs mt-1">El Salvador 🇸🇻</p>
      <div className="mt-8 flex gap-1">
        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
        <div className="w-2 h-2 bg-white rounded-full animate-ping delay-100"></div>
        <div className="w-2 h-2 bg-white rounded-full animate-ping delay-200"></div>
      </div>
    </div>
  );
}