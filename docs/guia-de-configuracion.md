# Guía de configuración: lo que tienes que hacer para que todo quede funcional

Última revisión: 25 oct 2026. Ordenado por prioridad: lo de arriba desbloquea lo de abajo. Marca cada paso cuando lo termines.

> **Dónde se ponen las variables:** las del servidor van en **Railway** (servicio de la API → Variables). Las que empiezan por `VITE_` van en **Vercel** (Settings → Environment Variables) y exigen un *Redeploy* para aplicarse.

## 1. Obligatorio (sin esto la app no es segura o no arranca)

| ✔ | Qué | Dónde | Cómo |
|---|---|---|---|
| ☐ | `JWT_SECRET`, `SOCKET_SECRET` | Railway | Textos largos y aleatorios, distintos entre sí. Si faltan, la API no arranca. Genera uno: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| ☐ | `TOTP_ENC_KEY` (y opcional `SECRETS_ENC_KEY`) | Railway | Llave para cifrar secretos (2FA y el token de Instagram). `openssl rand -hex 32`. **Guárdala aparte**: si la cambias, los secretos ya guardados no se pueden leer. |
| ☐ | Datos de MySQL (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) | Railway | Ya los tienes funcionando. |
| ☐ | **Backup de la base** | Railway (MySQL → Backups) o `mysqldump` | Antes de cada despliegue grande. Las migraciones nuevas son automáticas pero tocan tablas reales. |
| ☐ | `GEMINI_API_KEY` | Railway | La IA del bot. Sin ella el bot no responde. |
| ☐ | `FRONTEND_URL`, `API_PUBLIC_URL`, `NODE_ENV=production` | Railway | `FRONTEND_URL` = dirección de tu sitio en Vercel (es lo que permite CORS). `API_PUBLIC_URL` = dirección pública de la API en Railway. |
| ☐ | `VITE_API_URL`, `VITE_SOCKET_URL` | Vercel | Direcciones de la API (`https://…/api` y `https://…`). |
| ☐ | `ADMIN_EMAIL` | Railway | Tu correo: esa cuenta pasa a administradora y ves `/admin`. |
| ☐ | `RUN_MIGRATIONS_ON_START=false` | Railway | Las migraciones ya corren antes de iniciar; con `true` se hacen dos veces (inofensivo, pero duplicado). |
| ☐ | Contraseña de cualquier admin que usara `Admin2024#` | App → Ajustes → Seguridad | Estuvo escrita en el repositorio hasta el 9 oct. |

**Comprobar:** en los logs de Railway debe salir `Migraciones al día y esquema verificado`, `[API] Servidor corriendo en puerto 3002` y `[API] Versión desplegada: <commit>` (el último commit).

## 2. Cobros (para que los clientes paguen el plan)

| ✔ | Qué | Cómo |
|---|---|---|
| ☐ | `EFIPAY_ACCESS_TOKEN`, `EFIPAY_OFFICE_ID` (sucursal **3161**, no el 221), `EFIPAY_WEBHOOK_TOKEN` | Railway. Los de Efipay ya estaban; confirma que el log diga `Efipay aceptó el token`. |
| ☐ | Webhook en el panel de Efipay | Registrar `https://<tu-API>/api/webhook/efipay` con el mismo `EFIPAY_WEBHOOK_TOKEN`. |
| ☐ | **Primer pago de prueba** | Plan Emprendedor ($25.000): Mi plan → pagar → al volver el plan debe quedar activo con factura `INV-EFI-…`. |

## 3. Avisos y correo

| ✔ | Qué | Cómo |
|---|---|---|
| ☐ | Avisos push: `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT` | `npx web-push generate-vapid-keys` (una vez). `SUBJECT` = `mailto:tucorreo@…`. Luego en el celular: Ajustes → Notificaciones → "Activar avisos". |
| ☐ | Correo (recuperar contraseña, alertas): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `OWNER_EMAIL` | Cualquier proveedor SMTP (Gmail con contraseña de aplicación, Brevo, etc.). Sin esto no llegan los correos de "olvidé mi contraseña". |

## 4. WhatsApp (el canal principal)

| ✔ | Qué | Cómo |
|---|---|---|
| ☐ | Vincular el WhatsApp del negocio | App → Ajustes → Canales → WhatsApp → escanear el QR con el celular del negocio. Usa un número dedicado. |
| ☐ | `INSTANCE_MANAGER_URL` | Railway, en la API: dirección del servicio *instance-manager* (si corren separados). |
| ☐ | Probar el bot | Desde **otro** número, escribe al WhatsApp del negocio. Ajustes → pestaña Bot → "Probar mi bot" también sirve. |
| ☐ | Datos del negocio | Ajustes → Mi negocio: nombre, tipo de negocio, horario, **Nequi / Bancolombia** (los usa el cobro), redes. |
| ☐ | (Después) **WhatsApp Cloud API oficial** | Cuenta de Meta Business verificada. Variables `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_CLOUD_CONFIG`. Es lo que permite botones reales y escribir fuera de las 24 h. |

## 5. Instagram (hoy: mensajes directos; comentarios, pendiente)

1. En **developers.facebook.com** crea una app tipo "Empresa" y agrega los productos *Instagram* y *Webhooks*.
2. Variables en Railway: **`META_APP_SECRET`** (secreto de la app, **obligatorio**: sin él el webhook rechaza todo), `META_VERIFY_TOKEN` (un texto que tú inventes) y, opcional, `META_GRAPH_VERSION`.
3. En Webhooks de la app, registra `https://<tu-API>/api/instagram/webhook` con ese mismo `META_VERIFY_TOKEN` y suscribe el campo `messages`.
   - **Para responder comentarios** (disparador "Cuando comentan una palabra en Instagram"): suscribe también el campo **`comments`** y pide el permiso `instagram_manage_comments` (en modo desarrollo funciona con cuentas que tengan rol en la app). Crea el flujo en Marketing → Respuestas automáticas (plantilla "Catálogo por comentario en Instagram"), enciéndelo y comenta la palabra desde otra cuenta en una publicación tuya.
4. En la app, **Ajustes → Canales → Instagram**: hoy se conecta pegando el *Page ID* y el *token de acceso* (la conexión con botón y renovación automática del token está en el plan: `docs/instagram-comentarios.md`).
5. **Modo desarrollo**: solo funciona con cuentas que tengan rol en tu app de Meta. Para clientes reales hay que pasar la **revisión de la app** y la **verificación del negocio** (tarda semanas: empiézala ya, también sirve para WhatsApp Cloud API).
6. Probar: escribe un DM a la cuenta de Instagram; debe aparecer en **Mensajes** (filtro "Instagram") y el bot responde. Si responder desde el panel dice "pasaron 24 horas", es una regla de Instagram.

## 6. Opcionales según lo que ofrezcas

| Función | Qué falta |
|---|---|
| Domicilios con mapa | `TRAVELTIME_APP_ID`, `TRAVELTIME_API_KEY` (Railway) y `VITE_TRAVELTIME_APP_ID` (Vercel). `TRACKING_BASE_URL` = dirección pública del seguimiento. |
| Bot de llamadas (plan Empresarial) | Twilio (`TWILIO_*`, `VOICE_PUBLIC_URL`), proveedor de voz (`STT_PROVIDER`, `DEEPGRAM_API_KEY`…) y el servicio `Clonar-voz`. Pospuesto a después de producción. |
| Caja (plan Emprendedor) | `CAJA_JWT_SECRET` (distinto de `JWT_SECRET`) y `CAJA_URL`. |
| Escalar a varias instancias | `REDIS_URL` (límite de peticiones compartido) y `TRUST_PROXY_HOPS=1`. Con una sola instancia no hace falta. |
| Métricas | `METRICS_TOKEN` para `/api/metrics`. |
| Tope de mensajes proactivos de flujos | `FLUJOS_MAX_PROACTIVOS_DIA` (por defecto 100 por negocio y día). |
| Analítica del sitio | `VITE_ANALITICA_DOMINIO` (Plausible), `VITE_WHATSAPP_VENTAS`, `VITE_DEMO_VIDEO_URL` en Vercel. |

## 7. Datos legales (obligatorio antes de vender)

- Completar `agency-platform-react/src/legalConfig.js` (nombre o razón social, NIT, domicilio, correo para datos) y que un abogado revise Términos y Privacidad (Ley 1581).
- Confirmar que el banner de cookies y el consentimiento del bot (nombre, correo, marketing) funcionan.

## 8. Prueba de humo después de configurar (10 minutos)

1. **Entrar** con tu cuenta; ver el menú de 8 entradas y `/admin` si eres administrador.
2. **Productos**: crear uno con "Controlar inventario" y stock 10; probar *Ajustar stock*, *Historial*, *Exportar* e *Importar*.
3. **Marketing → Respuestas automáticas**: elegir una plantilla, ponerle una palabra clave, *Probar flujo*, guardar y **encender**. Escribir la palabra desde otro número.
4. **Pedido por WhatsApp**: pedir un producto con stock; el pedido debe quedar con "Stock reservado" y descontar el inventario; cancelarlo debe devolverlo.
5. **Pago**: enviar un comprobante; debe verificarse y avanzar el pedido.
6. **Mensajes**: ver la conversación; responder desde el panel; si hay Instagram, probar el filtro por canal.
7. **Mi plan**: hacer el pago de prueba con Efipay.
8. **Celular**: abrir la app, instalarla ("Agregar a la pantalla de inicio") y activar los avisos.

## 9. Si algo falla

| Síntoma | Qué mirar |
|---|---|
| La API no arranca | Logs de Railway: falta `JWT_SECRET`/`SOCKET_SECRET`, o error de MySQL. |
| Un deploy falla | Build Logs → buscar `Error:`; si es una migración, pásala a quien mantiene el código. Apaga el flujo o reversa el despliegue desde Railway (Deployments → el anterior → Redeploy). |
| El bot no contesta | WhatsApp desconectado (Canales), límite de mensajes del plan, o falta `GEMINI_API_KEY`. |
| Instagram no recibe mensajes | `META_APP_SECRET` sin poner, webhook sin suscribir a `messages`, o cuenta sin rol en la app (modo desarrollo). |
| Los flujos no se disparan | Flujo apagado, palabra clave distinta, o el cliente ya tiene otro flujo esperando respuesta (24 h). |
| No llegan correos | Variables `SMTP_*`. |

## 10. Regalar un mes de un plan (solo administrador)

Con tu sesión de administrador (token de `/admin`), desde la consola del navegador o una herramienta como Postman:

- Una cuenta: `POST /api/admin/negocios/<id>/regalo` con `{"plan":"starter","dias":30}`.
- Varias a la vez (hasta 100): `POST /api/admin/regalo` con `{"plan":"starter","dias":30,"correos":["a@x.co","b@x.co"]}`. Responde cuenta por cuenta qué pasó.

Planes válidos: `emprendedor`, `starter`, `professional`, `enterprise`; de 1 a 90 días (30 por defecto). La cuenta queda como "prueba" con ese plan y al terminar queda vencida hasta que pague. Si la cuenta ya tiene un plan pagado vigente no se toca (responde que tiene plan pagado).
