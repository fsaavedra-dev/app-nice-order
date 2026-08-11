'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [dui, setDui] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDuiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 9) val = val.slice(0, 9);
    if (val.length > 8) val = `${val.slice(0, 8)}-${val.slice(8)}`;
    setDui(val);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dui || !password) return alert('Ingresa tu DUI y contraseña.');

    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dui, password }),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Error al autenticar');

      localStorage.setItem('nice_order_admin_session', JSON.stringify(data));
      router.push('/dashboard');
    } catch (err) {
      alert('Error de conexión con la API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col justify-center p-6 max-w-md mx-auto">
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-5">
        <div className="text-center space-y-1">
          <span className="text-3xl">🛡️</span>
          <h1 className="text-xl font-bold text-white">Nice Order</h1>
          <p className="text-xs text-slate-400">Acceso Administrativo</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">DUI</label>
            <input
              type="text"
              placeholder="00000000-0"
              value={dui}
              onChange={handleDuiChange}
              maxLength={10}
              className="w-full p-2.5 text-xs bg-slate-900 border border-slate-700 text-white rounded-lg font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-900 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors disabled:bg-slate-700"
          >
            {loading ? 'Verificando Permisos...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </main>
  );
}