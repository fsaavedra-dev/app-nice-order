'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [dui, setDui] = useState('');
  const [password, setPassword] = useState('');

  const handleDuiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 9) val = val.slice(0, 9);
    if (val.length > 8) val = `${val.slice(0, 8)}-${val.slice(8)}`;
    setDui(val);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dui || !password) return alert('Ingresa tu DUI y contraseña.');

    try {
      const res = await fetch('http://localhost:4000/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dui, password }),
      });

      const user = await res.json();
      if (!res.ok) return alert(user.error || 'Error de autenticación');

      localStorage.setItem('nice_order_user', JSON.stringify(user));
      router.push('/home');
    } catch (err) {
      alert('Error al conectar con la API.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center p-6 max-w-md mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Iniciar Sesión</h1>
          <p className="text-xs text-slate-500">Ingresa tus credenciales registradas.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-600">DUI</label>
            <input
              type="text"
              placeholder="01234567-8"
              value={dui}
              onChange={handleDuiChange}
              maxLength={10}
              className="w-full p-2.5 text-xs border rounded-lg font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 text-xs border rounded-lg focus:outline-none"
            />
          </div>

          <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-indigo-700">
            Ingresar
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500 space-y-2">
          <p>
            ¿No tienes cuenta?{' '}
            <button onClick={() => router.push('/signup')} className="text-indigo-600 font-bold underline">
              Regístrate aquí
            </button>
          </p>
          <button onClick={() => router.push('/update-password')} className="text-[10px] text-slate-400 hover:underline">
            ¿Actualizar contraseña?
          </button>
        </div>
      </div>
    </div>
  );
}