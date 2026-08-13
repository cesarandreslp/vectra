# Vectra — Sistema de Inteligencia Electoral

**Vectra** es una plataforma SaaS (Software as a Service) multi-tenant diseñada para la gestión integral, estratégica y operativa de campañas políticas en Colombia. Su arquitectura aísla los datos de cada campaña en bases de datos independientes (Database-per-Tenant), garantizando la máxima seguridad de la información confidencial y el cumplimiento estricto de la Ley 1581 de 2012 sobre protección de datos personales.

La plataforma transforma la gestión tradicional de una campaña —basada en planillas físicas, hojas de cálculo inconexas y comunicación fragmentada— en un ecosistema digital centralizado. Combina la logística en terreno con capacidades avanzadas de Inteligencia Artificial para optimizar el recurso humano, financiero y comunicacional del candidato.

El sistema está compuesto por un módulo obligatorio (CORE) y seis módulos complementarios que cubren el ciclo de vida completo de una elección.

---

## 1. Módulo CORE (Obligatorio)
Es el núcleo del sistema, encargado de la estructuración territorial y la gestión del capital humano.

*   **Estructura Territorial (DIVIPOLA)**: Mapea la división político-administrativa oficial de Colombia (Departamento → Municipio → Comuna/Corregimiento → Barrio/Vereda → Puesto de Votación → Mesa). Permite organizar la campaña geográfica y estratégicamente.
*   **Gestión de Líderes**: Crea un árbol jerárquico de captación. Cada coordinador territorial o líder barrial tiene trazabilidad exacta de los electores que ha invitado a la campaña (referidos), permitiendo medir el rendimiento real de cada eslabón de la cadena política.
*   **Gestión de Electores (Voters)**: Base de datos centralizada de simpatizantes. Toda la información de Identificación Personal (PII), como números de cédula y teléfonos, se cifra utilizando el estándar militar AES-256.
*   **Prevención de Duplicados**: El sistema calcula firmas criptográficas (SHA-256) de los documentos de identidad, emitiendo alertas inmediatas si dos líderes distintos intentan registrar a la misma persona, erradicando la inflación artificial de planillas.
*   **PWA Offline**: Aplicación web progresiva que permite a los líderes registrar datos en zonas rurales sin conexión a internet, sincronizándolos automáticamente al recuperar la señal.

---

## 2. Módulo de ANALYTICS (Inteligencia de Datos)
El "cerebro estratégico" diseñado para el gerente de campaña, proporcionando visibilidad en tiempo real sobre la viabilidad del proyecto.

*   **KPIs en Tiempo Real**: Tableros de control con indicadores de crecimiento de la base de datos, tasas de retención y metas por territorio.
*   **Agente IA de Fidelidad**: Un modelo de Inteligencia Artificial (impulsado por Zhipu Flash Z-AI) audita el comportamiento de los líderes. Detecta anomalías, evalúa compromisos no cumplidos y levanta banderas rojas sobre promesas electorales frágiles.
*   **Proyección de Votos**: Algoritmos que cruzan los datos históricos de elecciones anteriores con la estructura territorial actual para predecir el caudal electoral real.
*   **Mapas de Calor**: Visualización geoespacial de la fuerza política de la campaña, identificando zonas de alta penetración y territorios vulnerables que requieren refuerzo.

---

## 3. Módulo de FORMACIÓN
Garantiza que el recurso humano de la campaña esté legal y técnicamente preparado, especialmente para el control electoral.

*   **Centro de Capacitación**: Repositorio digital de materiales didácticos (videos, PDF, manuales) sobre normatividad, derechos del testigo electoral y detección de fraudes.
*   **Evaluaciones y Simulacros**: Herramienta para lanzar pruebas estandarizadas a coordinadores y testigos. Mide el nivel de comprensión sobre cómo diligenciar reclamaciones oficiales y cómo interpretar un acta E-14.
*   **Acreditación Operativa**: El sistema bloquea la asignación de credenciales a testigos que no hayan aprobado los simulacros de formación, asegurando que solo personal capacitado defienda los votos.

---

## 4. Módulo DÍA E (Día de las Elecciones)
Infraestructura de misión crítica para la sala de crisis durante la jornada electoral.

*   **Transmisión E-14 con IA**: Los testigos en las mesas de votación fotografían las actas E-14 oficiales. La plataforma procesa estas imágenes con modelos de visión por computadora (Groq Vision) para extraer, transcribir y sumar automáticamente los votos escritos a mano, ofreciendo un preconteo en tiempo real mucho antes que los boletines oficiales.
*   **Sala de Situación**: Panel de control con alertas en vivo sobre la apertura de puestos de votación, flujo de votantes y recepción de datos.
*   **Gestión de Reclamaciones**: Canal directo y digital para que los testigos reporten irregularidades legales documentadas (fotos, videos) desde los puestos de votación hacia los abogados de la campaña.

---

## 5. Módulo de ENCUESTAS (IA y Automatización)
Sistema de sondeo de opinión ciudadana escalable, diseñado para interactuar directamente con la base de datos de electores sin intervención de un call center.

*   **Bot Conversacional**: Motor automatizado que contacta a los electores vía WhatsApp. Gestiona el consentimiento legal (opt-in) y realiza preguntas interactivas preconfiguradas sobre los diferentes cargos en disputa.
*   **Mapeo de Intención por IA**: Utiliza Inteligencia Artificial conversacional (Llama 3) para procesar las respuestas de texto libre o ambiguas del elector (por ejemplo, apodos de candidatos o códigos de partido) y asignarlas correctamente a un candidato oficial.
*   **Despliegue Programado**: Motor de envío por lotes que respeta los horarios locales y los límites transaccionales diarios impuestos por Meta Cloud API.

---

## 6. Módulo de COMUNICACIONES
Marketing político segmentado para movilización y retención del electorado.

*   **Difusión Omnicanal**: Permite el envío masivo pero focalizado de mensajes a través de WhatsApp, SMS y Correo Electrónico.
*   **Segmentación Avanzada**: Los mensajes se pueden filtrar microscópicamente: por ubicación geográfica (barrio, municipio), por edad, por nivel de compromiso político o por el líder que los refirió.
*   **Gestión de Plantillas**: Creación y almacenamiento de mensajes estandarizados pre-aprobados por la campaña para responder a eventos específicos o para el *Get Out The Vote* (movilización) en el Día E.

---

## 7. Módulo de FINANZAS
Herramienta de auditoría y transparencia contable, diseñada para proteger a la campaña de sanciones legales por parte del Consejo Nacional Electoral (CNE).

*   **Control de Ingresos**: Trazabilidad absoluta del origen de los fondos, donaciones y aportes de particulares o del partido, exigiendo soportes documentales.
*   **Gestión de Gastos Operativos**: Registro de cada peso invertido en publicidad, logística, transporte de líderes y pago a testigos.
*   **Alertas de Topes Legales**: El sistema monitorea en tiempo real el gasto acumulado frente al tope legal de inversión establecido por la ley electoral para ese territorio, alertando a la gerencia antes de cometer faltas legales.
