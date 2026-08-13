import { handlers } from '@vectra/auth'

// Forzar Node.js runtime: el authorize usa bcryptjs y @neondatabase/serverless
// con WebSocket (vía PrismaNeon), incompatibles con Edge runtime.
export const runtime = 'nodejs'

// Exportar los handlers GET y POST de NextAuth v5
export const { GET, POST } = handlers
