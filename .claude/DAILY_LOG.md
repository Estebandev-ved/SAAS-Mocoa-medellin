# Bitácora de Desarrollo y Tareas

---

## 📅 Plan para Hoy: 2026-09-17

### Tareas Prioritarias

- [ ] Instalar ngrok, exponer la API (`ngrok http 3002`), pegar la URL en `VOICE_PUBLIC_URL` del `.env` y configurar el webhook de voz en la consola de Twilio para el número `+573208303600`. Luego probar el bot de llamadas con una llamada real. (Sigue pendiente — requiere acción manual del socio: instalar software e iniciar una llamada real.)
- [ ] Revisar visualmente en el navegador el resto de la pestaña Plan con la pantalla ancha (no solo el contenido/DOM): hoy se verificó todo por texto/DOM porque el panel de vista previa no estaba renderizando capturas, así que falta el vistazo visual final (alineación, responsive, hover del botón de upgrade).
- [ ] Decidir si se elimina `/api/suscripcion/*` (router duplicado que el frontend no usa) o se migra el frontend a usarlo.
- [ ] Revisar los cambios que aparecen sin commitear en `agency-platform-react/src/pages/AjustesPage.jsx`, `Dashboard.jsx`, `DomiciliosPage.jsx`, `antigravity/api/routes/analyticsAdvanced.js` e `instance-manager/agents/gemini.js` — no se tocaron hoy en esta sesión, conviene confirmar que son cambios intencionales antes de que se acumulen más.
- [ ] [Agrega aquí cualquier tarea manual que tú quieras encargarle hoy]

---

## 📋 Sugerencias de la IA para el Próximo Día

- Free trial con downgrade para el bot de llamadas al registrarse (pendiente de la estrategia de pricing psicológico).
- Pantalla propia "Llamadas" en el dashboard — hoy `voice_bot_config` se maneja por API/SQL directo.
- Prueba social en la pestaña Plan (cifras reales de negocios activos) — esperar a tener una base de clientes que valga la pena citar.
- Auditar a fondo `instance-manager/agents/gemini.js` y decidir si vale la pena portar la detección de escalación a humano que quedó en el `brain/` retirado.
- Hay dos negocios distintos (`id=1` "Tienda Ejemplo Colombia" e `id=4` "Admin Antigravity") compartiendo el mismo `email_dueno = demo@antigravity.co`. El login (`api/routes/auth.js`) hace `SELECT * FROM negocios WHERE email_dueno = ?` sin filtrar más y toma `negocios[0]` — hoy funcionó porque el orden natural devolvió el id=1, pero es un dato duplicado que puede dar sorpresas. Vale la pena decidir si el email debe ser único por negocio o si esto es intencional (cuenta demo + cuenta admin comparten correo a propósito).
- Auditar si hay otros lugares en el código que muten objetos devueltos por `getPlanFeatures()`/`getPlan()` de `config/planConfig.js` sin clonar primero — el mismo patrón que causó el bug de hoy (ver Historial) podría estar repetido en otro middleware o ruta que no se revisó todavía.

---

## 📜 Historial de Avances

### Antes de hoy

- [x] Auditoría de seguridad multi-tenant: IDOR en sockets corregido, `JWT_SECRET`/`SOCKET_SECRET` sin fallback por defecto, endpoints inseguros cerrados.
- [x] Consolidación de rutas por recurso (`orders.js`, `products.js`, `business.js`, etc.), `all.js` deprecado.
- [x] Catálogo de automatizaciones con ejecución real (scheduler, reengagement, reseñas, campañas masivas).
- [x] Migración completa del `brain/` (Python) a Gemini, y luego decisión de retirarlo — un solo cerebro real en `instance-manager/` (Node).
- [x] Filtro de mensajes viejos tras reinicio del bot (evita que Baileys dispare respuestas fuera de contexto).

### 15 sept 2026

- [x] Bot de llamadas (Twilio + Clonar-voz) terminado: multi-tenant real, mismo cerebro que WhatsApp, bloqueado por plan Enterprise, seguridad de webhook con firma de Twilio.
- [x] Pestaña "Plan" en Ajustes conectada a datos reales (`GET /api/business/plan`) — precio, features y uso del mes en vivo, en vez de estar hardcodeada.
- [x] Estrategia de pricing psicológico definida (aversión a la pérdida, anclaje, decoy effect) e implementada en código: aviso de pérdida potencial con uso real del mes, y grilla comparativa de los 3 planes con "Más elegido" resaltado en Professional.
- [x] Revisión de código de la grilla de 3 planes (Ajustes → Plan): frontend, CSS, endpoint `GET /api/business/plan` y `planConfig.js` verificados de punta a punta, sin desfases de datos. No se pudo probar en vivo en el navegador porque la cuenta demo aparece bloqueada.
- [x] Bot de llamadas preparado del lado de código: `npm install` en `antigravity/`, `node run-migrations.js` (tablas `voice_calls`, `voice_bot_config`, `voice_custom_voices` creadas), y variables `VOICE_PUBLIC_URL` + `TWILIO_VALIDATE_SIGNATURE=true` agregadas al `.env`. Falta ngrok + webhook de Twilio + llamada real (tarea manual, pasa a mañana).
- [x] Limpieza: borrados `antigravity/brain/`, `requirements.txt` y `Dockerfile.brain` (sin uso desde que quedó un solo cerebro en `instance-manager/`), y removidas las variables `AZURE_OPENAI_*` del `.env`. Verificado que ningún otro archivo del proyecto las referenciaba.

### 16 sept 2026

- [x] Limpieza de código muerto apuntando al `brain/` (Python) retirado: quitado el `setInterval` de stats de agentes por socket en `api/index.js`, simplificados `agentes.js` (endpoints `/stats` y `/presupuesto` ya no intentan red) y `bot-config.js` (quitadas las invalidaciones de caché al brain), y `paymentHandler.js` ya no intenta `fetch` a un servicio que no existe. Verificado que la API arranca limpio y responde en `/health`.
- [x] Cuenta demo (`demo@antigravity.co`, negocio id=1) estaba bloqueada por intentos fallidos previos — desbloqueada y contraseña restablecida a `Demo2024#` directamente en BD (cuenta de prueba local, no de cliente real) para poder revisar el dashboard.
- [x] **Bug encontrado y corregido**: la pestaña Plan mostraba "Productos en catálogo: 9 / null" en vez de "Ilimitado" para negocios en plan Professional/Enterprise. Causa raíz: `api/middleware/tenant.js` tomaba el objeto de `getPlanFeatures()` de `config/planConfig.js` (que devuelve la referencia directa al singleton, sin clonar) y lo **mutaba en memoria** (`maxProducts: -1 → Infinity`), corrompiendo la config compartida para todo el proceso y para todos los negocios en cuanto cualquier request pasaba por ese middleware una vez. `Infinity` no es serializable en JSON (se vuelve `null`), de ahí el síntoma visible. Corregido clonando el objeto (`{ ...getPlanFeatures(...) }`) antes de mutarlo.
- [x] **Segundo bug encontrado y corregido**: la tarjeta "Inicial" (Starter) en la grilla comparativa de planes se mostraba sin ningún feature listado (vacía) porque `FEATURE_LABELS` en `planConfig.js` solo tenía etiquetas para features premium, ninguna de las cuales tiene Starter. Se agregaron etiquetas para las 6 features base (bot de ventas, catálogo, pedidos por WhatsApp, reportes básicos, soporte email, analytics básico), verificado que ahora la tarjeta Starter muestra su propia lista.
- [x] Verificación end-to-end de ambos fixes con la API corriendo real (login + `GET /api/business/plan` vía curl y navegador): `productos.limit` ahora es `-1` (antes `null`), y el plan Starter devuelve 6 features en vez de `[]`.
