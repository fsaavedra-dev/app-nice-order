import './globals.css';

export const metadata = {
  title: 'Nice Order - Admin Panel',
  description: 'Panel de control de inventario y pedidos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-slate-900 font-sans">{children}</body>
    </html>
  );
}