# ANTIGRAVITY

Sistema SaaS multi-tenant de automatización por WhatsApp con IA para negocios colombianos.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      NIVEL 1: INTERFACES                    │
│  WhatsApp (clientes)          React Dashboard (dueños)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      NIVEL 2: GATEWAY                       │
│  Instance Manager (Baileys)    Central API (Express)       │
│  Socket.io                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NIVEL 3: CEREBRO IA                     │
│  Python FastAPI + OpenAI GPT-4o                           │
│  Intent Detection, Entity Extraction, OCR Pagos           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NIVEL 4: PERSISTENCIA                    │
│  MySQL 8 (multi-tenant)     Redis (cache + queues)        │
│  Aislamiento por negocio_id                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      NIVEL 5: INFRA                        │
│  PM2 + Nginx + Docker                                     │
└─────────────────────────────────────────────────────────────┘
```

## Estructura del Proyecto

```
antigravity/
├── api/                        # API REST Express
│   ├── index.js               # Servidor principal
│   ├── middleware/            # Auth + Tenant
│   └── routes/                # Endpoints
├── instance-manager/          # Gestor multi-bot Baileys
│   ├── index.js               # Endpoints internos
│   ├── InstanceManager.js     # Coordinador de instancias
│   ├── BotInstance.js         # Instancia individual
│   └── handlers/              # Manejadores de mensajes
├── brain/                     # Motor IA Python
│   ├── main.py               # Servidor FastAPI
│   ├── router.py             # GPT Router + Rate Limiting
│   ├── context_manager.py    # Gestión de contexto Redis
│   ├── prompt_builder.py     # Prompt dinámico por negocio
│   ├── intent.py             # Detección de intención
│   └── extractor.py          # Extracción de pedidos
├── queue/                     # Sistema de colas Bull
│   ├── index.js              # Inicialización colas
│   ├── workers/              # Procesadores
│   └── jobs/                 # Funciones de encolado
├── db/                        # Base de datos
│   ├── schema.sql            # Esquema completo
│   ├── seed.sql              # Datos de prueba
│   └── queries/              # Módulos de queries
├── frontend/                  # Dashboard React
│   ├── src/
│   │   ├── pages/           # Páginas del dashboard
│   │   ├── components/      # Componentes reutilizables
│   │   ├── services/        # API + Socket
│   │   └── context/         # Auth Context
│   └── package.json
└── infra/                     # Configuración Production
    ├── ecosystem.config.js   # PM2
    ├── nginx.conf            # Nginx
    └── docker-compose.yml    # Docker
```

## Requisitos

- Node.js 20+
- Python 3.11+
- MySQL 8.0+
- Redis 7+

## Instalación Local (Desarrollo)

### 1. Instalar dependencias Node.js

```bash
cd antigravity
npm install
```

### 2. Instalar dependencias Python

```bash
pip install -r requirements.txt
```

### 3. Configurar base de datos

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/seed.sql
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### 5. Ejecutar servicios

```bash
# Terminal 1 - Brain IA
uvicorn brain.main:app --reload --port 8000

# Terminal 2 - Instance Manager
node instance-manager/index.js

# Terminal 3 - API
node api/index.js

# Terminal 4 - Queue
node queue/index.js

# Terminal 5 - Frontend
cd frontend && npm run dev
```

O usa PM2:
```bash
pm2 start infra/ecosystem.config.js
pm2 logs
```

## Instalación en Servidor (Producción)

### Con Docker

```bash
cd infra
cp .env.example .env
# Configura .env con tus credenciales

docker-compose up -d
```

### Con PM2 + Nginx

```bash
# Compilar frontend
cd frontend
npm run build

# Copiar dist a nginx
cp -r dist/* /var/www/antigravity/

# Iniciar servicios
pm2 start infra/ecosystem.config.js
pm2 save

# Configurar nginx
sudo cp infra/nginx.conf /etc/nginx/sites-available/antigravity
sudo ln -s /etc/nginx/sites-available/antigravity /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Primeros Pasos

### 1. Acceso al Dashboard

1. Ve a `http://localhost:5173` (dev) o tu dominio (prod)
2. Login con credentials de prueba:
   - Email: `demo@antigravity.co`
   - Password: `Demo2024#`

### 2. Conectar WhatsApp

1. Ve a `/dashboard/whatsapp`
2. Click "Conectar WhatsApp"
3. Escanea el QR con tu teléfono
4. ¡Listo! El bot está activo

### 3. Configurar el Bot

1. Ve a `/dashboard/customize`
2. Configura:
   - Nombre del bot
   - Tono (formal/amigable/casual)
   - Mensaje de bienvenida
   - Horario de atención

### 4. Agregar Productos

1. Ve a `/dashboard/products`
2. Agrega tus productos con precios
3. El bot mostrará el catálogo automáticamente

## Planes y Features

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Clientes | 100 | Ilimitados | Ilimitados |
| Mensajes/mes | 1,000 | 5,000 | Ilimitados |
| Bot WhatsApp | ✅ | ✅ | ✅ |
| Recordatorios pago | ✅ | ✅ | ✅ |
| Alertas stock bajo | ✅ | ✅ | ✅ |
| Re-engagement | ❌ | ✅ | ✅ |
| Reporte semanal | ❌ | ✅ | ✅ |
| Campañas masivas | ❌ | ✅ | ✅ |
| OCR pagos | ❌ | ❌ | ✅ |
| Multi-sede | ❌ | ❌ | ✅ |

## Variables de Entorno

```env
# Base de datos
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=tu_password
MYSQL_DATABASE=antigravity

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Autenticación
JWT_SECRET=tu_secret_muy_seguro

# IA
OPENAI_API_KEY=sk-...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password
```

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/registro` - Registro
- `GET /api/auth/verify` - Verificar token

### Pedidos
- `GET /api/pedidos` - Listar pedidos
- `PATCH /api/pedidos/:id` - Actualizar estado

### Productos
- `GET /api/productos` - Listar productos
- `POST /api/productos` - Crear producto
- `PUT /api/productos/:id` - Actualizar producto

### Negocio
- `GET /api/negocio/perfil` - Ver perfil
- `PUT /api/negocio/perfil` - Actualizar perfil
- `GET /api/negocio/plan` - Ver plan

### WhatsApp
- `GET /api/negocio/whatsapp/status` - Estado conexión
- `POST /api/negocio/whatsapp/connect` - Conectar bot
- `POST /api/negocio/whatsapp/disconnect` - Desconectar bot

### Automatizaciones
- `GET /api/automatizaciones` - Listar automatizaciones
- `PATCH /api/automatizaciones/:tipo/toggle` - Activar/desactivar
- `PUT /api/automatizaciones/:tipo/config` - Configurar

### Campañas
- `GET /api/campañas` - Listar campañas
- `POST /api/campañas` - Crear campaña
- `GET /api/campañas/:id/progreso` - Ver progreso

## Troubleshooting

### El bot no conecta
1. Verifica que el número no esté en uso en otro dispositivo
2. Revisa los logs: `pm2 logs ag-instance-manager`
3. Elimina la carpeta `auth_info_{negocioId}` y prueba de nuevo

### No recibe mensajes
1. Verifica que el Instance Manager esté corriendo
2. Revisa la conexión a MySQL
3. Verifica que el negocio tenga `whatsapp_conectado=true` en BD

### Error de base de datos
1. Verifica credenciales en .env
2. Confirma que MySQL esté corriendo
3. Ejecuta schema.sql nuevamente

### Rate limit de OpenAI
1. Revisa tu plan en el dashboard
2. Considera hacer upgrade a Professional

## Tecnologías

- **Backend**: Node.js 20, Express 4, Socket.io 4
- **WhatsApp**: Baileys 6
- **IA**: Python 3.11, FastAPI, OpenAI SDK
- **Base de datos**: MySQL 8, Redis 7, Bull Queue
- **Frontend**: React 18, Vite, React Router 6, Axios
- **Infra**: PM2, Nginx, Docker

## Licencia

MIT
