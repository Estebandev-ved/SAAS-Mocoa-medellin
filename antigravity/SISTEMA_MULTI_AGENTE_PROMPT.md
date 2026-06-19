# ANTIGRAVITY - Sistema Multi-Agente para WhatsApp Business

## 1. ARQUITECTURA GENERAL

### 1.1 Sistema Multi-Tenant
```
┌─────────────────────────────────────────────────────────────┐
│                    NIVEL 1: USUARIOS                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Admin       │  │  Negocio A   │  │  Negocio B   │    │
│  │  (Tú)        │  │  (Cliente)   │  │  (Cliente)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    NIVEL 2: DASHBOARDS                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Admin Panel │  │ Dashboard A  │  │ Dashboard B  │    │
│  │  (Gestiona   │  │ (Gestiona    │  │ (Gestiona    │    │
│  │   todos)     │  │   su bot)    │  │   su bot)    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    NIVEL 3: AGENTES IA                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ORQUESTADOR PRINCIPAL                    │  │
│  │         (Clasifica intención del usuario)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                               │                             │
│     ┌──────────┬──────────┬───┴───┬──────────┬─────────┐ │
│     ▼          ▼          ▼       ▼          ▼         ▼  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌─────┐  │
│  │Agente│ │Agente│ │Agente│ │Agente│ │Agente│ │Agente│  │
│  │Ventas│ │Pagos │ │Pedidos│ │FAQ  │ │Reclam.│ │Reten.│  │
│  │      │ │      │ │      │ │      │ │      │ │      │  │
│  └──────┘ └──────┘ └──────┘ └─────┘ └──────┘ └─────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    NIVEL 4: WHATSAPP                        │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │  WhatsApp A  │  │  WhatsApp B  │  (Un bot por negocio) │
│  │  +57XXX      │  │  +57YYY      │                       │
│  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ROLES DEL SISTEMA

### 2.1 Admin (Super Usuario)
- **Acceso**: Panel de administración completo
- **Funciones**:
  - Ver todos los negocios registrados
  - Ver estado de conexión de cada WhatsApp
  - Estadísticas globales (pedidos, ventas, conversaciones)
  - Gestionar suscripciones
  - Soporte técnico a negocios
  - Ver logs de errores de todos los bots

### 2.2 Negocio (Cliente)
- **Acceso**: Dashboard privado
- **Funciones**:
  - Conectar/desconectar su WhatsApp
  - Configurar el bot (tono, horarios, respuestas)
  - Ver sus conversaciones
  - Gestionar pedidos
  - Ver estadísticas propias
  - Configurar productos/servicios

---

## 3. SISTEMA MULTI-AGENTE (CORE DEL BOT)

### 3.1 Orquestador Principal
```javascript
// Pseudocódigo del orquestador
async function procesarMensaje(mensaje, contexto) {
  // 1. Clasificar intención
  const intencion = await clasificarIntencion(mensaje);
  
  // 2. Seleccionar agente especializado
  switch(intencion) {
    case 'compra': return await agenteVentas.procesar(mensaje, contexto);
    case 'pago': return await agentePagos.procesar(mensaje, contexto);
    case 'pedido': return await agentePedidos.procesar(mensaje, contexto);
    case 'consulta': return await agenteFAQ.procesar(mensaje, contexto);
    case 'queja': return await agenteReclamaciones.procesar(mensaje, contexto);
    case 'cancelacion': return await agenteRetencion.procesar(mensaje, contexto);
    default: return await agenteConversacional.generico(mensaje, contexto);
  }
}
```

### 3.2 Agentes Especializados

#### AGENTE VENTAS
```
ROL: "Eres un asesor de ventas experto en yogur griego NOMÁ"
CONTEXTO: 
- Productos: Normal (250g/$9,000), Grande (500g/$18,000)
- Métodos de pago: Nequi (3208303600), Efectivo
- Horario: 8am - 8pm
- Zona entrega: Bogotá

CAPACIDADES:
- Presentar productos
- Sugerir complementos
- Manejar objeciones
- Cerrar ventas
- Upselling (normal → grande)

TRIGGERS: ["quiero", "pedir", "comprar", "helado", "yogur", "probar"]
```

#### AGENTE PAGOS
```
ROL: "Eres el agente de pagos de NOMÁ"
CONTEXTO:
- Nequi: 3208303600
- Efectivo: contra entrega
- Validación: comprobante requerido para Nequi

CAPACIDADES:
- Dar instrucciones de pago
- Validar comprobantes (OCR)
- Confirmar pagos
- Manejar errores de pago
- Generar récipes

TRIGGERS: ["pagar", "transferir", "comprobante", "nequi", "banco"]
```

#### AGENTE PEDIDOS
```
ROL: "Gestor de pedidos de NOMÁ"
CONTEXTO:
- Pedidos: Cliente, cantidad, producto, total, estado
- Estados: pendiente, confirmado, preparando, enviado, entregado
- Confirmación: 45-60 min entrega

CAPACIDADES:
- Crear pedidos
- Consultar estado
- Modificar pedidos
- Cancelar pedidos
- Notificar cambios

TRIGGERS: ["estado", "mi pedido", "cuando llega", "cancelar"]
```

#### AGENTE FAQ
```
ROL: "Asistente informativo de NOMÁ"
CONTEXTO:
- Empresa: Yogur griego artesanal
- Ingredientes: Leche, cultivos vivos
- Conservación: Refrigeración 4°C, 7 días

CAPACIDADES:
- Responder preguntas frecuentes
- Dar información del producto
- Direcciones y horarios
- Contacto

TRIGGERS: ["horario", "dónde", "ingredientes", "cuál", "qué es"]
```

#### AGENTE RECLAMACIONES
```
ROL: "Gestor de quejas y soporte"
CONTEXTO:
- Empresa: NOMÁ
- Políticas: Devoluciones en 24h, reclamo en 48h

CAPACIDADES:
- Recibir quejas
- Escalar a humano si es necesario
- Dar soluciones
- Seguimiento

TRIGGERS: ["problema", "mal", "queja", "no llegó", "malo"]
```

#### AGENTE RETENCIÓN
```
ROL: "Especialista en recuperación de clientes"
CONTEXTO:
- Ofertas: 10% primera compra, 2x1 en segunda
- Perdidos: No han pedido en 30+ días

CAPACIDADES:
- Detectar clientes inactivos
- Enviar ofertas personalizadas
- Recuperar ventas perdidas
- Reactivar relaciones

TRIGGERS: ["ya no quiero", "cancelar", "otro lugar", "caro"]
```

---

## 4. DASHBOARD DEL NEGOCIO

### 4.1 Página de Conexión WhatsApp
```
┌─────────────────────────────────────────────┐
│  🔌  WhatsApp Business                      │
│                                              │
│  Estado: [🟢 Conectado / 🔴 Desconectado]  │
│  Número: +57 320 830 3600                   │
│                                              │
│  ┌─────────────────────────────────┐        │
│  │                                 │        │
│  │         [QR CODE]              │        │
│  │                                 │        │
│  │   Escanea con tu WhatsApp      │        │
│  │                                 │        │
│  └─────────────────────────────────┘        │
│                                              │
│  [Desconectar]  [Reconectar]                │
│                                              │
│  ⚠️ Mantén tu teléfono conectado a internet │
└─────────────────────────────────────────────┘
```

### 4.2 Configuración del Bot
```
┌─────────────────────────────────────────────┐
│  ⚙️  Configuración del Bot                  │
│                                              │
│  Tono de respuesta:                          │
│  ○ Formal  ● Amigable  ○ Casual             │
│                                              │
│  Horario de atención:                        │
│  [08:00] a [20:00]  [✓] Usar horario        │
│                                              │
│  Mensaje de bienvenida:                     │
│  ┌─────────────────────────────────────┐    │
│  │ ¡Hola! Soy el asistente de NOMÁ 🧋  │    │
│  │ ¿En qué te puedo ayudar hoy?        │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Respuesta fuera de horario:                │
│  ┌─────────────────────────────────────┐    │
│  │ Estamos cerrados. Horario: 8am-8pm   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [✓] Activar agente de ventas               │
│  [✓] Activar agente de pagos               │
│  [✓] Activar agente de pedidos             │
│  [✓] Activar agente FAQ                    │
│  [✓] Activar agente de retención           │
│                                              │
│  [Guardar cambios]                          │
└─────────────────────────────────────────────┘
```

---

## 5. PANEL DE ADMIN

### 5.1 Vista General
```
┌─────────────────────────────────────────────────────────────────────┐
│  🛡️  PANEL DE ADMINISTRACIÓN - ANTIGRAVITY                         │
├─────────────────────────────────────────────────────────────────────┤
│  Resumen Global                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │   127    │ │   $45M   │ │   892    │ │   78%    │              │
│  │Negocios  │ │  Ventas  │ │Pedidos   │ │ Tasa IA  │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│  Negocios Activos                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Nombre        │ WhatsApp       │ Plan    │ Estado │ Acciones│   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 🥤 NOMÁ       │ +57 320 8303600 │ Pro     │ 🟢     │ [Ver]   │   │
│  │ 🍕 Pizzería  │ +57 300 1234567 │ Starter │ 🟢     │ [Ver]   │   │
│  │ 🌮 Taco Loco  │ +57 301 9876543 │ Starter │ 🔴     │ [Ver]   │   │
│  │ 🧁 Dulces     │ +57 302 5551234 │ Pro     │ 🟡     │ [Ver]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [+ Crear Demo]  [Ver todos]  [Exportar]                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Detalle de Negocio (Admin)
```
┌─────────────────────────────────────────────────────────────────────┐
│  🏪  Detalle: NOMÁ                                    [← Volver]    │
├─────────────────────────────────────────────────────────────────────┤
│  Info del Negocio                         Configuración del Bot     │
│  ┌─────────────────────┐                  ┌────────────────────┐  │
│  │ Dueño: Juan Pérez    │                  │ Tono: Amigable     │  │
│  │ Email: juan@noma.co  │                  │ Horario: 8am-8pm   │  │
│  │ Plan: Professional   │                  │ Agentes: 5/6       │  │
│  │ Trial: 15 días       │                  │                    │  │
│  └─────────────────────┘                  │ [Editar]            │  │
│                                            └────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  Estadísticas del Negocio                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│  │  234     │ │  $12.5M  │ │   89%    │                           │
│  │Pedidos   │ │  Ventas  │ │ Tasa IA  │                           │
│  └──────────┘ └──────────┘ └──────────┘                           │
├─────────────────────────────────────────────────────────────────────┤
│  Conversaciones Recientes                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Cliente          │ Última conversación      │ Mensajes     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ María García     │ Hace 5 minutos          │ 12           │   │
│  │ Carlos López     │ Hace 1 hora             │ 8            │   │
│  │ Ana Martínez     │ Hace 3 horas            │ 15           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [Ver conversaciones]  [Ver pedidos]  [Ver analytics]  [Suspender] │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE MENSAJE                            │
└─────────────────────────────────────────────────────────────────────┘

[WhatsApp] → [Baileys Instance] → [Instance Manager] → [Brain API]
                                                    │
                                                    ▼
                                           ┌────────────────┐
                                           │  ORQUESTADOR   │
                                           │  (Clasifica)   │
                                           └────────────────┘
                                                    │
                          ┌─────────┬─────────┬────┴────┬─────────┐
                          ▼         ▼         ▼        ▼         ▼
                    ┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐
                    │Ventas  │ │Pagos   │ │Pedido│ │ FAQ  │ │ Otro │
                    └────────┘ └────────┘ └──────┘ └──────┘ └──────┘
                          │         │         │        │         │
                          └─────────┴────┬────┴────────┴─────────┘
                                         │
                                         ▼
                                ┌────────────────┐
                                │  RESPUESTA     │
                                │  (Texto/ACtion)│
                                └────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
             [WhatsApp]          [Base de datos]      [Dashboard]
              (Al cliente)        (Guardar convo)      (Mostrar)
```

---

## 7. BASE DE DATOS (Esquema Simplificado)

```sql
-- Tabla principal de negocios
CREATE TABLE negocios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL,
    email_dueno VARCHAR(255) UNIQUE NOT NULL,
    whatsapp VARCHAR(20),
    password_hash VARCHAR(255),
    plan ENUM('starter', 'professional', 'enterprise'),
    color_principal VARCHAR(7) DEFAULT '#00D9FF',
    logo_url VARCHAR(500),
    
    -- Configuración del bot
    bot_tono ENUM('formal', 'amigable', 'casual') DEFAULT 'amigable',
    bot_horario_inicio TIME DEFAULT '08:00:00',
    bot_horario_fin TIME DEFAULT '20:00:00',
    bot_mensaje_bienvenida TEXT,
    bot_mensaje_fuera_horario TEXT,
    bot_agentes_activos JSON, -- ["ventas", "pagos", "pedidos", "faq"]
    
    -- Estado de WhatsApp
    whatsapp_conectado BOOLEAN DEFAULT FALSE,
    whatsapp_sesion JSON, -- Auth state de Baileys
    
    -- Suscripción
    suscripcion_activa BOOLEAN DEFAULT TRUE,
    trial_hasta DATETIME,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de conversaciones
CREATE TABLE conversaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    negocio_id INT NOT NULL,
    cliente_id INT NOT NULL,
    numero_cliente VARCHAR(20) NOT NULL,
    ultimo_mensaje TEXT,
    mensajes_count INT DEFAULT 0,
    ultimo_mensaje_at TIMESTAMP,
    agente_asignado VARCHAR(50), -- Último agente que respondió
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
);

-- Tabla de mensajes
CREATE TABLE mensajes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversacion_id INT NOT NULL,
    negocio_id INT NOT NULL,
    tipo ENUM('entrada', 'salida') NOT NULL,
    contenido TEXT NOT NULL,
    agente VARCHAR(50), -- Qué agente generó la respuesta
    respuesta_ia BOOLEAN DEFAULT FALSE,
    metadata JSON, -- Para guardar datos adicionales
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id),
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
);

-- Tabla de logs de agente
CREATE TABLE agente_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    negocio_id INT NOT NULL,
    conversacion_id INT NOT NULL,
    mensaje_entrada TEXT,
    intencion_detectada VARCHAR(50),
    agente_utilizado VARCHAR(50),
    respuesta_texto TEXT,
    tokens_usados INT,
    tiempo_respuesta_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id)
);
```

---

## 8. API ENDPOINTS

### 8.1 Autenticación
```
POST /api/auth/login         → Login negocio
POST /api/auth/registro      → Registro nuevo negocio
POST /api/auth/logout        → Logout
GET  /api/auth/verify        → Verificar token
```

### 8.2 WhatsApp (Negocio)
```
GET  /api/whatsapp/status         → Estado de conexión
POST /api/whatsapp/connect        → Iniciar conexión (generar QR)
POST /api/whatsapp/disconnect      → Desconectar
GET  /api/whatsapp/qr             → Obtener QR actual
WS   /ws/whatsapp/:negocioId       → WebSocket para actualizar QR en tiempo real
```

### 8.3 Bot Configuration (Negocio)
```
GET  /api/bot/config          → Obtener configuración
PUT  /api/bot/config          → Actualizar configuración
PUT  /api/bot/config/agentes  → Activar/desactivar agentes
POST /api/bot/test            → Enviar mensaje de prueba
```

### 8.4 Conversaciones
```
GET  /api/conversaciones              → Listar conversaciones
GET  /api/conversaciones/:id           → Detalle de conversación
GET  /api/conversaciones/:id/mensajes → Mensajes de una conversación
POST /api/conversaciones/:id/mensaje  → Enviar mensaje manual
```

### 8.5 Admin
```
GET  /api/admin/negocios              → Todos los negocios
GET  /api/admin/negocios/:id         → Detalle de negocio
PUT  /api/admin/negocios/:id          → Editar negocio
GET  /api/admin/estadisticas          → Estadísticas globales
GET  /api/admin/whatsapps             → Estado de todos los WhatsApps
```

---

## 9. PROMPTS POR AGENTE (Para Azure OpenAI)

### 9.1 Orquestador (Clasificación)
```
Eres un clasificador de intenciones para un chatbot de WhatsApp.
Analiza el mensaje del usuario y determina la intención principal.

Categorías:
- compra: Quiere comprar un producto
- pago: Consulta sobre métodos de pago o quiere confirmar pago
- pedido: Consulta estado de un pedido o quiere hacer seguimiento
- consulta: Pregunta general sobre productos, horarios, ubicación
- queja: Reporta un problema o está insatisfecho
- cancelacion: Quiere cancelar algo
- conversacion: Interacción social o saludo

Responde SOLO con la categoría en minúsculas.
No añadas explicaciones.
```

### 9.2 Agente Ventas (NOMÁ)
```
Eres el asistente de ventas de NOMÁ, una marca de yogur griego artesanal 
hecho con leche fresca y cultivos vivos.

PRODUCTOS:
- Yogur natural normal: 250g - $9,000
- Yogur natural grande: 500g - $18,000

REGLAS:
1. Sé amable, entusiasta y orientado a la venta
2. Destaca la calidad artesanal y ingredientes naturales
3. Sugiere el tamaño grande si pide más de 2
4. Menciona que el pago puede ser en efectivo o por Nequi al 3208303600
5. Cierra la venta preguntando la dirección de entrega
6. NUNCA inventes información sobre productos que no existen
7. Si no sabes algo, di que consultarás y volverás con la respuesta

Formato de respuesta: Máximo 3 oraciones.
```

### 9.3 Agente Pagos (NOMÁ)
```
Eres el agente de pagos de NOMÁ.

INFORMACIÓN DE PAGO:
- Nequi: 3208303600 (enviar comprobante)
- Efectivo: al momento de la entrega

REGLAS:
1. Confirma siempre el monto exacto basado en el pedido
2. Para Nequi, solicita foto del comprobante
3. Valida que el comprobante sea legible y contenga:
   - Monto correcto
   - Fecha del día o anterior
   - Número de teléfono destino correcto
4. Da instrucciones claras y concisas
5. Confirma el pago antes de marcar como pagado

Para validar comprobantes, responde con:
✓ Pago confirmado: [monto] - [fecha]
✗ Error: [razón]
```

---

## 10. WORKFLOWS PRINCIPALES

### 10.1 Registro y Activación de Nuevo Negocio
```
1. Cliente se registra en /registro
   ↓
2. Se crea negocio en BD (plan trial 7 días)
   ↓
3. Redirect a /dashboard/welcome
   ↓
4. Cliente configura su negocio (logo, colores, horarios)
   ↓
5. Cliente va a /dashboard/whatsapp/connect
   ↓
6. Se genera QR único para este negocio
   ↓
7. Cliente escanea con su WhatsApp Business
   ↓
8. Sesión guardada en BD (negocio_id específico)
   ↓
9. ✓ Bot activo y funcionando
```

### 10.2 Mensaje Recibido por WhatsApp
```
1. WhatsApp recibe mensaje
   ↓
2. Baileys detecta mensaje → Instance Manager
   ↓
3. IM identifica negocio por número de WhatsApp
   ↓
4. IM consulta Brain API con mensaje + negocio_id
   ↓
5. Brain clasifica intención
   ↓
6. Brain llama al agente correcto
   ↓
7. Agente genera respuesta
   ↓
8. IM guarda en BD: mensaje, respuesta, agente
   ↓
9. IM envía respuesta por WhatsApp
   ↓
10. Dashboard se actualiza en tiempo real (Socket.io)
```

---

## 11. SEGURIDAD

### 11.1 Aislamiento de Datos
- Cada query SQL incluye `WHERE negocio_id = ?`
- JWT contiene `negocio_id` en el payload
- Middleware valida que el usuario solo acceda a sus datos
- Admin puede ver todo pero con rol especial

### 11.2 Rate Limiting
- 10 mensajes por minuto por conversación
- 100 mensajes por hora por negocio
- Límite de tokens por día según plan

### 11.3 Sanitización
- Todos los inputs se sanitizan antes de guardar
- XSS prevention en respuestas del bot
- Validación de números de teléfono

---

## 12. ESCALABILIDAD

### 12.1 Múltiples Instancias de WhatsApp
```
                    ┌─────────────────────┐
                    │   LOAD BALANCER     │
                    │   (Nginx/HAProxy)   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  ┌──────────┐           ┌──────────┐           ┌──────────┐
  │  API 1   │           │  API 2   │           │  API 3   │
  │ :3002    │           │ :3002    │           │ :3002    │
  └────┬─────┘           └────┬─────┘           └────┬─────┘
       │                     │                     │
  ┌────┴─────┐           ┌────┴─────┐           ┌────┴─────┐
  │ Instance │           │ Instance │           │ Instance │
  │Manager 1│           │Manager 2 │           │Manager 3│
  │  (50bot)│           │  (50bot)│           │  (50bot)│
  └─────────┘           └─────────┘           └─────────┘
       │                     │                     │
  ┌────┴─────┐           ┌────┴─────┐           ┌────┴─────┐
  │WhatsApp1│           │WhatsApp2│           │WhatsApp3│
  │ - 50    │           │ - 50    │           │ - 50    │
  │números  │           │números  │           │números  │
  └─────────┘           └─────────┘           └─────────┘
```

### 12.2 Límites por Plan
| Recurso | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Mensajes/mes | 1,000 | 5,000 | Ilimitado |
| Clientes | 100 | 1,000 | Ilimitado |
| Bots WhatsApp | 1 | 1 | 5 |
| Agentes IA | 3 | 6 | 6 |
| Histórico | 30 días | 1 año | 2 años |

---

## 13. MONITOREO

### 13.1 Métricas a Registrar
- Tiempo de respuesta del bot
- Tasa de respuestas automáticas vs humanas
- Satisfacción del cliente (si se implementa rating)
- Errores por agente
- Uso de tokens
- Conexiones/desconexiones de WhatsApp

### 13.2 Alertas
- WhatsApp desconectado por > 5 minutos
- Tasa de errores > 5%
- Consumo de tokens > 80% del límite
- Sospecha de spam

---

## 14. PRÓXIMOS DESARROLLOS

- [ ] Integración con catálogo de productos
- [ ] Campañas masivas (broadcast)
- [ ] Integración con CRM externo
- [ ] Analítica avanzada con gráficos
- [ ] App móvil para el dueño
- [ ] Widget de WhatsApp para web
- [ ] API pública para integraciones
- [ ] Multi-idioma
- [ ] Transcript a email
- [ ] Grabación de llamadas (futuro)

---

## RESUMEN EJECUTIVO

**ANTIGRAVITY** es una plataforma SaaS que permite a negocios colombianos automatizar su atención al cliente por WhatsApp usando inteligencia artificial multi-agente.

**Componentes clave:**
1. **Dashboard** para cada negocio (configurar bot, ver conversaciones)
2. **Panel Admin** para gestión centralizada
3. **Sistema multi-agente** con roles especializados
4. **Gestión de WhatsApp** por negocio (un número = un bot)
5. **Base de datos aislada** por tenant

**Flujo:** Cliente registra negocio → Conecta WhatsApp → Clientes escriben → Agente IA responde → Dashboard muestra todo

**Modelo de negocio:** Suscripción mensual según plan (Starter $450K, Professional $850K, Enterprise $1.8M COP)
