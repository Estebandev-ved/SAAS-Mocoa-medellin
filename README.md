# ?? ANTIGRAVITY — Bot WhatsApp con IA para Negocios (SaaS)

> Sistema multi-agente de automatización de ventas por WhatsApp. Plataforma SaaS que permite a negocios conectar su WhatsApp, configurar un bot IA y gestionar pedidos, domicilios y conversaciones desde un dashboard.

---

## ?? Arquitectura General del Sistema

```
+-----------------------------------------------------------------+
¦                     CLIENTE FINAL (WhatsApp)                    ¦
+-----------------------------------------------------------------+
                                ¦ Mensaje de texto
                                ?
+-----------------------------------------------------------------+
¦          INSTANCE MANAGER (Node.js — puerto 3001)               ¦
¦  Baileys: gestiona múltiples conexiones WhatsApp simultáneas    ¦
¦  Un BotInstance por cada negocio registrado                     ¦
+----------------------------------------------------------------+
            ¦ HTTP POST /procesar                  ¦ Socket.io
            ?                                      ?
+-----------------------+              +---------------------------+
¦   BRAIN IA (Python    ¦              ¦   API REST (Node.js —     ¦
¦   FastAPI — p. 8000)  ¦              ¦   puerto 3002)            ¦
¦                       ¦              ¦                           ¦
¦  orchestrator.py      ¦              ¦  auth, negocios,          ¦
¦  9 Agentes IA (GPT)   ¦              ¦  productos, pedidos,      ¦
¦  context_manager.py   ¦              ¦  domicilios, admin...     ¦
¦  prompt_builder.py    ¦              ¦                           ¦
+-----------------------+              +---------------------------+
            ¦                                       ¦
            +---------------------------------------+
                              ¦
                    +-------------------+
                    ¦   MySQL + Redis    ¦
                    ¦  (datos + caché)  ¦
                    +-------------------+
                              ¦
                              ?
+-----------------------------------------------------------------+
¦           FRONTEND — DOS PROYECTOS REACT                        ¦
¦                                                                 ¦
¦  1. agency-platform-react/ (puerto 5173)                        ¦
¦     Landing page pública: Hero, Features, Precios, Contacto     ¦
¦                                                                 ¦
¦  2. antigravity/frontend/ (puerto 5174/5177)                    ¦
¦     Dashboard SaaS: Login, Register, Panel de Administración    ¦
+-----------------------------------------------------------------+
```

---

## ??? Estructura de Carpetas

```
Bot NOMA/
¦
+-- agency-platform-react/        # LANDING PAGE PÚBLICA (React + Vite)
¦   +-- src/
¦   ¦   +-- components/           # Navbar, Hero, Features, Pricing, etc.
¦   ¦   +-- pages/                # (solo LoginPage — auth redirige al dashboard)
¦   ¦   +-- context/              # AuthContext, BrandingContext
¦   ¦   +-- App.jsx               # Rutas: solo "/" (landing)
¦   +-- .env.local                # VITE_ANTIGRAVITY_URL=http://localhost:5174
¦   +-- package.json
¦
+-- antigravity/                  # NUCLEO DEL SISTEMA (Backend + Dashboard)
¦   ¦
¦   +-- api/                      # API REST (Express, puerto 3002)
¦   ¦   +-- index.js              # Servidor Express + Socket.io
¦   ¦   +-- middleware/           # security.js, auth.js, admin.js, rateLimit.js
¦   ¦   +-- routes/               # 14 archivos de rutas
¦   ¦       +-- auth.js           # Login, registro, verify, reset-password
¦   ¦       +-- business.js       # Perfil de negocio, config del bot
¦   ¦       +-- products.js       # CRUD catálogo de productos
¦   ¦       +-- orders.js         # Pedidos del negocio
¦   ¦       +-- conversaciones.js # Historial de chats
¦   ¦       +-- whatsapp.js       # Conectar/desconectar/QR
¦   ¦       +-- domicilios.js     # Sistema de delivery y tracking
¦   ¦       +-- admin.js          # Panel superadmin
¦   ¦       +-- agentes.js        # Estadísticas de agentes IA
¦   ¦       +-- automations.js    # Flujos de automatización
¦   ¦       +-- analytics.js      # Métricas y reportes
¦   ¦       +-- bot-config.js     # Configuración personalizable del bot
¦   ¦
¦   +-- brain/                    # MOTOR IA (Python FastAPI, puerto 8000)
¦   ¦   +-- main.py               # Servidor FastAPI + endpoints
¦   ¦   +-- orchestrator.py       # Clasifica la intención del mensaje
¦   ¦   +-- context_manager.py    # Memoria de conversación por cliente
¦   ¦   +-- prompt_builder.py     # Construye el prompt para GPT
¦   ¦   +-- router.py             # Enruta al agente correcto
¦   ¦   +-- agents/               # 9 agentes especializados
¦   ¦       +-- ventas.py         # Detecta compras, cierra ventas
¦   ¦       +-- pagos.py          # Instrucciones de pago + OCR comprobantes
¦   ¦       +-- pedidos.py        # Estado, cancelación, modificaciones
¦   ¦       +-- faq.py            # Info del negocio, horarios, productos
¦   ¦       +-- reclamos.py       # Quejas con escalado humano
¦   ¦       +-- retencion.py      # Anti-churn, ofertas de retención
¦   ¦       +-- seguimiento.py    # Estado de domicilios en tiempo real
¦   ¦       +-- escalacion.py     # Traspaso a agente humano
¦   ¦       +-- campanas.py       # Campañas de mensajería masiva
¦   ¦
¦   +-- instance-manager/         # GESTOR DE BOTS WHATSAPP (Node.js, p. 3001)
¦   ¦   +-- index.js              # Entrada: arranca todos los bots
¦   ¦   +-- InstanceManager.js    # Crea/destruye instancias de bot
¦   ¦   +-- BotInstance.js        # Conexión Baileys por negocio
¦   ¦   +-- socketEmitter.js      # Emite eventos al dashboard en tiempo real
¦   ¦   +-- monitor.js            # Monitoreo de salud 24/7
¦   ¦   +-- handlers/
¦   ¦       +-- messageHandler.js # Procesa mensajes entrantes
¦   ¦
¦   +-- db/                       # BASE DE DATOS
¦   ¦   +-- schema.sql            # Schema completo (USAR ESTE para crear tablas)
¦   ¦   +-- schema_simple.sql     # Schema simplificado (para pruebas)
¦   ¦   +-- seed.sql              # Datos de prueba / demo
¦   ¦   +-- config.js             # Conexión MySQL (mysql2)
¦   ¦   +-- queries/              # Queries específicas
¦   ¦
¦   +-- frontend/                 # DASHBOARD + AUTH (React + Vite, p. 5174)
¦   ¦   +-- src/
¦   ¦       +-- pages/
¦   ¦       ¦   +-- LoginPage.jsx
¦   ¦       ¦   +-- RegisterPage.jsx   # Wizard de 5 pasos
¦   ¦       ¦   +-- dashboard/
¦   ¦       ¦   ¦   +-- OverviewPage.jsx       # Panel principal
¦   ¦       ¦   ¦   +-- WhatsAppPage.jsx       # Conectar WhatsApp / QR
¦   ¦       ¦   ¦   +-- OrdersPage.jsx         # Gestión de pedidos
¦   ¦       ¦   ¦   +-- ConversationsPage.jsx  # Historial de chats
¦   ¦       ¦   ¦   +-- ProductsPage.jsx       # Catálogo
¦   ¦       ¦   ¦   +-- AnalyticsPage.jsx      # Métricas
¦   ¦       ¦   ¦   +-- AutomationsPage.jsx    # Flujos automáticos
¦   ¦       ¦   ¦   +-- CustomizePage.jsx      # Personalizar bot
¦   ¦       ¦   ¦   +-- SettingsPage.jsx       # Configuración cuenta
¦   ¦       ¦   ¦   +-- DomiciliosPage.jsx     # Sistema de domicilios
¦   ¦       ¦   ¦   +-- PortalDomiciliario.jsx # Vista para el domiciliario
¦   ¦       ¦   ¦   +-- TrackingCliente.jsx    # Seguimiento público
¦   ¦       ¦   +-- admin/                     # Panel superadmin
¦   ¦       ¦       +-- AdminResumen.jsx
¦   ¦       ¦       +-- AdminNegocios.jsx
¦   ¦       ¦       +-- AdminNegocio.jsx
¦   ¦       ¦       +-- AdminWhatsApps.jsx
¦   ¦       ¦       +-- AdminSuscripciones.jsx
¦   ¦       ¦       +-- AdminLogs.jsx
¦   ¦       ¦       +-- AdminConfig.jsx
¦   ¦       +-- context/AuthContext.jsx
¦   ¦       +-- services/
¦   ¦
¦   +-- .env                      # Variables de entorno (NO subir al repo)
¦   +-- .env.example              # PLANTILLA para crear el .env
¦   +-- package.json
¦   +-- requirements.txt
¦
+-- README.md                     # Este archivo
```

---

## ?? Requisitos Previos

| Herramienta | Versión mínima | Verificar con |
|-------------|----------------|---------------|
| **Node.js** | 18.x | `node --version` |
| **Python** | 3.10 | `python --version` |
| **MySQL** | 8.0 | `mysql --version` |
| **Redis** | 7.x (opcional) | `redis-cli --version` |

> **Nota sobre Redis:** El sistema funciona sin Redis. Si no está instalado, el Brain usa un bypass interno automáticamente.

---

## ?? Instalación Completa (Paso a Paso)

### PASO 1 — Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd "Bot NOMA"
```

### PASO 2 — Configurar variables de entorno

```bash
cd antigravity
copy .env.example .env
```

Abrir el archivo `antigravity/.env` y rellenar los valores:

```env
# IA — OpenAI
OPENAI_API_KEY=sk-...tu-clave-aqui...

# MySQL
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=tu_password_de_mysql
MYSQL_DATABASE=antigravity

# Redis (opcional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Seguridad — CAMBIAR en produccion
JWT_SECRET=una_clave_secreta_muy_larga_y_segura_aqui
SOCKET_SECRET=otra_clave_secreta_para_sockets_aqui

# Email (para notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_app_password_de_gmail

# Puertos (dejar por defecto)
PORT_API=3002
PORT_BOT=3001
PORT_BRAIN=8000

# URLs
FRONTEND_URL=http://localhost:5174
FRONTEND_API_URL=http://localhost:3002
FRONTEND_SOCKET_URL=http://localhost:3002
NODE_ENV=development
```

### PASO 3 — Configurar la Base de Datos MySQL

```bash
# Opcion 1: Por consola interactiva
mysql -u root -p
source antigravity/db/schema.sql
source antigravity/db/seed.sql
exit

# Opcion 2: Directo desde terminal
mysql -u root -p antigravity < antigravity/db/schema.sql
mysql -u root -p antigravity < antigravity/db/seed.sql
```

### PASO 4 — Instalar dependencias Node.js

```bash
# Backend API
cd antigravity
npm install

# Instance Manager (Bot WhatsApp)
cd instance-manager
npm install
cd ..

# Dashboard (Frontend interno)
cd frontend
npm install
cd ..

# Landing Page
cd ../agency-platform-react
npm install
cd ..
```

### PASO 5 — Instalar dependencias Python (Brain IA)

```bash
pip install fastapi uvicorn openai python-dotenv requests python-multipart mysql-connector-python redis
```

---

## ?? Como Levantar el Sistema

Necesitas **4 terminales abiertas**. Arrancar en este orden:

### Terminal 1 — API REST (Backend principal)

```bash
cd antigravity
node api/index.js
```

Debe mostrar: `[API] Servidor corriendo en puerto 3002`

### Terminal 2 — Brain IA (Python)

```bash
cd antigravity
python -m uvicorn brain.main:app --host 0.0.0.0 --port 8000 --reload
```

Debe mostrar: `Uvicorn running on http://0.0.0.0:8000`

### Terminal 3 — Instance Manager (Bot WhatsApp)

```bash
cd antigravity/instance-manager
node index.js
```

Debe mostrar: `[InstanceManager] Sistema iniciado`

### Terminal 4 — Dashboard (Frontend)

```bash
cd antigravity/frontend
npm run dev
```

Abrir en browser: http://localhost:5174

### Terminal 5 (opcional) — Landing Page

```bash
cd agency-platform-react
npm run dev
```

Abrir en browser: http://localhost:5173

---

## ?? URLs y Puertos del Sistema

| Servicio | URL | Descripcion |
|----------|-----|-------------|
| **API REST** | http://localhost:3002 | Backend principal |
| **Brain IA** | http://localhost:8000 | Motor de IA (FastAPI) |
| **Dashboard** | http://localhost:5174 | Panel SaaS para negocios |
| **Landing Page** | http://localhost:5173 | Pagina publica |
| **Health Check** | http://localhost:3002/health | Verificar que la API esta activa |
| **Docs Brain** | http://localhost:8000/docs | Swagger automatico de FastAPI |

---

## ?? Credenciales de Prueba (requiere haber cargado seed.sql)

| Rol | Email | Password |
|-----|-------|----------|
| **Negocio Demo** | demo@antigravity.co | Demo2024# |
| **Super Admin** | superadmin@antigravity.co | Admin2024# |

> IMPORTANTE: Cambiar estas credenciales antes de poner en produccion.

---

## ?? Flujo de Usuario

```
1. Visita landing (localhost:5173)
2. Clic "Crear Cuenta" ? va a localhost:5174/register
3. Completa wizard de 5 pasos ? /dashboard
4. Dashboard > WhatsApp > Conectar > Escanea QR
5. Bot activo — clientes escriben al WhatsApp del negocio
6. Brain IA clasifica y responde automaticamente
7. Dashboard muestra pedidos, conversaciones y metricas en tiempo real
```

---

## ?? Endpoints de la API

### Autenticacion
```
POST   /api/auth/registro          ? Crear nuevo negocio
POST   /api/auth/login             ? Iniciar sesion (devuelve JWT)
GET    /api/auth/verify            ? Verificar token activo
POST   /api/auth/logout            ? Cerrar sesion
POST   /api/auth/forgot-password   ? Solicitar reset de contraseña
```

### Negocio / Perfil
```
GET    /api/negocio/perfil         ? Datos del negocio autenticado
PUT    /api/negocio/perfil         ? Actualizar perfil
GET    /api/negocio/productos      ? Catalogo de productos
POST   /api/negocio/productos      ? Agregar producto
PUT    /api/negocio/productos/:id  ? Editar producto
DELETE /api/negocio/productos/:id  ? Eliminar producto
```

### WhatsApp
```
GET    /api/whatsapp/status        ? Estado de conexion
POST   /api/whatsapp/connect       ? Iniciar conexion (genera QR)
POST   /api/whatsapp/disconnect    ? Desconectar bot
GET    /api/whatsapp/qr            ? Obtener imagen del QR
```

### Conversaciones y Pedidos
```
GET    /api/conversaciones                      ? Lista de conversaciones
GET    /api/conversaciones/:id/mensajes         ? Mensajes de una conversacion
POST   /api/conversaciones/:id/mensaje          ? Enviar mensaje manual
GET    /api/pedidos                             ? Pedidos del negocio
PUT    /api/pedidos/:id/estado                  ? Actualizar estado de pedido
```

### Domicilios (Delivery)
```
POST   /api/domicilios                          ? Crear domicilio
GET    /api/domicilios                          ? Listar domicilios del negocio
GET    /api/domicilios/tracking/:token          ? Tracking publico (sin auth)
PUT    /api/domicilios/:id/estado               ? Actualizar estado
```

### Bot Config
```
GET    /api/bot/config             ? Configuracion actual del bot
PUT    /api/bot/config             ? Actualizar nombre, tono, mensajes
POST   /api/bot/test               ? Probar bot sin WhatsApp real
```

### Admin (superadmin solamente)
```
GET    /api/admin/negocios                      ? Todos los negocios
GET    /api/admin/estadisticas                  ? Metricas globales
POST   /api/admin/negocios/:id/suspender        ? Suspender negocio
POST   /api/admin/demo                          ? Crear cuenta demo
```

### Brain IA (uso interno del Instance Manager)
```
POST   /procesar                   ? Procesar mensaje entrante
POST   /verificar-pago             ? Verificar comprobante de pago (OCR)
GET    /catalogo/invalidar/:id     ? Limpiar cache del catalogo
GET    /stats/:id                  ? Estadisticas de agentes por negocio
```

---

## ?? Agentes IA

| Agente | Archivo | Funcion |
|--------|---------|---------|
| **Ventas** | agents/ventas.py | Detecta compras, extrae productos, cierra venta |
| **Pagos** | agents/pagos.py | Instrucciones de pago, verifica comprobantes OCR |
| **Pedidos** | agents/pedidos.py | Consulta estado, cancelacion, modificaciones |
| **FAQ** | agents/faq.py | Info del negocio, productos, horarios, ubicacion |
| **Reclamos** | agents/reclamos.py | Gestion de quejas con escalado a humano |
| **Retencion** | agents/retencion.py | Detecta intencion de cancelar, ofrece descuentos |
| **Seguimiento** | agents/seguimiento.py | Estado del domicilio en tiempo real |
| **Escalacion** | agents/escalacion.py | Traspaso a agente humano cuando es necesario |
| **Campanas** | agents/campanas.py | Mensajeria masiva y campanas automatizadas |

---

## ?? Planes del SaaS

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Mensajes/mes | 1,000 | 5,000 | Ilimitado |
| Clientes | 100 | 1,000 | Ilimitado |
| Agentes IA | 3 | 6 | 9 |
| Bots WhatsApp | 1 | 2 | 5 |
| Tokens IA/dia | 50,000 | 250,000 | Ilimitado |
| Domicilios | NO | SI | SI |
| Campanas | NO | SI | SI |
| Panel Admin | NO | NO | SI |

---

## ?? Seguridad Implementada

- JWT para autenticacion de usuarios
- Helmet.js para cabeceras HTTP seguras
- Rate Limiting global (100 req/min por IP) y por plan
- XSS sanitization en todos los inputs
- express-validator en endpoints criticos
- bcryptjs para hash de contraseñas
- Variables de entorno para todos los secretos
- Roles: negocio, admin, superadmin
- Socket.io autenticado con JWT o secret interno

---

## ?? LO QUE FALTA — Tareas Pendientes para el Socio

### PRIORIDAD ALTA (bloquea funcionalidades clave)

#### TAREA 1 — Integracion Landing con Dashboard (Auth)
**Problema:** Los botones "Login" y "Crear Cuenta" de la landing no redirigen al dashboard correctamente.

**Que hacer:**
- En `agency-platform-react/src/components/Navbar.jsx` verificar que los botones apuntan a `http://localhost:5174/login` y `http://localhost:5174/register`
- O agregar en `agency-platform-react/src/App.jsx` rutas `/login` y `/register` que hagan redirect externo
- Verificar `agency-platform-react/.env.local` tiene `VITE_ANTIGRAVITY_URL=http://localhost:5174`

#### TAREA 2 — Variables de entorno del Frontend Dashboard
**Problema:** `antigravity/frontend/.env` puede tener URLs hardcodeadas o incorrectas.

**Que hacer:**
- Revisar `antigravity/frontend/.env` y asegurarse de que tenga:
  ```
  VITE_API_URL=http://localhost:3002
  VITE_SOCKET_URL=http://localhost:3002
  ```
- Verificar que todos los archivos en `frontend/src/services/` usen `import.meta.env.VITE_API_URL`

#### TAREA 3 — Flujo QR de WhatsApp en el Dashboard
**Problema:** `WhatsAppPage.jsx` debe mostrar el QR real y actualizarse via Socket.io.

**Que hacer:**
- Verificar que `WhatsAppPage.jsx` escucha el evento `qr_update` del socket
- El evento lo emite: Instance Manager ? socketEmitter.js ? API ? cliente
- Probar: Dashboard > WhatsApp > Conectar > Ver QR > Escanear con telefono

---

### PRIORIDAD MEDIA (mejoras importantes)

#### TAREA 4 — Sistema de Domicilios completo
- Conectar boton "Crear Domicilio" al endpoint `POST /api/domicilios`
- Mostrar lista en tiempo real con Socket.io
- Probar link de tracking al cliente: `http://localhost:5174/tracking/:token`
- Verificar `PortalDomiciliario.jsx` (vista para el repartidor)

#### TAREA 5 — Pagina Analytics con graficas reales
- Conectar `AnalyticsPage.jsx` al endpoint `GET /api/analytics` (o el de `routes/analytics.js`)
- Mostrar: mensajes por dia, conversiones, productos mas pedidos
- Puede usar `recharts` (npm install recharts en frontend/)

#### TAREA 6 — Pagina de Automatizaciones funcional
- `AutomationsPage.jsx` actualmente solo tiene estructura base
- Conectar al endpoint de `routes/automations.js`
- Permitir crear/editar/eliminar automatizaciones desde el dashboard

#### TAREA 7 — Panel Admin completo
- Verificar que `AdminNegocios.jsx` carga desde `/api/admin/negocios`
- Verificar que `AdminWhatsApps.jsx` muestra estado de cada bot
- `AdminSuscripciones.jsx` — verificar si el endpoint existe en admin.js
- `AdminLogs.jsx` — crear o conectar al endpoint de logs

---

### PRIORIDAD BAJA (mejoras futuras)

#### TAREA 8 — Integracion con Stripe (Pagos del SaaS)
- La BD tiene `stripe_customer_id` en la tabla `negocios` (listo para conectar)
- Crear webhooks de Stripe en `api/routes/`
- Actualizar plan del negocio cuando Stripe confirme pago
- La landing ya tiene seccion de precios (`Pricing.jsx`), conectarla a Stripe Checkout

#### TAREA 9 — Tests Automatizados
- No hay tests en ningun modulo actualmente
- Backend Node: usar jest (`npm install -D jest`)
- Brain Python: usar pytest (`pip install pytest`)
- Prioridad: tests de auth endpoints y del orchestrator

#### TAREA 10 — Docker Compose para produccion
- No existe `docker-compose.yml` en el proyecto
- Crear uno que levante: MySQL, Redis, API, Brain, Instance Manager
- Documentar deploy con Nginx + Cloudflare Tunnels

#### TAREA 11 — Campanas masivas con interfaz
- El agente `campanas.py` existe pero no tiene endpoint en la API
- Crear `POST /api/campanas` para enviar mensajes a lista de contactos
- Agregar interfaz en `AutomationsPage.jsx` o crear pagina dedicada

#### TAREA 12 — Reset de Contrasena funcional
- El endpoint `POST /api/auth/forgot-password` existe en `auth.js`
- Verificar que el email de recuperacion se envia (SMTP en .env)
- Crear pagina en el frontend: `/reset-password?token=...`

---

## ??? Comandos Utiles para Desarrollo

```bash
# Verificar que la API responde
curl http://localhost:3002/health

# Ver documentacion automatica del Brain (abrir en browser)
# http://localhost:8000/docs

# Crear cuenta admin manualmente
cd antigravity
node create-admin.js

# Ejecutar migraciones de BD
node run-migrations.js

# Probar flujo de delivery completo
node test-delivery-flow.js

# Resetear cuenta demo
cd antigravity/brain
python reset_demo_account.py

# Verificar conexion a BD desde Python
python check_db.py

# Ver usuarios en la BD
python check_users.py
```

---

## ??? Queries SQL de Verificacion

```sql
-- Ver todos los negocios
SELECT id, nombre, email_dueno, plan, whatsapp_conectado, activo FROM negocios;

-- Ver conversaciones activas
SELECT c.id, c.telefono_cliente, n.nombre, c.ultima_interaccion
FROM conversaciones c JOIN negocios n ON c.negocio_id = n.id
ORDER BY c.ultima_interaccion DESC LIMIT 20;

-- Ver logs de agentes IA (ultimas 24h)
SELECT negocio_id, agente_tipo, COUNT(*) as llamadas, SUM(tokens_usados) as tokens
FROM agente_logs
WHERE created_at >= NOW() - INTERVAL 24 HOUR
GROUP BY negocio_id, agente_tipo;

-- Ver domicilios activos
SELECT id, tracking_token, estado, created_at
FROM domicilios WHERE estado != 'entregado' ORDER BY created_at DESC;
```

---

## ?? Solucion de Problemas Comunes

### "Cannot connect to MySQL"
```bash
mysql -u root -p -e "SHOW DATABASES;"
# Windows: net start mysql
# Linux/Mac: sudo service mysql start
```

### "Module not found" en Python
```bash
pip install fastapi uvicorn openai python-dotenv mysql-connector-python redis
```

### "CORS error" en el browser
- Verificar que `NODE_ENV=development` en `.env`
- El frontend debe correr en puerto 5173 o 5174 (estan en la whitelist del API)

### El bot de WhatsApp no conecta
- Verificar que Instance Manager Y la API estan corriendo
- Borrar `antigravity/auth_info/auth_info_X/` y reconectar desde el dashboard

### Sesion expira o "JWT invalid"
- Verificar que `JWT_SECRET` en `.env` no este vacio
- El token expira en 7 dias por defecto

---

## ?? Archivos que NUNCA deben subirse al repositorio

El `.gitignore` ya los excluye. Verificar que nunca se comitteen:

```
antigravity/.env
antigravity/auth_info/
antigravity/node_modules/
antigravity/frontend/.env
agency-platform-react/.env.local
agency-platform-react/node_modules/
```

---

## ?? Flujo de Trabajo del Equipo

- Usar branches por feature: `git checkout -b feature/nombre-de-la-tarea`
- Commits descriptivos en español
- Deploy local: Nginx + Cloudflare Tunnels
- Secretos siempre en `.env`, nunca en el codigo

---

*Ultima actualizacion: Junio 2026 — Sistema en desarrollo activo*
