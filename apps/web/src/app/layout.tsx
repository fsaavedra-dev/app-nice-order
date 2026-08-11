import './globals.css';

export const metadata = {
  title: 'Nice Order - Catálogo',
  description: 'Haz tu pedido en línea de forma rápida',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 font-sans">{children}</body>
    </html>
  );
}