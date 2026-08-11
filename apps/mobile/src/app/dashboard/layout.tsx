'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('nice_order_admin_session');
    if (!savedSession) {
      router.push('/login');
    } else {
      setAdmin(JSON.parse(savedSession));
    }
  }, [router]);

  if (!admin) return null;

  return <>{children}</>;
}