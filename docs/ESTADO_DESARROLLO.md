# Estado de desarrollo — Vectra

> Snapshot: 2026-04-27
> Branch: `main` · Último commit: `8ff80c5 feat: módulo Finanzas`

## Resumen ejecutivo

**Cumplimiento global estimado: ~88 %**

El backend, el modelo de datos y todas las UIs por módulo están implementados. Lo que queda es **endurecimiento, despliegue y datos de producción** (no construcción de funcionalidad nueva).

---

## Cumplimiento por componente

### Infraestructura y plataforma

| Componente | Estado | % |
|---|---|---|
| Monorepo Turborepo + pnpm workspaces | Completo | 100 |
| Next.js 15 App Router + TS strict | Completo | 100 |
| Tailwind v4 (sin config, en `globals.css`) | Completo | 100 |
| Prisma + Neon (pooled, driver adapter) | Completo | 100 |
| Vercel Blob (referenciado en schema) | Pendiente verificar token en producción | 80 |
| PWA con Serwist (`app/sw.ts`) | Implementado, falta prueba offline real | 80 |

### Multi-tenancy y seguridad

| Componente | Estado | % |
|---|---|---|
| Cifrado AES-256-GCM (`packages/db/crypto.ts`) | Completo | 100 |
| Provisioner Neon (real + mock) | Completo (mock activo por defecto) | 100 |
| Middleware resolución por Host header | Completo (admin.* / [slug].*) | 100 |
| Cache de tenants (TTL 5 min) | Completo | 100 |
| NextAuth v5 (superadmin + tenant) | Completo (memoria estaba desactualizada) | 100 |
| Cifrado PII en reposo (cédula, teléfono, donante) | Schema marca campos; verificar uso real en cada Server Action | 85 |

### Superadmin (`admin.*`)

| Ruta | Estado |
|---|---|
| `/superadmin/login` | OK |
| `/superadmin` (dashboard) | OK |
| `/superadmin/clientes` (lista + toggle) | OK |
| `/superadmin/clientes/nuevo` (form + slug-input) | OK |
| `/superadmin/clientes/[id]` | OK |
| `/superadmin/formacion` (materiales globales) | OK |

**Subtotal: 100 %**

### Módulo CORE (obligatorio)

| Funcionalidad | Estado |
|---|---|
| DIVIPOLA (Department/Municipality/Commune/Neighborhood) | Schema OK · Verificar **seed completo** de los 32 deptos / 1.103 municipios |
| Puestos y mesas (VotingStation/VotingTable) | Schema OK |
| Líderes (jerarquía padre/hijos) | UI + acciones OK |
| Electores (con `cedulaHash` SHA-256 para dedupe) | UI + acciones OK |
| QR de captación + alerta de duplicados | UI + endpoint API OK |
| Importar Excel | UI + `api/core/importar-excel` OK |
| PWA `/pwa/electores` (modo testigo offline) | Página existe; faltan pruebas E2E offline |

**Subtotal: ~92 %** (lo que baja es el seed DIVIPOLA y el QA offline)

### Módulo ANALYTICS

| Funcionalidad | Estado |
|---|---|
| `/analytics` dashboard | OK |
| `/analytics/lideres` + `[id]` | OK |
| `/analytics/proyeccion` | OK |
| `/analytics/territorio` (mapa de calor) | OK · Verificar dataset real de coords |
| `/analytics/configuracion` | OK |
| Agente IA Zhipu Flash (`LeaderAnalysis`) | `packages/ai/zhipu.ts` OK · Cache 24h en schema |

**Subtotal: ~90 %**

### Módulo FORMACIÓN

| Funcionalidad | Estado |
|---|---|
| Materiales globales (superadmin) + tenant | OK |
| `TenantMaterialPreference` (ocultar/reordenar) | OK |
| Sesiones + asistencia | OK |
| Quiz + intentos (server-side scoring) | OK |
| Certificados PDF (Vercel Blob) | OK · `api/formacion/certificado` |
| Reportes | OK |

**Subtotal: ~95 %**

### Módulo DÍA E

| Funcionalidad | Estado |
|---|---|
| Sala de situación | OK |
| Asignaciones de testigos (titular/suplente) | OK |
| Configuración de candidatos | OK |
| Vista del testigo | OK |
| Transmisión E-14 (manual + foto) | OK |
| Consenso Groq + Zhipu (`packages/ai/e14-consensus.ts`) | OK · resultados crudos en auditoría |
| Incidentes | OK |
| Resultados agregados (`ElectionResult`) | OK |

**Subtotal: ~92 %** (falta simulacro end-to-end con foto real + benchmarks de IA)

### Módulo COMUNICACIONES

| Funcionalidad | Estado |
|---|---|
| Plantillas | OK |
| Campañas segmentadas (filtros por líder/zona/compromiso) | OK |
| Automatizaciones (NUEVO_ELECTOR, etc.) | OK |
| Configuración SMTP | OK · `TenantConfig.smtpConfig` cifrado |
| `packages/messaging` (dispatcher + providers) | OK |
| Cifrado del campo `to` | Schema marca cifrado · validar en dispatcher |

**Subtotal: ~88 %** (faltan pruebas reales de envío SMS/WhatsApp con proveedor)

### Módulo FINANZAS

| Funcionalidad | Estado |
|---|---|
| `/finanzas` dashboard | OK |
| Gastos (8 categorías + estados) | OK |
| Donaciones (persona natural/jurídica/aporte propio) | OK |
| Topes legales CNE (`FinanceConfig.topeGastos`) | OK |
| Comprobantes en Vercel Blob | OK · `api/finanzas/upload-comprobante` |
| Informes PDF (parcial/final/CNE) | OK · `api/finanzas/generar-informe` |
| Cifrado `cedulaTesorero` / `cuentaBancaria` / `donorId` | Marcado en schema · validar en acciones |

**Subtotal: ~90 %**

---

## Lo que NO está hecho

### Bloqueantes para producción

1. **NEON_API_KEY real** — actualmente `mockProvisionTenantDatabase` está activo. Sin esto, crear un cliente NO crea base de datos real.
2. **NEXTAUTH_SECRET de producción** — placeholder, debe rotarse.
3. **Dominio + DNS** — `*.vectra.com.co` o el dominio definitivo. Hoy solo funciona en `*.localhost:3000`.
4. **Seed DIVIPOLA completo** — verificar que `packages/db/prisma/seed.ts` cargue los 32 departamentos y 1.103 municipios reales (no solo muestra).

### Calidad y QA pendientes

5. `pnpm lint` y `pnpm build` limpios en todo el monorepo (validar en CI).
6. Pruebas E2E del flujo crítico: login tenant → registrar elector vía QR → ver en mapa.
7. Pruebas offline reales de la PWA (registrar electores sin conexión + sync al volver).
8. Simulacro E-14 completo: foto real → consenso Groq+Zhipu → resultado final.
9. Benchmarks de costo/latencia de Groq y Zhipu con muestras reales de actas colombianas.
10. Auditoría de cifrado PII: revisar que TODA Server Action que escribe `cedula`, `phone`, `to`, `cedulaTesorero`, `cuentaBancaria`, `donorId` llame `encrypt()` antes del `.create()`.

### Operacional

11. CI/CD a Vercel (preview por PR + producción en `main`).
12. Backups automatizados de la DB superadmin (las DBs tenant son responsabilidad de Neon).
13. Monitoreo (logs estructurados + alertas).
14. Documentación de onboarding para que un nuevo cliente sepa qué subdominio usar.
15. ~~Pasarela de pagos~~ — **DESCARTADO**: contratos verbales, el superadmin habilita tenants manualmente.

---

## Cómo proceder — orden recomendado

### Fase 1 — Cierre técnico (1-2 semanas)

- [x] **Auditoría de cifrado PII** (cerrada 2026-04-27 — ver sección abajo).
- [x] **Seed DIVIPOLA real** completo (33 deptos + 1.103 municipios cargados desde [packages/db/data/divipola.json](packages/db/data/divipola.json) vía [packages/db/src/seed-divipola.ts](packages/db/src/seed-divipola.ts); también se ejecuta en cada nueva DB tenant desde el provisioner real).
- [ ] `pnpm lint && pnpm build` verde en todo el monorepo.
- [ ] Smoke test manual de cada módulo en `localhost`.

### Fase 2 — Despliegue piloto (1 semana)

- [ ] Provisionar dominio definitivo + DNS wildcard.
- [ ] Configurar variables en Vercel: `DATABASE_URL_SUPERADMIN`, `ENCRYPTION_KEY`, `NEON_API_KEY`, `NEXTAUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `GROQ_API_KEY`, `ZHIPU_API_KEY`.
- [ ] Quitar mock provisioner: validar que `provisionTenantDatabase` real cree DB en Neon.
- [ ] Crear primer tenant piloto y correr el flujo completo.

### Fase 3 — QA y simulacros (2 semanas)

- [ ] Simulacro Día E con datos sintéticos: 1 puesto, 5 mesas, 5 testigos, 5 fotos de E-14.
- [ ] Pruebas offline de la PWA con red apagada.
- [ ] Pruebas de envío real de SMS/WhatsApp/email con tope bajo.

### Fase 4 — Lanzamiento (1 semana)

- [ ] Onboarding del primer cliente real.
- [ ] Documentación de uso para cada rol (ADMIN_CAMPANA, COORDINADOR, LIDER, TESTIGO).
- [ ] Plan de soporte / oncall para Día E.

---

## Auditoría PII (2026-04-27) — cerrada

### Cifrado en escritura — OK en todos los puntos

| Modelo · Campo | Lugares verificados |
|---|---|
| `Voter.cedula` + `cedulaHash` | `registro/[token]/actions.ts`, `core/importar/_lib/excel.ts`, `core/actions.ts` (create + createMany) |
| `Voter.phone` | mismos 4 puntos |
| `Leader.phone` | `core/actions.ts` create + update |
| `Donation.donorId` | `finanzas/actions.ts` |
| `FinanceConfig.cedulaTesorero` + `cuentaBancaria` | `finanzas/actions.ts` |
| `Message.to` | `comunicaciones/actions.ts` |
| `TenantConfig.smtpConfig.passwordEncrypted` | `comunicaciones/actions.ts` |

Updates que NO tocan PII (`commitmentStatus`, `lastContact`, `notes`) verificados como limpios en `core/sync`, `core/electores/[id]/compromiso`, `core/actions.ts:388`.

### Hallazgos corregidos

1. **`listVoters` enviaba `phone` cifrado al cliente sin uso** → eliminado del `select` y del tipo `VoterSummary` ([apps/web/app/(tenant)/core/actions.ts:79-89](apps/web/app/(tenant)/core/actions.ts#L79-L89), [apps/web/app/(tenant)/core/actions.ts:430-440](apps/web/app/(tenant)/core/actions.ts#L430-L440)).
2. **`mis-electores` enviaba `phone` cifrado a la PWA**, que lo usaba como `tel:href` → click-to-call estaba marcando ciphertext. Ahora se descifra server-side antes de responder ([apps/web/app/api/core/mis-electores/route.ts](apps/web/app/api/core/mis-electores/route.ts)). Trade-off aceptado: el phone queda en IndexedDB del dispositivo del testigo (costo natural de PWA offline), pero sigue cifrado en reposo en DB y viaja por TLS.

### Lecturas que descifran server-side (correcto)

- `comunicaciones/actions.ts:218` — `decrypt(v.phone)` en builder de destinatarios; solo vive en memoria del server hasta el envío.
- `finanzas/actions.ts:619` y `api/finanzas/generar-informe/route.ts:59` — `decrypt(config.cedulaTesorero)` para informes PDF; no se devuelve al cliente.
- `lib/tenant.ts:99,167` — `decrypt(connectionString)` exclusivo del runtime server.

### Conclusión

Cifrado en reposo, en wire y en uso está alineado con Ley 1581/2012. No quedan filtraciones de PII conocidas.

---

## Guarda de entorno en producción (2026-04-27)

Dos defensas contra arrancar el server malconfigurado:

1. **Boot-time** — [apps/web/instrumentation.ts](apps/web/instrumentation.ts) llama a [`assertEnv()`](apps/web/lib/assert-env.ts) una sola vez al iniciar el runtime Node.js. Valida `DATABASE_URL_SUPERADMIN`, `NEXTAUTH_SECRET` (rechaza el placeholder), `ENCRYPTION_KEY`, `NEON_API_KEY`, `BLOB_READ_WRITE_TOKEN`. En `NODE_ENV=production` lanza Error y aborta el boot; en desarrollo solo emite warning.
2. **Runtime** — `mockProvisionTenantDatabase` rechaza con `TenantProvisionError` si se invoca con `NODE_ENV=production`. Cubre el caso de que código futuro caiga al mock por error de configuración o de branching.

Combinadas, garantizan que en producción **es imposible** crear un tenant en modo mock o arrancar con cifrado/sesiones inseguros.

---

## Decisiones tomadas (2026-04-27)

1. **Sin pasarela de pagos.** Contratos verbales. El superadmin crea y habilita tenants manualmente desde su panel.
2. **Multi-tenant con DB individual obligatoria.** Cada tenant = una base Neon propia. NO se permite aislamiento por `tenantId` en DB compartida. El mock provisioner solo aplica en desarrollo local.

## Decisiones pendientes

1. **Política de retención de datos PII** post-elección (Ley 1581/2012).
2. **¿Multi-elección por tenant?** — Hoy `TenantConfig.fechaEleccion` es única; un cliente que haga elecciones consecutivas (alcaldía 2027 → senado 2030) ¿reusa tenant o crea uno nuevo?
3. **Plan de backup** específico para la noche del Día E (volumen alto de E-14 entrando).

---

## Inventario de funcionalidades (2026-08-06)

> Snapshot: 2026-08-06 · Branch `main` · Último commit `dfbf677`
> El producto se renombró a **Vectra**. Las secciones anteriores fueron escritas
> con el nombre viejo; el 2026-08-13 se hizo el reemplazo en todo el repo, así
> que hoy también dicen «Vectra» aunque sean anteriores al rebrand.

### Conteo de artefactos (verificado, no estimado)

| Artefacto | Cantidad |
|---|---|
| Rutas API (`api/**/route.ts`) | 16 |
| Páginas (`page.tsx`) | 60 |
| · superadmin | 5 |
| · tenant | 51 |
| · públicas (landing, login, no-autorizado) | 3 |
| Ficheros de Server Actions | 9 |
| Modelos Prisma | 44 |
| Enums Prisma | 7 |

### Módulos según el catálogo central

Espina dorsal: [apps/web/app/superadmin/modules.ts](apps/web/app/superadmin/modules.ts).
Son **7** módulos, uno más que los seis documentados en las secciones de abril:
`ENCUESTAS` (bot de WhatsApp con IA) se añadió después — ver
[docs/MODULO_ENCUESTAS.md](docs/MODULO_ENCUESTAS.md).

| Módulo | Páginas | Implementación verificada |
|---|---|---|
| CORE | 8 | `(tenant)/core/**` + 6 rutas en `api/core/*` |
| ANALYTICS | 6 | `(tenant)/analytics/**` |
| FORMACION | 9 | `(tenant)/formacion/**` + `api/formacion/certificado` |
| DIA_E | 6 | `(tenant)/dia-e/**` + `api/dia-e/upload-foto` |
| COMUNICACIONES | 8 | `(tenant)/comunicaciones/**` + `api/webhooks/whatsapp` |
| FINANZAS | 7 | `(tenant)/finanzas/**` + 2 rutas API |
| ENCUESTAS | 5 | `(tenant)/encuestas/**` + `api/encuestas/cron` |
| (PWA, transversal a CORE) | 2 | `(tenant)/pwa/**` |

### Arquitectura transversal (sostiene a todos, no es un módulo)

- **Auth**: NextAuth v5 en `packages/auth`. Login universal en `/login`; el rol
  decide el destino. Cierre de sesión en el shell desde `dfbf677`.
- **Multi-tenant**: `apps/web/middleware.ts` + `apps/web/lib/tenant.ts`.
- **Cifrado**: `packages/db/src/crypto.ts` (AES-256-GCM).
- **Provisioning**: `packages/db/src/neon-provisioner.ts`.
- **Shell de UI**: `apps/web/app/_components/app-shell.tsx` — lo comparten el
  superadmin y los 7 módulos, así que un fallo ahí afecta a las 56 páginas internas.

### Activos de prueba existentes

Solo **uno**: [apps/web/middleware.test.ts](apps/web/middleware.test.ts), añadido
hoy al corregir el bucle de redirecciones. No hay Playwright, Vitest ni Jest
configurados. El plan de abajo NO asume suite automatizada previa.

---

## HALLAZGOS (2026-08-06) — abiertos

1. **El tenant `demo-campana` viola la Decisión 2 de 2026-04-27.** Su
   `connectionString` apunta a la MISMA base que el superadmin
   (`ep-quiet-scene-amy3b3j5…/neondb`), no a una base Neon propia. Nació del seed
   ([packages/db/prisma/seed.ts](packages/db/prisma/seed.ts)), que usa
   `DATABASE_URL_SUPERADMIN` como placeholder. Cualquier prueba de aislamiento
   hecha sobre este tenant dará un falso negativo. Estado: **ABIERTO**.

2. **Crear un cliente en producción provisiona un proyecto Neon real.**
   Verificado: `NEON_API_KEY` está definida en el proyecto Vercel `vectra-web`
   (cuenta `ceanlozanopu-9130`, team `team_BWwyWl5wYDp8DvggmGcGQ7Z6`), en
   Production y Preview. Por tanto
   [superadmin/actions.ts:75](apps/web/app/superadmin/actions.ts#L75) toma la rama
   real y no el mock, y cada cliente crea un proyecto Neon nuevo (llamado
   `campaignos-<slug>` entonces; hoy `vectra-<slug>`). Estado: **ABIERTO**.

   *Corrección (2026-08-06):* una versión anterior de este hallazgo afirmaba que
   «la cuenta ya tiene 9 proyectos». Ese conteo salió de la `NEON_API_KEY` del
   `.env` **local**, que es una clave de organización de
   `org-fragrant-hat-12076614` y lista proyectos de otro portafolio
   (`contratacion`, `cartera`, `psicosports`…). Los valores de entorno en Vercel
   están cifrados y el CLI los devuelve vacíos, así que **no se puede comprobar
   desde aquí** si es la misma clave. El cupo de proyectos de la cuenta Neon que
   usa producción sigue **sin verificar**: hay que mirarlo en la consola de Neon
   de la cuenta correcta antes de crear tenants de prueba.

2b. **La `NEON_API_KEY` local puede apuntar a otra organización que la de
   producción.** Si es así, provisionar un tenant desde local crearía el proyecto
   en la cuenta equivocada. Confirmar antes de usar `pnpm dev` para pruebas que
   creen clientes. Estado: **ABIERTO**.

2c. **El historial de migraciones de Prisma está obsoleto.** Las 3 migraciones de
   `packages/db/prisma/migrations/` crean **14 tablas**, pero el schema declara
   **44 modelos**: Finanzas, Formación, Comunicaciones y Encuestas nunca se
   migraron. La última es del 2026-04-02. En la práctica el proyecto se sincroniza
   con `prisma db push`, no con migraciones.

   Consecuencias: sobre una base nueva hay que usar `pnpm db:push` — `db:migrate`
   dejaría la base incompleta. Y mientras el historial siga roto no hay forma de
   aplicar cambios de schema de forma reproducible ni de revertirlos.
   Estado: **ABIERTO**.

3. ~~**El nombre del proyecto Neon seguía siendo `campaignos-<slug>`**~~
   ([neon-provisioner.ts:110](packages/db/src/neon-provisioner.ts#L110)).
   **CERRADO (2026-08-13)**: ahora crea `vectra-<slug>`. Los dos proyectos que ya
   existían en Neon se habían renombrado a mano antes, así que no quedó ninguno
   con el nombre viejo.

4. **Referencias obsoletas en este documento**: `/superadmin/login` (hoy el login
   es universal en `/login`) y `*.vectra.com.co` (hoy `NEXT_PUBLIC_TENANT_BASE_DOMAIN`,
   con `vectra.com.co` por defecto). Se registran aquí en vez de editar las
   secciones de abril. Estado: **ABIERTO**.

---

## PLAN — Pruebas funcionales una por una (2026-08-06)

> Estado: **PENDIENTE**
> Premisa acordada con el usuario: Claude crea los usuarios; **el usuario digita
> todas las contraseñas**. Claude nunca introduce ni almacena contraseñas.
> La base es la de producción y hoy no tiene datos reales.

### Regla de datos de prueba

Todo lo creado durante el plan debe ser **identificable y borrable**:

- Emails de prueba: `<rol>@prueba.vectra` (dominio inexistente a propósito, no
  recibe correo real).
- Slugs de tenant de prueba: prefijo `qa-` (por ejemplo `qa-piloto-2026`).
- Al cerrar cada capa se registra aquí qué quedó creado.
- La Capa 7 borra todo, incluidos **los proyectos Neon**, que no desaparecen al
  borrar el tenant de la base.

### Capa 0 — Habilitadores (bloquea todo lo demás)

- [ ] **Script `db:create-user`**: crea usuario con rol y tenant elegidos,
      pidiendo la contraseña por consola con eco oculto. Hoy solo existe
      `db:create-superadmin`, que fuerza rol `SUPERADMIN`
      ([packages/db/src/create-superadmin.ts](packages/db/src/create-superadmin.ts)),
      así que **no hay forma de crear ADMIN_CAMPANA, COORDINADOR, LIDER ni TESTIGO**.
- [ ] Confirmar en la consola de Neon **de la cuenta que usa producción** cuál es
      el cupo de proyectos del plan (Hallazgo 2) y verificar si la `NEON_API_KEY`
      del `.env` local es esa misma o la de otra organización (Hallazgo 2b).
- [ ] Decidir si el tenant de pruebas se crea desde el panel (provisiona Neon real,
      que es la metodología acordada en abril) o si se prueba primero sin crear tenant.

### Capa 1 — Autenticación y autorización

- [ ] Login correcto por cada rol y destino esperado.
- [ ] Login con contraseña equivocada: mensaje genérico, sin revelar si el email existe.
- [ ] Usuario con `isActive: false`: no entra.
- [ ] Matriz rol × ruta: un LIDER no entra a `/superadmin` ni a `/finanzas`; un
      TESTIGO solo a lo suyo. Verificar `/no-autorizado`.
- [ ] Cerrar sesión desde el sidebar y desde la barra superior.
- [ ] Ruta protegida sin sesión: `/login?callbackUrl=…` y vuelta al destino tras entrar.

### Capa 2 — Aislamiento entre tenants

> Depende del Hallazgo 1: sobre `demo-campana` esta capa NO es concluyente.

- [ ] Crear un segundo tenant `qa-piloto-2026` y comprobar que su base es distinta.
- [ ] Usuario del tenant A no ve datos del tenant B.
- [ ] Cambiar el subdominio a mano no cambia el tenant efectivo (la verdad es el JWT).

### Capa 3 — Recorrido funcional por módulo (escritura real, no solo que cargue)

- [ ] **Superadmin**: crear cliente, activar y desactivar módulos, desactivar cliente,
      materiales globales de formación.
- [ ] **CORE**: DIVIPOLA (33 deptos / 1.103 municipios), crear líder y sublíder,
      registrar elector, QR de captación, alerta de duplicado por `cedulaHash`,
      importar Excel.
- [ ] **PWA**: registrar electores con la red apagada y sincronizar al volver
      (pendiente desde la Fase 3 de abril).
- [ ] **ANALYTICS**: KPIs con datos reales, mapa de calor, proyección, agente IA
      de fidelidad (Zhipu).
- [ ] **FORMACION**: sesión, asistencia, quiz, certificado PDF en Blob.
- [ ] **DIA_E**: candidatos, asignar testigos, transmitir E-14 con foto, consenso
      Groq+Zhipu, incidente, resultado agregado.
- [ ] **COMUNICACIONES**: plantilla, campaña segmentada, automatización, SMTP.
      Envío real con tope bajo.
- [ ] **FINANZAS**: config con tope CNE, gasto con comprobante, donación, informe PDF.
- [ ] **ENCUESTAS**: campaña, webhook de WhatsApp, emparejado de candidato por IA,
      resultados.

### Capa 4 — Seguridad

- [ ] Verificar que cada Server Action comprueba tenantId + rol + módulo activo
      (regla de CLAUDE.md).
- [ ] Módulo desactivado: sus rutas no responden aunque se escriba la URL.
- [ ] `api/webhooks/whatsapp` y `api/encuestas/cron` sin autenticar: rechazan.
- [ ] Re-verificar cifrado PII en escritura (la auditoría de abril quedó cerrada;
      confirmar que sigue válida).

### Capa 5 — Rendimiento

- [ ] Importar Excel con volumen realista (miles de electores) y medir.
- [ ] Listados con paginación: `DataTable` no la tiene
      ([packages/ui/src/data-table.tsx](packages/ui/src/data-table.tsx)) — verificar
      a partir de qué volumen empieza a doler.

### Capa 6 — Visual, responsive y accesibilidad

- [ ] Recorrer los 7 módulos en móvil: las páginas internas de tenant nunca se han
      revisado visualmente, solo el shell que comparten.
- [ ] Contraste de la paleta granate/oliva/plata.
- [ ] Instalar la PWA en Android y en iOS y verificar el icono.

### Capa 7 — Limpieza

- [ ] Borrar usuarios `@prueba.vectra` y tenants `qa-`.
- [ ] **Borrar los proyectos Neon** de los tenants de prueba desde la consola.
- [ ] Registrar aquí el estado final.

### Orden de ejecución sugerido

Capa 0 → 1 → 2 → 3 (Superadmin, luego CORE, luego el resto de módulos, porque
todos dependen de que existan líderes y electores) → 4 → 5 → 6 → 7.

Cada hallazgo nuevo se registra en este documento como entrada fechada con su
tipo (`HALLAZGO`/`CAMBIO`/`DECISIÓN`) y su estado, sin editar las anteriores.

---

## EJECUCIÓN DE PRUEBAS (2026-08-06)

Contexto: la base de producción se migró a la cuenta `ceanlozanopu-9130`
(Neon `ep-hidden-frost-aywab8uf`, us-east-2). Schema + DIVIPOLA cargados; tenant
`demo-campana` con solo CORE activo. Usuarios creados: `super@vectra.com`
(SUPERADMIN) y cuatro de prueba en `demo-campana`
(`admin@ / coordinador@ / lider@ / testigo@prueba.vectra`).

### CAMBIO — habilitador `db:create-user`

Se añadió [packages/db/src/create-user.ts](packages/db/src/create-user.ts) y el
script `db:create-user` para crear usuarios de cualquier rol (pide la contraseña
por consola, eco oculto). Cierra el bloqueante de la Capa 0. Los helpers de
consola se extrajeron a [packages/db/src/prompt.ts](packages/db/src/prompt.ts) y
`create-superadmin.ts` ahora los reutiliza. Debe correrse con stdin real
(`node_modules\.bin\tsx.CMD src\create-user.ts`), no vía `pnpm run` (se come el stdin).

### Capa 1 — resultados

| Test | Resultado |
|---|---|
| 6 · ruta protegida sin sesión (`/superadmin`, `/core`) | ✅ → `/login?callbackUrl=…` |
| 2 · contraseña incorrecta (email real vs. inexistente) | ✅ mismo mensaje genérico, sin enumeración |
| 1 · login `admin@prueba.vectra` | ⚠️ redirige a `/core` (destino correcto) pero **la página da 404** — ver HALLAZGO 5 |

### HALLAZGO 5 — `/core` (Dashboard) no existe: 404 tras login para TODO rol de tenant. **BLOQUEANTE**

`app/(tenant)/core/` no tiene `page.tsx` en su raíz; solo subrutas
(`electores`, `lideres`, `qr`, `importar`). Pero
[app/page.tsx:21](apps/web/app/page.tsx#L21) y
[app/login/page.tsx:27](apps/web/app/login/page.tsx#L27) redirigen a `/core` a
todo usuario no-SUPERADMIN tras el login, y el nav de CORE lista
`{ href: '/core', label: 'Dashboard' }`
([core/layout.tsx:19](apps/web/app/(tenant)/core/layout.tsx#L19)). Resultado:
los cuatro roles de tenant aterrizan en un 404 nada más entrar. Verificado en
producción con `admin@prueba.vectra`. Estado: **CERRADO** (commit `6531554`).

*Resolución (2026-08-06):* se creó
[app/(tenant)/core/page.tsx](apps/web/app/(tenant)/core/page.tsx) — Dashboard con
conteos (líderes/electores/puestos/mesas) vía la acción `getCoreStats()`.
Desplegado a producción (`vercel --prod`, el proyecto NO auto-despliega desde
git push) y verificado: `/core` ahora carga el Dashboard.

### HALLAZGO 6 — `/core/alertas` en el nav pero sin página → 404

El nav de CORE incluye `{ href: '/core/alertas', label: 'Alertas', badge }`
([core/layout.tsx:28](apps/web/app/(tenant)/core/layout.tsx#L28)) pero no existe
`app/(tenant)/core/alertas/`. Clic en "Alertas" → 404. Estado: **CERRADO**.

*Resolución (2026-08-06):* se creó
[app/(tenant)/core/alertas/page.tsx](apps/web/app/(tenant)/core/alertas/page.tsx),
que lista las notificaciones no leídas reusando `/api/notificaciones` (misma
fuente que el badge del sidebar).

### Capa 3 — recorrido funcional ADMIN sobre CORE (producción, tenant `demo-campana`)

| Funcionalidad | Resultado |
|---|---|
| Dashboard `/core` | ✅ carga (tras fix H5) |
| Líderes — crear | ✅ `QA Líder 1` creado; **teléfono cifrado en reposo** (AES-256-GCM) |
| Líderes — jerarquía padre/hijo | ✅ `QA Sublíder 1.1` → padre `QA Líder 1` |
| Electores — crear | ✅ `QA Elector Uno`; **cédula y teléfono cifrados**, `cedulaHash` presente |
| Electores — dedupe por cédula | ✅ misma cédula → "Ya existe un elector con esa cédula"; no crea duplicado |
| QR de captación — generar | ✅ genera PNG + URL con token por líder |
| QR/registro — flujo público | ❌ roto — ver HALLAZGO 7 |

Detalle UX menor: el form de "Nuevo elector"/"Nuevo líder" se queda en `/nuevo`
tras crear con éxito, sin mensaje de confirmación visible (la escritura sí ocurre).

### HALLAZGO 7 — captación por QR: `/registro/[token]` nunca resuelve el tenant. **ALTA**

El QR se genera bien (admin), pero su enlace (`…/registro/<uuid>`) lleva a
"Este enlace no corresponde a ninguna campaña" para todos, en cualquier host.

Causa raíz: la página y la acción de registro leen el tenant del header
`x-tenant-id` ([registro/[token]/page.tsx:21](apps/web/app/registro/[token]/page.tsx#L21),
[registro/[token]/actions.ts:57](apps/web/app/registro/[token]/actions.ts#L57)),
pero **ese header no lo setea nadie**: es la única referencia además del comentario
del middleware que dice "NUNCA inyectamos x-tenant-id". Y `/registro/` es ruta
pública, así que el middleware la corta al inicio con `NextResponse.next()`
([middleware.ts:59](apps/web/middleware.ts#L59)) sin resolver tenant.

Como cada tenant tiene su propia DB, sin `tenantId` no hay dónde buscar el token.
El flujo de auto-registro de electores (una funcionalidad CORE anunciada como OK)
es **inutilizable** en producción. `submitRegistration` tiene la misma dependencia,
así que aunque la página cargara, el envío también fallaría.

Opciones de fix (requieren decisión): (a) guardar el mapa `token → tenantId` en la
DB del superadmin y resolver el tenant desde el token; (b) codificar el slug del
tenant en la URL (`/registro/<slug>/<token>`); (c) que el middleware resuelva y
setee `x-tenant-id` para rutas públicas de tenant (solo sirve con subdominio/dominio
configurado). Estado: **CERRADO** (opción variante de b).

*Resolución (2026-08-06):* el slug del tenant se pasa por query param `?c=<slug>`
en la URL del QR, que ahora se construye con el **origin actual** (funciona en
`vercel.app` hoy y en el dominio propio mañana) en vez del subdominio sin DNS
([core/qr/page.tsx](apps/web/app/(tenant)/core/qr/page.tsx)). La página y la acción
de registro resuelven `slug → tenantId` contra `superadminDb.tenant` en vez del
header inexistente
([registro/[token]/page.tsx](apps/web/app/registro/[token]/page.tsx),
[registro/[token]/actions.ts](apps/web/app/registro/[token]/actions.ts)). El link
de referido también arrastra `?c=`. **Verificado E2E en producción** (commit
`c6f898a`): registro real creado por QR con cédula/teléfono cifrados,
`qrTokenUsed` correcto, asignado al líder del QR, y `registrationsCount` +1.

### HALLAZGO 8 — Vercel Blob roto en producción (store privado). **CERRADO**

Todas las subidas a Blob (logo de campaña, comprobantes de Finanzas, certificados
de Formación, fotos de Día E — todas con `access: 'public'`) fallaban con 500. Causa
doble: (1) el `BLOB_READ_WRITE_TOKEN` heredado apuntaba a un store con **acceso
privado**, incompatible con `put(..., { access: 'public' })`; (2) en el `.env` local
estaba entre comillas. Se creó por CLI un store **público** en la cuenta
`ceanlozanopu-9130` (`vectra-blob`, `store_dFVy3TEVrRdA9fPR`), conectado a `vectra-web`
en todos los entornos, y se sincronizó el token (sin comillas) en `.env`. `put` de
prueba OK. Estado: **CERRADO**.

### Features nuevas del panel admin (2026-08-06)

- **#1 Líderes (raíz + árbol multinivel + "+ Sub-líder")** — desplegado. `/core/lideres`
  muestra solo raíces; la ficha despliega el árbol de sub-líderes. Pendiente confirmar E2E.
- **#2 Configuración de campaña** — COMPLETO y desplegado:
  - CRUD (`/core/configuracion`, solo ADMIN): claves Groq/Zhipu cifradas, dominio, logo+color.
  - Branding aplicado en el shell (color reemplaza el granate, logo en el sidebar).
  - Claves de IA por campaña cableadas a los clientes (analytics/Día E/encuestas) con
    fallback a las globales. No verificable en navegador aún (esos módulos están inactivos
    en `demo-campana`).
- **#3 Mapa del dashboard (Leaflet + geocoding de direcciones)** — desplegado.
  `Voter.lat/lng`, campo dirección en el alta manual, helper Nominatim, acción
  `geocodificarPendientes` (lotes de 5, 1 req/s) con botón en el dashboard, y mapa
  Leaflet+OSM con círculos por estado. Geocoding verificado contra Nominatim.

### Nuevos hallazgos abiertos (2026-08-06)

- **HALLAZGO 9 — Ranking de captadores (multinivel) pendiente.** El modelo ya soporta
  captación por cualquier líder (incl. sub-líderes) y por electores (link `?ref=` →
  `referredById`/`captureDepth`), pero NO existe una vista que rankee "quién trae más
  gente" (directos + todo el sub-árbol) con su nivel de profundidad. Acordado construirlo
  después del mapa, con conteo directos + downline completo. El link de referido del
  elector solo se muestra una vez (al registrarse); no hay portal para recuperarlo.
- **Geocoding a escala:** `geocodificarPendientes` es síncrono en lotes de 5 por el rate
  limit de Nominatim; para miles de electores hace falta un cron/queue.
