import path from 'node:path'
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// La revisión del precaché cambia en cada deploy. Con `revision: null` Serwist
// trata la entrada como inmutable y nunca la vuelve a pedir, así que el HTML
// precacheado queda congelado para siempre: tras el rebrand, los navegadores
// que ya tenían la PWA instalada seguían viendo la página vieja.
const revisionBuild = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now())

const withSerwist = withSerwistInit({
  // Archivo fuente del service worker (en el directorio app/)
  swSrc: 'app/sw.ts',
  // Destino del service worker compilado (debe ser accesible en la raíz)
  swDest: 'public/sw.js',
  // Deshabilitar PWA en desarrollo para facilitar el hot reload
  disable: process.env.NODE_ENV === 'development',
  // Solo el shell offline de la PWA se precachea. /login NO: es una pantalla de
  // autenticación que debe venir siempre fresca, y sin red no sirve de nada.
  additionalPrecacheEntries: [
    { url: '/pwa', revision: revisionBuild },
  ],
})

const nextConfig: NextConfig = {
  // Activar React Strict Mode para detectar efectos secundarios en desarrollo
  reactStrictMode: true,

  // El runtime Node.js del middleware se declara directamente en middleware.ts
  // mediante `export const runtime = 'nodejs'` (estable desde Next 15.5).

  // Monorepo: trazar dependencias desde la raíz del repo, no desde apps/web.
  // Sin esto, Next.js no encuentra los archivos de Prisma generados en
  // `<root>/node_modules/.pnpm/@prisma+client@*/...` y deja el binario fuera
  // del bundle del lambda.
  outputFileTracingRoot: path.join(__dirname, '../..'),

  // Forzar la inclusión del query engine de Prisma en TODAS las rutas server.
  // Sin este include, Vercel reporta "Could not locate the Query Engine for
  // runtime rhel-openssl-3.0.x" en runtime.
  outputFileTracingIncludes: {
    '/**/*': [
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*',
      '../../node_modules/.prisma/client/**/*',
      '../../node_modules/@prisma/client/**/*',
    ],
    // El alta de clientes aplica estos .sql a la DB nueva (neon-provisioner).
    '/superadmin/**/*': ['../../packages/db/prisma/migrations/**/*'],
  },

  // Configuración de headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
