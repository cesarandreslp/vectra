// Exportaciones públicas del paquete @vectra/auth
export { handlers, signIn, signOut, auth, SUPERADMIN_TENANT_ID } from './config'
export type { UserRole, CustomPermissions } from './config'
export { nuevoSecreto, verificarTotp, uriTotp } from './totp'
