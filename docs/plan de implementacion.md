# Integración Electoss → Vectra

Migrar el motor de encuestas por WhatsApp de Electoss como un nuevo módulo opcional (`ENCUESTAS`) dentro del monorepo de Vectra, siguiendo la arquitectura multi-tenant existente.

## Resumen del cambio

Electoss tiene su propio Next.js, DB y servicios. La integración implica:
1. Extender el schema Prisma tenant con los modelos de encuestas.
2. Registrar el módulo `ENCUESTAS` en el sistema de módulos.
3. Portar los servicios de conversación/WhatsApp/scheduler a `packages/`.
4. Crear las rutas API (webhook + cron).
5. Crear las rutas UI bajo `(tenant)/encuestas/`.

## Proposed Changes

---

### 1. Schema de base de datos

#### [MODIFY] [schema.prisma](file:///c:/Projects/electoral/packages/db/prisma/schema.prisma)

**Nuevos enum:**
```prisma
enum ConversationState {
  PENDIENTE
  CONTACTADO
  CONSENTIMIENTO_PENDIENTE
  CONSENTIDO
  RESPONDIENDO
  COMPLETADO
  RECHAZADO
}
```

**Nuevos campos en `Voter`:**
- `conversationState ConversationState @default(PENDIENTE)`
- `consent           Boolean           @default(false)`
- `surveyContactDate DateTime?`
- `surveyResponseDate DateTime?`

**Nuevos campos en `TenantConfig`:**
- `whatsappToken       String?`   ← credencial Meta API
- `whatsappPhoneId     String?`
- `whatsappVerifyToken String?`
- `botName             String?   @default("Asistente Virtual")`
- `surveyDailyLimit    Int       @default(250)`

**Nuevos modelos (módulo ENCUESTAS):**
- `SurveyCampaign` — campaña de encuesta (nombre, fecha elección, activa, `isSurveyEnabled`)
- `SurveyCargo` — cargo electoral (Alcaldía, Senado…) con sus preguntas
- `SurveyPregunta` — pregunta individual (texto libre o booleana)
- `SurveyCandidato` — candidato para un cargo con código lista
- `SurveyResponse` — respuesta del elector (+ `candidatoId` detectado por IA)
- `SurveyMessageLog` — log de mensajes enviados/recibidos

---

### 2. Registro del módulo

#### [MODIFY] [actions.ts](file:///c:/Projects/electoral/apps/web/app/superadmin/actions.ts)
Añadir `'ENCUESTAS'` al tipo `ModuleKey`.

#### [MODIFY] [modules.ts](file:///c:/Projects/electoral/apps/web/app/superadmin/modules.ts)
Añadir `{ key: 'ENCUESTAS', label: 'Encuestas WhatsApp', descripcion: 'Bot conversacional de encuestas por WhatsApp con IA' }`.

---

### 3. Servicios (packages)

#### [NEW] `packages/messaging/src/providers/whatsapp-meta.ts`
Implementación real de Meta Cloud API (portado de `electoss/src/services/whatsapp.service.ts`). Soporta mensaje de texto y plantillas. Fallback a YCloud.

#### [MODIFY] `packages/messaging/src/dispatcher.ts`
Actualizar el case `'WHATSAPP'` para usar `WhatsAppMetaProvider` en lugar del abstracto.

#### [NEW] `apps/web/lib/encuestas/conversation-engine.ts`
Motor de estados de conversación adaptado al schema multi-tenant de Vectra (usa `getTenantDb()` y `tenantId`).

#### [NEW] `apps/web/lib/encuestas/candidate-matcher.ts`
Clasificador de respuestas libres con Groq (portado de Electoss).

#### [NEW] `apps/web/lib/encuestas/daily-limit.ts`
Control de límite diario de mensajes por tenant.

---

### 4. API Routes

#### [NEW] `apps/web/app/api/webhooks/whatsapp/route.ts`
- `GET` — verificación del webhook Meta (hub.challenge)
- `POST` — recepción de mensajes entrantes YCloud/Meta, delega al `conversationEngine` con `waitUntil`

#### [NEW] `apps/web/app/api/encuestas/cron/route.ts`
Endpoint llamado por Vercel Cron (o cron-job.org). Corre el scheduler para procesar electores PENDIENTE en lotes de 50. Protegido con `CRON_SECRET`.

---

### 5. Server Actions del módulo

#### [NEW] `apps/web/app/(tenant)/encuestas/actions.ts`
- `getSurveyCampaigns()` — lista campañas de encuesta del tenant
- `createSurveyCampaign()` — crea campaña con cargos/preguntas/candidatos
- `toggleSurveyEnabled()` — activa/desactiva encuesta de una campaña
- `getSurveyResults()` — resultados agregados por candidato
- `saveSurveyConfig()` — guarda credenciales WhatsApp en `TenantConfig`
- `triggerManualBatch()` — dispara un lote manual desde la UI

---

### 6. Rutas UI

#### [NEW] `apps/web/app/(tenant)/encuestas/page.tsx`
Dashboard: resumen de campañas activas, estado de conversaciones, últimas respuestas.

#### [NEW] `apps/web/app/(tenant)/encuestas/configuracion/page.tsx`
Formulario para guardar credenciales WhatsApp (token, phoneId, verifyToken, botName, límite diario). Muestra URL del webhook para configurar en Meta.

#### [NEW] `apps/web/app/(tenant)/encuestas/campanas/page.tsx`
Lista de campañas de encuesta con toggle `isSurveyEnabled` y botón de disparo manual.

#### [NEW] `apps/web/app/(tenant)/encuestas/campanas/nueva/page.tsx`
Formulario wizard: nombre → cargos → preguntas por cargo → candidatos por cargo.

#### [NEW] `apps/web/app/(tenant)/encuestas/resultados/page.tsx`
Gráficas de resultados por cargo y candidato. Funnel de conversación (PENDIENTE → COMPLETADO).

#### [MODIFY] Layout del tenant
Añadir link "Encuestas" al sidebar cuando el módulo `ENCUESTAS` está activo.

---

## Verification Plan

### Automated
```bash
pnpm db:push          # Aplicar schema sin migración
pnpm lint             # Verificar sin errores TypeScript
pnpm build            # Verificar compilación completa
```

### Manual
1. Activar módulo ENCUESTAS desde superadmin para un tenant de prueba.
2. Verificar que aparece el sidebar "Encuestas" en el tenant.
3. Crear una campaña de encuesta con 1 cargo, 2 preguntas y 2 candidatos.
4. Configurar credenciales WhatsApp (pueden ser ficticias para la UI).
5. Verificar que el endpoint webhook responde correctamente a `GET ?hub.verify_token=`.
6. Verificar que el cron endpoint responde `{ status: "skipped" }` si no hay electores pendientes.

## Open Questions

> [!IMPORTANT]
> **Voter vs Elector**: En Electoss los electores están en su propia tabla `Elector`. En Vectra los electores son `Voter`. La integración añade los campos de conversación directamente al modelo `Voter` existente, sin crear una tabla nueva. ¿Estás de acuerdo con este enfoque?

> [!NOTE]
> **Migración vs `db:push`**: El schema ya tiene migraciones. Se puede usar `pnpm db:push` para desarrollo rápido, pero en producción se requerirá `db:migrate` para no perder datos. La integración añade campos con `@default` que son retrocompatibles.

> [!NOTE]
> **`SurveyCampaign` es un modelo separado de `TenantConfig`**: Las campañas de encuesta son N por tenant (múltiples elecciones). La configuración WhatsApp (token, phoneId) va en `TenantConfig` porque es 1:1 por tenant.
