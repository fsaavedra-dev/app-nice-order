/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fuerza al compilador a procesar el código de paquetes locales del monorepo
  transpilePackages: ['@nice-order/shared-types'],
};

export default nextConfig;