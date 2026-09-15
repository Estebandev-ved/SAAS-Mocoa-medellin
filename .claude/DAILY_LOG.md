# Bitácora de Desarrollo y Tareas

---

## 📅 Plan para Hoy: 2026-09-16

### Tareas Prioritarias

- [ ] Instalar ngrok, exponer la API (`ngrok http 3002`), pegar la URL en `VOICE_PUBLIC_URL` del `.env` y configurar el webhook de voz en la consola de Twilio para el número `+573208303600`. Luego probar el bot de llamadas con una llamada real.
- [ ] Correr `npm run dev` en `antigravity/frontend`, entrar con una cuenta de negocio válida (la demo `demo@antigravity.co` aparece **bloqueada** — desbloquearla o crear una cuenta de prueba nueva) y revisar visualmente la grilla de 3 planes en Ajustes → Plan: que se vea bien, que "Más elegido" resalte Professional, y que el botón de upgrade funcione de punta a punta.
- [ ] Limpiar las llamadas muertas a `BRAIN_URL` (`http://localhost:8000`) que quedaron en `api/routes/agentes.js`, `api/routes/bot-config.js`, `api/index.js` (stats de agentes por socket) y `instance-manager/handlers/paymentHandler.js` — el servicio `brain/` (Python) ya no existe en el proyecto, hoy se borró la carpeta junto con `requirements.txt` y `Dockerfile.brain`. Esas llamadas ya fallan de forma controlada (try/catch), pero es código muerto apuntando a un servicio retirado.
- [ ] [Agrega aquí cualquier tarea manual que tú quieras encargarle hoy]

---

## 📋 Sugerencias de la IA para el Próximo Día

- Free trial con downgrade para el bot de llamadas al registrarse (pendiente de la estrategia de pricing psicológico).
- Pantalla propia "Llamadas" en el dashboard — hoy `voice_bot_config` se maneja por API/SQL directo.
- Decidir si se elimina `/api/suscripcion/*` (router duplicado que el frontend no usa) o se migra el frontend a usarlo.
- Prueba social en la pestaña Plan (cifras reales de negocios activos) — esperar a tener una base de clientes que valga la pena citar.
- Auditar a fondo `instance-manager/agents/gemini.js` y decidir si vale la pena portar la detección de escalación a humano que quedó en el `brain/` retirado.
- Hay ~189 archivos con cambios sin commitear en el working tree (incluye todo `agency-platform-react/` y gran parte de `antigravity/`). Vale la pena revisar y hacer commits por bloques temáticos antes de que crezca más y se vuelva difícil de revisar.

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
