# Guía de despliegue — Vectra en Vercel

Procedimiento end-to-end para llevar el monorepo de `localhost` a producción.
Asume que ya tenés:
- Cuenta de Vercel con permisos para crear proyectos.
- Cuenta de Neon con `NEON_API_KEY` activa (usada para provisionar DBs por tenant).
- Dominio registrado y acceso al panel DNS del registrar.

---

## 1. Dominio y DNS

Vectra necesita **dos subdominios fijos + wildcard**:

| Host | Para |
|---|---|
| `admin.tu-dominio.co` | Panel del superadmin |
| `*.tu-dominio.co` | Cada tenant (ej: `acme.tu-dominio.co`, `gomez2026.tu-dominio.co`) |

En el panel DNS del registrar, crear:

```
Tipo   Nombre   Valor                       TTL
CNAME  admin    cname.vercel-dns.com.       300
CNAME  *        cname.vercel-dns.com.       300
```

Vercel también acepta records `A 76.76.21.21` si el registrar no soporta CNAME en root. Para subdominios siempre preferir CNAME.

---

## 2. Proyecto en Vercel

1. **Importar el repo** desde GitHub/GitLab/Bitbucket.
2. **Framework Preset:** Next.js (auto-detectado).
3. **Root Directory:** `apps/web` — IMPORTANTE: el monorepo Turborepo necesita esto.
4. **Build & Output:** dejar los defaults; `vercel.json` en la raíz ya define el `buildCommand` con `pnpm turbo run build --filter=@vectra/web...`.
5. **Install Command:** `pnpm install --frozen-lockfile` (ya en `vercel.json`).
6. **Node version:** 20 o superior (Vercel default actual).

Después del primer deploy, en **Project Settings → Domains**:
- Agregar `admin.tu-dominio.co`.
- Agregar `*.tu-dominio.co` (wildcard).

Vercel verifica DNS automáticamente y emite certificados Let's Encrypt para ambos.

---

## 3. Variables de entorno

En **Project Settings → Environment Variables**, marcar todas como **Production** (y opcionalmente **Preview** si vas a tener staging):

Copiar literalmente las claves de [.env.production.example](../.env.production.example). Las críticas (validadas en boot por `apps/web/lib/assert-env.ts`):

- `DATABASE_URL_SUPERADMIN` y `DATABASE_URL` (mismo valor — Prisma CLI usa la segunda)
- `NEXTAUTH_SECRET` (32+ chars, **no** el placeholder de desarrollo)
- `NEXTAUTH_URL` (= `https://admin.tu-dominio.co`)
- `ENCRYPTION_KEY` (32 bytes hex — **mismo valor** que se usó al crear los tenants existentes; rotarla invalida los datos cifrados)
- `NEON_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `TENANT_BASE_DOMAIN` (= `.tu-dominio.co`, con punto inicial)

Opcionales por módulo (si no las activás aún, no fallan en boot):
- `GROQ_API_KEY` (módulo DIA_E)
- `ZHIPU_API_KEY` (módulo ANALYTICS y DIA_E)

Si dejás alguna **crítica** vacía, el server aborta el boot con un mensaje detallado en los logs de Vercel (`assertEnv` en `instrumentation.ts`).

---

## 4. Generar `ENCRYPTION_KEY` y `NEXTAUTH_SECRET`

Solo la primera vez:

```bash
# ENCRYPTION_KEY (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# NEXTAUTH_SECRET (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Guardar ambas en un manager de contraseñas.** Si se pierde `ENCRYPTION_KEY`:
- Las connection strings cifradas de tenants se vuelven irrecuperables → cada tenant pierde acceso a su DB.
- Las cédulas, teléfonos y datos de tesoreros cifrados se vuelven blobs inservibles.

No hay forma de recuperarlas después.

---

## 5. Migraciones y seed inicial

Antes del primer tenant real, hay que preparar la **DB del superadmin**:

```bash
# Desde la raíz del monorepo, con .env apuntando a la DB de superadmin productiva:
pnpm --filter @vectra/db exec prisma migrate deploy
pnpm db:seed                          # carga DIVIPOLA + 1 material de formación de muestra
pnpm db:create-superadmin             # CLI interactivo: pide email + password ≥ 12 chars
```

El primer login en `admin.tu-dominio.co/login` se hace con esas credenciales.

---

## 6. Crear el primer tenant (smoke test)

Desde `admin.tu-dominio.co/clientes/nuevo`:

1. Llenar el formulario (nombre, slug, email del admin del tenant, módulos activos).
2. Enviar.
3. El [provisionTenantDatabase](../packages/db/src/neon-provisioner.ts) real:
   - Crea un proyecto Neon nuevo `vectra-<slug>`.
   - Aplica las migraciones a esa DB.
   - Carga DIVIPOLA (33 deptos + 1.103 municipios).
   - Cifra la connection string y la guarda en `Tenant.connectionString`.
4. El portal del tenant queda en `<slug>.tu-dominio.co`.

Si algo falla, hay rollback automático: el proyecto Neon recién creado se elimina.

---

## 7. Verificación post-deploy

| Verificar | Cómo |
|---|---|
| Boot exitoso | Logs del primer deploy NO contienen `[assertEnv]` con errores |
| Mock provisioner desactivado | Crear un tenant de prueba — debe aparecer un proyecto nuevo en `console.neon.tech` |
| Cifrado funcionando | Crear un elector via UI — `Voter.cedula` en DB debe ser un blob base64, no la cédula plana |
| TLS y DNS | `curl -I https://admin.tu-dominio.co` retorna 200/302 con HSTS |
| Headers de seguridad | Devuelve `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |
| PWA | `https://<tenant>.tu-dominio.co/sw.js` retorna el service worker |

---

## 8. Apagar el mock provisioner para siempre

No requiere cambio de código: con `NEON_API_KEY` definida, el branching en [apps/web/app/superadmin/actions.ts](../apps/web/app/superadmin/actions.ts#L74-L76) ya enruta al provisioner real. La guarda en [packages/db/src/neon-provisioner.ts](../packages/db/src/neon-provisioner.ts) **rechaza con error** si alguien intenta invocar el mock con `NODE_ENV=production`.

---

## 9. Backups

Neon hace backups automáticos por proyecto, pero la DB del **superadmin** es el punto único de falla (sin ella, las connection strings cifradas de los tenants se pierden). Mínimo:

- Activar **Point-in-time restore** en el proyecto Neon del superadmin.
- Documentar el procedimiento de restauración en runbook interno.
- Backup adicional cifrado (`pg_dump` periódico) si el plan Neon no incluye PITR.

Pendiente de definir (ver [ESTADO_DESARROLLO.md](ESTADO_DESARROLLO.md)): plan específico para la noche del Día E.
