# Revisión del Proyecto: Bot NOMA - Sistema de Automatización WhatsApp

## 📋 Resumen del Proyecto

Sistema completo de automatización de ventas por WhatsApp para negocios, construido con arquitectura de microservicios.

** stack tecnológico:**
- Frontend: React + Vite (2 proyectos)
- Backend: Python Flask + MySQL
- WhatsApp: Bot WhatsApp (biblioteca Baileys)
- IA: Azure OpenAI (GPT-5)

---

## 🏗️ Estructura del Proyecto

```
Bot NOMA/
├── agency-platform-react/    # Landing page pública
│   ├── src/
│   │   ├── components/       # Navbar, Footer, Hero, etc.
│   │   ├── pages/            # LoginPage
│   │   ├── context/          # AuthContext, BrandingContext
│   │   └── App.jsx
│   └── .env.local            # VITE_ANTIGRAVITY_URL=http://localhost:5177
│
├── antigravity/              # Dashboard + Auth
│   └── frontend/
│       ├── src/
│       │   ├── pages/
│       │   │   ├── LoginPage.jsx      # Formulario login
│       │   │   ├── RegisterPage.jsx  # Wizard 5 pasos
│       │   │   └── dashboard/         # Dashboard completo
│       │   │       ├── DashboardLayout.jsx
│       │   │       ├── OverviewPage.jsx
│       │   │       ├── WhatsAppPage.jsx
│       │   │       ├── OrdersPage.jsx
│       │   │       ├── ConversationsPage.jsx
│       │   │       ├── ProductsPage.jsx
│       │   │       ├── AnalyticsPage.jsx
│       │   │       ├── AutomationsPage.jsx
│       │   │       ├── CustomizePage.jsx
│       │   │       └── SettingsPage.jsx
│       │   ├── context/AuthContext.jsx
│       │   ├── services/api.js
│       │   └── App.jsx
│       └── .env
│
├── bot-api-python/           # Backend Flask API
│   ├── web_pedidos.py        # Endpoints API + Web legacy
│   ├── crear_db.py           # Utilidades DB + auth
│   ├── security.py           # Firewall, rate limiting
│   ├── db.py                 # Conexión MySQL
│   ├── main.py               # Lógica del bot
│   └── database/
│       └── crear_base_datos.sql
│
└── bot-whatsapp/             # Bot WhatsApp (Baileys)
```

---

## 🔐 Flujo de Autenticación (IMPLEMENTADO)

### Landing → Dashboard Flow:
1. **agency-platform-react** (puerto 5173): Landing page pública
   - Botones "LOGIN" y "CREAR CUENTA" en Navbar
   - Redirigen a `http://localhost:5177/login` y `/register`

2. **antigravity/frontend** (puerto 5177): Sistema de auth + dashboard
   - `/` → LandingPage simple con botones
   - `/login` → Formulario de login
   - `/register` → Wizard de registro de 5 pasos
   - `/dashboard/*` → Panel protegido

### Endpoints API (bot-api-python:3002):
```
POST /api/auth/registro    → Registro nuevo usuario
POST /api/auth/login       → Login usuario
POST /api/auth/logout      → Logout
GET  /api/auth/verify       → Verificar token
POST /api/pedidos          → Crear pedido
GET  /api/pedidos          → Listar pedidos
GET  /responder            → Bot WhatsApp (webhook)
```

---

## ✅ Estado Actual - Lo que FUNCIONA

### Frontend:
- [x] Landing page con navegación a auth
- [x] Login/Register en antigravity
- [x] Dashboard con sidebar y rutas protegidas
- [x] Tema oscuro con acentos cyan (#00FFD1)
- [x] Context de autenticación

### Backend:
- [x] Endpoints de auth API
- [x] Base de datos MySQL con tablas: usuarios, negocios, pedidos, clientes
- [x] Rate limiting y seguridad
- [x] Web legacy para pedidos ( Flask templates)

---

## ⚠️ Puntos a Revisar / Mejoras Pendientes

### 1. Consistencia de Tokens
- agency-platform-react usa `antigravity_token` (localStorage)
- antigravity/frontend usa `ag_token` (localStorage)
- **Verificar** que después de login en antigravity, el usuario pueda acceder al dashboard

### 2. Flow de Login/Registro
El usuario hace clic en "Crear Cuenta" desde la landing → redirige a antigravity/register → completa wizard → ¿a dónde va después?
- En RegisterPage.jsx: `navigate('/dashboard')` después de registro exitoso
- **Verificar** que el dashboard carga correctamente

### 3. Tabla Negocios
- El endpoint `/api/auth/registro` crea usuario + negocio
- **Verificar** que la tabla `negocios` tiene las columnas necesarias
- SQL actualizado en `crear_base_datos.sql`

### 4. Bot WhatsApp
- `bot-whatsapp/` parece estar separado
- **Verificar** integración con el backend
- El endpoint `/responder` en web_pedidos.py debería conectarse con el bot

### 5. Variables de Entorno
- `.env.local` en agency-platform-react apunta a puerto 5177 (puede cambiar)
- Considerar usar proxy en Vite para evitar hardcoded URLs

### 6. Estado de Sesión Compartida
- Landing y Dashboard están en puertos diferentes
- **Verificar** si el usuario logueado en antigravity puede acceder a rutas del dashboard

---

## 🎯 Preguntas Clave para Revisión

1. **¿El login en antigravity crea sesión correctamente?**
   - Verificar que `ag_token` se guarda en localStorage
   - Verificar que `/api/auth/login` responde con token

2. **¿Después de registro, el wizard redirige bien?**
   - RegisterPage llama a `register()` del context
   - Luego `navigate('/dashboard')`

3. **¿Dashboard carga datos del usuario?**
   - ProtectedRoute verifica `isAuthenticated`
   - AuthContext carga usuario desde localStorage

4. **¿El backend tiene los endpoints necesarios?**
   - `/api/auth/registro` (implementado)
   - `/api/auth/login` (implementado)
   - `/api/auth/verify` (implementado)

---

## 🚀 Para Iniciar el Proyecto

```bash
# Terminal 1: Backend
cd bot-api-python
python web_pedidos.py

# Terminal 2: Landing
cd agency-platform-react
npm run dev

# Terminal 3: Dashboard/Auth
cd antigravity/frontend
npm run dev
```

**Puertos esperados:**
- Backend: http://localhost:3002
- Landing: http://localhost:5173
- Auth/Dashboard: http://localhost:5174 (o siguiente disponible)

---

## 📝 Notas Adicionales

- El proyecto usa MySQL (configurar en bot-api-python/.env)
- El estilo visual es oscuro con acentos cyan/neón
- Hay dos proyectos React por razones históricas (agency-platform-react = landing, antigravity = dashboard)
- El flujo actual: Landing → redirige a antigravity → auth → dashboard
