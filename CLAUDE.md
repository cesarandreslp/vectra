# Sistema de Inteligencia Electoral — Vectra

## Descripción del proyecto
Plataforma SaaS multi-tenant para gestión integral de campañas
electorales en Colombia. Cada cliente (campaña) tiene su propia
base de datos aislada. Sistema modular con un core obligatorio
y módulos opcionales por suscripción.

## Stack tecnológico
- **Framework**: Next.js 15 App Router + TypeScript (strict mode)
- **Base de datos**: Neon (PostgreSQL serverless) + Prisma ORM
- **Hosting**: Vercel
- **Storage**: Vercel Blob (fotos de actas, materiales de formación)
- **Auth**: NextAuth v5
- **Estilos**: Tailwind CSS v4
- **Agentes IA**: Groq (tiempo real) + Zhipu Flash Z-AI (análisis)
- **Monorepo**: Turborepo + pnpm workspaces

## Arquitectura multi-tenant
- DB separada por cliente → Prisma client instanciado dinámicamente
- Superadmin en: admin.[dominio].com
- Tenants en: [slug].[dominio].com o dominio propio del cliente
- El middleware de Next.js resuelve el tenantId desde el Host header
- Los módulos activos se guardan en la DB del superadmin y se
  inyectan en la sesión del usuario

## Estructura de carpetas
apps/
  web/                 → Next.js principal (superadmin + tenants)
packages/
  db/                  → Prisma schema + migraciones + seed
  ui/                  → Componentes compartidos
  auth/                → Configuración NextAuth
  ai/                  → Clientes Groq y Zhipu Flash

## Módulos del sistema
CORE (obligatorio): BD territorial DIVIPOLA, líderes, electores,
  puestos de votación, mesas, roles y permisos, PWA offline
ANALYTICS: Dashboard KPIs, mapa de calor, proyección de votos,
  agente IA análisis de fidelidad de líderes
FORMACION: Capacitación testigos, evaluaciones, simulacros
DIA_E: Transmisión E-14, sala de situación, reclamaciones
COMUNICACIONES: SMS/WhatsApp/email segmentado
FINANZAS: Control de gastos, donaciones, límites legales

## Convenciones de código
- Named exports siempre (nunca default export en componentes)
- interface sobre type para formas de objetos
- async/await, nunca .then() encadenado
- Server Actions para toda mutación de datos
- Cada Server Action verifica: tenantId + rol + módulo activo
- Componentes máximo 150 líneas; extraer si supera
- Carpeta _components solo para componentes de esa ruta
- Variables de entorno: nunca en cliente, siempre server-side

## Seguridad — reglas absolutas
- NUNCA exponer connection strings al cliente
- Connection strings de tenants van CIFRADAS en DB superadmin
- Todo campo PII (cédula, teléfono) va cifrado en reposo
- Roles: SUPERADMIN / ADMIN_CAMPANA / COORDINADOR / LIDER / TESTIGO
- Cada rol solo accede a sus rutas y datos permitidos

## Colombia-específico
- Estructura territorial: Departamento → Municipio → Comuna/Corregimiento
  → Barrio/Vereda → Puesto de votación → Mesa
- Códigos DIVIPOLA para municipios
- Formulario E-14 es el acta oficial de resultados por mesa
- Marco legal: Ley 1581/2012 (protección de datos personales)

## Comandos útiles
pnpm dev          → levantar todo el monorepo
pnpm db:push      → push del schema Prisma a la DB
pnpm db:migrate   → crear y correr migración
pnpm db:studio    → abrir Prisma Studio
pnpm lint         → correr antes de dar tarea por terminada
pnpm build        → verificar que compila antes de commitear

## Lo que NO debes hacer
- NO instalar dependencias sin mencionarlo explícitamente
- NO modificar archivos en prisma/migrations/ directamente  
- NO usar localStorage en componentes (PWA usa IndexedDB)
- NO hardcodear IDs de tenant o módulos
- NO crear endpoints que no verifiquen el tenantId