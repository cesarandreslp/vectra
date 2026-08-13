# Módulo ENCUESTAS

El módulo de Encuestas es una integración en Vectra del motor de encuestas automatizado vía WhatsApp (`Electoss`).

Permite a una campaña realizar sondeos de opinión directamente al teléfono de los electores registrados (`Voter`), usando un bot conversacional que pide consentimiento, realiza las preguntas configuradas para los cargos electorales activos, y utiliza la IA (Groq) para procesar las respuestas de texto libre y asociarlas a los candidatos oficiales.

## Arquitectura

El módulo utiliza los siguientes componentes:
1. **Schema de BD (Prisma)**: Integrado en el modelo `Voter` existente, y con nuevos modelos `SurveyCampaign`, `SurveyCargo`, `SurveyPregunta`, `SurveyCandidato`, `SurveyResponse`, `SurveyMessageLog`.
2. **Webhook**: Endpoint `/api/webhooks/whatsapp` recibe los eventos entrantes de WhatsApp de la Meta Cloud API.
3. **Conversation Engine**: Máquina de estados que gestiona el flujo de la encuesta por elector (`PENDIENTE` -> `CONTACTADO` -> `RESPONDIENDO` -> `COMPLETADO`).
4. **Candidate Matcher (IA)**: Utiliza `llama-3.1-8b-instant` vía Groq para interpretar texto libre y devolver el ID del candidato seleccionado.
5. **Scheduler (Cron)**: Tarea programada en `/api/encuestas/cron` que envía el primer mensaje a los electores en estado `PENDIENTE` dentro del horario permitido y respetando el límite diario de mensajes.

## Configuración
La configuración de WhatsApp API (Token, Phone ID, Verify Token) y el límite diario se almacena en el modelo `TenantConfig` de cada campaña.

## Flujo del Elector
1.  **PENDIENTE**: Elector registrado pero no contactado por el módulo de encuestas.
2.  **CONTACTADO / CONSENTIMIENTO_PENDIENTE**: Se le envía un mensaje inicial pidiendo permiso para realizar la encuesta.
3.  **CONSENTIDO**: El elector aceptó participar (Respondió SI).
4.  **RESPONDIENDO**: El elector está respondiendo las preguntas de la encuesta actual.
5.  **COMPLETADO**: Encuesta finalizada, respuestas guardadas.
6.  **RECHAZADO**: Elector no aceptó participar (Respondió NO).

## Referencias
Revisar `apps/web/lib/encuestas/conversation-engine.ts` para los detalles de la máquina de estados.
Revisar `apps/web/lib/encuestas/candidate-matcher.ts` para el prompt enviado a Groq.
