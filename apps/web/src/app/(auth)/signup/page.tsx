'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidDUI } from '@nice-order/shared-types';

export default function SignUpPage() {
  const router = useRouter();
  const [dui, setDui] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleDuiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 9) val = val.slice(0, 9);
    if (val.length > 8) val = `${val.slice(0, 8)}-${val.slice(8)}`;
    setDui(val);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidDUI(dui)) {
      return alert('El DUI no cumple con la especificación de El Salvador (00000000-0).');
    }
    if (!fullName.trim() || !phone.trim() || !password) {
      return alert('Todos los campos son obligatorios.');
    }
    if (password.length < 6) {
      return alert('La contraseña debe contener al menos 6 caracteres.');
    }

    try {
      const res = await fetch('http://localhost:4000/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dui, fullName, phone, password }),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Fallo al procesar el registro');

      localStorage.setItem('nice_order_user', JSON.stringify(data));
      router.push('/home');
    } catch (err) {
      alert('Error de conexión con la API backend.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center p-6 max-w-md mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Crear Cuenta</h1>
          <p className="text-xs text-slate-500">Ingresa tus datos y establece tu clave de acceso.</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-600">DUI (00000000-0)</label>
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
            <label className="text-[10px] font-bold text-slate-600">Nombre Completo</label>
            <input
              type="text"
              placeholder="Ej. Carlos Mendoza"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-2.5 text-xs border rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600">Teléfono / WhatsApp</label>
            <input
              type="text"
              placeholder="7000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 text-xs border rounded-lg focus:outline-none"
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
            Crear Cuenta e Ingresar
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => router.push('/login')} className="text-indigo-600 font-bold underline">
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}