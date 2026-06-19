# ANTIGRAVITY — Sistema Multi-Agente Completado

## Flujo Completo Verificado

### Flujo E2E del Documento
1. WhatsApp mensaje → Baileys detecta → Instance Manager ✅
2. IM identifica negocio por número → IM consulta Brain API ✅
3. Brain clasifica intención (orchestrator.py) ✅
4. Brain llama al agente correcto (6 agentes especializados) ✅
5. Agente genera respuesta CON catálogo del negocio ✅
6. IM guarda en mensajes + agente_logs ✅
7. IM envía respuesta por WhatsApp ✅
8. Dashboard se actualiza (Socket.io) ✅

### Flujo Registro
1. /registro → negocio en BD (trial 7 días) ✅
2. redirect /dashboard/welcome ✅
3. /dashboard/whatsapp → QR generado ✅
4. cliente escanea → sesión guardada ✅
5. bot activo ✅

---

## Archivos Creados/Modificados

### AGENTE 2 — Brain IA
| Archivo | Descripción |
|---------|-------------|
| `brain/orchestrator.py` | Clasificador de intenciones + dispatcher |
| `brain/agents/__init__.py` | Módulo de agentes |
| `brain/agents/ventas.py` | Agente de ventas con triggers |
| `brain/agents/pagos.py` | Agente de pagos + verificación OCR |
| `brain/agents/pedidos.py` | Agente de gestión de pedidos |
| `brain/agents/faq.py` | Agente informativo |
| `brain/agents/reclamos.py` | Agente de quejas con escalado |
| `brain/agents/retencion.py` | Agente de retención de clientes |
| `brain/main.py` | Actualizado con nuevo orquestador |

### AGENTE 3 — API REST
| Archivo | Descripción |
|---------|-------------|
| `api/routes/whatsapp.js` | Endpoints para WhatsApp (connect, disconnect, status, QR) |
| `api/routes/bot-config.js` | Configuración del bot + test |
| `api/routes/conversaciones.js` | CRUD de conversaciones y mensajes |
| `api/routes/admin.js` | Panel de administración completo |
| `api/middleware/admin.js` | Middleware de verificación admin |

### AGENTE 4 — Frontend Admin
| Archivo | Descripción |
|---------|-------------|
| `pages/admin/AdminLayout.jsx` | Layout del panel admin |
| `pages/admin/AdminLayout.css` | Estilos del admin |
| `pages/admin/AdminOverview.jsx` | Dashboard principal admin |
| `pages/admin/AdminOverview.css` | Estilos overview |
| `pages/admin/AdminNegocio.jsx` | Detalle de negocio |
| `pages/admin/AdminNegocio.css` | Estilos negocio |
| `components/auth/AdminRoute.jsx` | Protección de rutas admin |
| `App.jsx` | Actualizado con rutas admin |

### AGENTE 5 — Instance Manager
| Archivo | Descripción |
|---------|-------------|
| `instance-manager/agents/orchestrator.js` | Orquestador Node.js con rate limiting |
| `instance-manager/handlers/messageHandler.js` | Actualizado con nuevo flujo |

### AGENTE 6 — Seguridad
| Archivo | Descripción |
|---------|-------------|
| `api/middleware/rateLimit.js` | Rate limiting por plan |
| `api/middleware/sanitize.js` | Validación y sanitización |
| `instance-manager/monitor.js` | Sistema de monitoreo 24/7 |

---

## Endpoints Disponibles

### WhatsApp
- `GET /api/whatsapp/status` — Estado de conexión
- `POST /api/whatsapp/connect` — Iniciar conexión
- `POST /api/whatsapp/disconnect` — Desconectar
- `GET /api/whatsapp/qr` — Obtener QR

### Bot Config
- `GET /api/bot/config` — Obtener config del bot
- `PUT /api/bot/config` — Actualizar config
- `PUT /api/bot/config/agentes` — Activar/desactivar agentes
- `POST /api/bot/test` — Probar bot sin WhatsApp

### Conversaciones
- `GET /api/conversaciones` — Listar conversaciones
- `GET /api/conversaciones/:id` — Ver conversación
- `GET /api/conversaciones/:id/mensajes` — Mensajes
- `POST /api/conversaciones/:id/mensaje` — Enviar mensaje manual

### Admin
- `GET /api/admin/negocios` — Lista de negocios
- `GET /api/admin/negocios/:id` — Detalle negocio
- `PUT /api/admin/negocios/:id` — Editar negocio
- `GET /api/admin/estadisticas` — Stats globales
- `GET /api/admin/whatsapps` — Estado WhatsApps
- `POST /api/admin/negocios/:id/suspender` — Suspender
- `POST /api/admin/demo` — Crear demo

### Brain
- `POST /procesar` — Procesar mensaje
- `POST /verificar-pago` — Verificar comprobante
- `GET /catalogo/invalidar/:id` — Invalidar cache
- `GET /stats/:id` — Stats de uso

---

## Agentes IA Implementados

1. **Agente Ventas** — Detecta intención de compra, extrae productos, cierra venta
2. **Agente Pagos** — Instrucciones de pago, verificación de comprobantes OCR
3. **Agente Pedidos** — Consulta estado, cancelación, modificaciones
4. **Agente FAQ** — Información del negocio, productos, horarios
5. **Agente Reclamos** — Gestión de quejas con escalado humano
6. **Agente Retención** — Detección de cancelación, ofertas de retención

---

## Credenciales de Prueba

### Negocio Demo
- Email: `demo@antigravity.co`
- Password: `Demo2024#`
- Plan: Professional

### Admin del Sistema
- Email: `superadmin@antigravity.co`
- Password: `Admin2024#`
- Rol: admin

---

## Comandos para Levantar

```bash
# Terminal 1 - Base de datos
cd antigravity
docker-compose up -d mysql redis

# Terminal 2 - Brain IA
cd antigravity/brain
pip install -r requirements.txt
python main.py

# Terminal 3 - API REST
cd antigravity/api
npm install
npm start

# Terminal 4 - Instance Manager
cd antigravity/instance-manager
npm install
node index.js

# Terminal 5 - Frontend
cd antigravity/frontend
npm install
npm run dev
```

---

## Límites por Plan

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Mensajes/mes | 1,000 | 5,000 | Ilimitado |
| Clientes | 100 | 1,000 | Ilimitado |
| Agentes IA | 3 | 6 | 6 |
| WhatsApp bots | 1 | 2 | 5 |
| Tokens IA/día | 50,000 | 250,000 | Ilimitado |

---

## Queries SQL de Verificación

```sql
-- Verificar negocios
SELECT id, nombre, plan, whatsapp_conectado FROM negocios WHERE rol = 'negocio';

-- Verificar conversaciones
SELECT c.*, n.nombre FROM conversaciones c JOIN negocios n ON c.negocio_id = n.id;

-- Verificar logs de agentes
SELECT * FROM agente_logs ORDER BY created_at DESC LIMIT 20;

-- Stats de uso
SELECT negocio_id, COUNT(*) as mensajes, SUM(tokens_usados) as tokens 
FROM agente_logs WHERE DATE(created_at) = CURDATE() GROUP BY negocio_id;
```
