# Sistema Multi-Agente con Auto-Escalado - ANTIGRAVITY

## Estado: Implementado (Fase 1-4)

Este documento describe el sistema multi-agente implementado. Usa este archivo para entender el estado actual y continuar el desarrollo.

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                  AGENTE MAESTRO                     │
│         (Director Orquestador — 1 siempre activo)   │
│  • Recibe todos los mensajes entrantes              │
│  • Evalúa carga del sistema                         │
│  • Decide cuántos sub-agentes lanzar                │
│  • Asigna trabajo por negocio_id                    │
└────────────────────┬────────────────────────────────┘
                     │ spawn / kill
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│Supervisor│    │Supervisor│    │Supervisor│
│Negocio A│    │Negocio B│    │ Pool    │
│         │    │         │    │ General │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
  Worker          Worker       Worker(s)
  Worker          Worker
```

---

## Archivos del Sistema

### Core (Capa 1 - Maestro)

| Archivo | Descripción |
|---------|-------------|
| `brain/orchestrator_async.py` | AgenteMaestro con asyncio.Queue, funciones `proceso_async()` e `iniciar_sistema_async()` |
| `brain/supervisor.py` | Clase Supervisor por negocio con gestión de workers |
| `brain/worker.py` | Clase Worker reutilizable que ejecuta agentes |
| `brain/monitor.py` | Motor de auto-escalado (umbrales, decisiones) |
| `brain/presupuesto.py` | Control de tokens por plan (starter: 50k, professional: 200k, enterprise: ilimitado) |

### Agentes Especializados

| Archivo | Descripción |
|---------|-------------|
| `brain/agents/ventas.py` | Ya existía - procesamiento de ventas |
| `brain/agents/pagos.py` | Ya existía |
| `brain/agents/pedidos.py` | Ya existía |
| `brain/agents/faq.py` | Ya existía |
| `brain/agents/reclamos.py` | Ya existía |
| `brain/agents/retencion.py` | Ya existía |
| `brain/agents/campanas.py` | NUEVO - Campañas masivas programadas |
| `brain/agents/seguimiento.py` | NUEVO - Re-engagement automático (2h después de intención sin compra) |
| `brain/agents/escalacion.py` | NUEVO - Detecta frustración y deriva a humano |

### API

| Archivo | Descripción |
|---------|-------------|
| `brain/main.py` | Endpoints FastAPI del Brain |
| `api/routes/agentes.js` | NUEVO - Endpoints para dashboard de agentes |
| `api/index.js` | Registrada ruta `/api/agentes` |

### Base de Datos

| Archivo | Cambios |
|---------|---------|
| `db/schema.sql` | Nuevas tablas: `notificaciones`, `campanhas` |

---

## Configuración del Sistema

### Límites (en `brain/supervisor.py`)

```python
MAX_WORKERS_POR_NEGOCIO = 3      # Máximo 3 Workers en paralelo por negocio
MAX_WORKERS_GLOBAL = 20          # Máximo 20 Workers en total
MIN_WORKERS = 1                  # Siempre hay al menos 1 Worker listo
SPAWN_COOLDOWN = 5               # Segundos entre cada decisión de escalar
```

### Presupuesto de Tokens (en `brain/presupuesto.py`)

```python
LIMITES = {
    'starter': 50_000,
    'professional': 200_000,
    'enterprise': 999_999_999
}
```

### Umbrales del Monitor (en `brain/monitor.py`)

```python
UMBRAL_SPAWN_COLA = 10           # Spawn si cola > 10
UMBRAL_KILL_COLA = 2             # Kill si cola < 2
UMBRAL_SPAWN_TIEMPO_MS = 3000    # Spawn si tiempo > 3s
UMBRAL_KILL_TIEMPO_MS = 500      # Kill si tiempo < 0.5s
```

---

## Endpoints del Sistema

### Brain (Puerto 8000)

| Endpoint | Descripción |
|----------|-------------|
| `POST /procesar` | Procesa mensajes usando el sistema async |
| `GET /agentes/stats` | Estadísticas globales del sistema multi-agente |
| `GET /agentes/presupuesto/{negocio_id}` | Tokens usados por negocio |
| `POST /agentes/ejecutar-seguimiento/{negocio_id}` | Ejecuta agente de seguimiento |

### API (Puerto 3002)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/agentes/stats` | Stats desde API (llama al Brain) |
| `GET /api/agentes/presupuesto` | Presupuesto del negocio actual |
| `GET /api/agentes/logs` | Logs de agentes |
| `GET /api/agentes/intenciones` | Intenciones detectadas |
| `POST /api/agentes/seguimiento/ejecutar` | Ejecuta seguimiento |

---

## Integración Actual

El sistema está integrado en `brain/main.py`:

1. **Startup**: `iniciar_sistema_async()` se ejecuta cuando inicia FastAPI
2. **Endpoint `/procesar`**: Usa `proceso_async()` en lugar del flujo síncrono
3. **Logging**: Los logs de agente se guardan en `agente_logs`

---

## Pendientes / Siguientes Pasos

### Completado (Marzo 2026)

- ✅ **Rutas Admin en App.jsx** - /admin/overview, /admin/negocios, /admin/agentes
- ✅ **Columnas suspendido en schema** - suspendido, suspendido_razon, suspended_at
- ✅ **Script create-admin.js** - Crear admin desde CLI
- ✅ **Login redirige admins** - Si rol=admin → /admin/overview
- ✅ **AgentesPage.jsx** - Dashboard de agentes con KPIs, supervisores, presupuesto
- ✅ **Socket.IO push** - stats de agentes cada 15 segundos
- ✅ **Fallback síncrono** - Si falla async, usa orchestrator.py original

### Alta Prioridad

1. **Testing**: No hay tests unitarios para el sistema multi-agente
2. **Validar ejecución**: Probar que el sistema funciona end-to-end

### Media Prioridad

4. **Fallback**: Si el sistema async falla, debería caer al sistema síncrono original
5. **Cola persistente**: Usar Redis Streams en lugar de asyncio.Queue para producción
6. **Métricas en DB**: Guardar stats del monitor en la base de datos

### Baja Prioridad

7. **Agente Guardia Horario**: Responder fuera de horario con mensaje configurado
8. **Agente Analytics**: Agente observador que solo registra métricas
9. **Confirmación de pago**: Detectar comprobantes en imágenes

---

## Cómo Iniciar el Sistema

```bash
# Terminal 1 - Brain (puerto 8000)
cd antigravity
python -m brain.main

# Terminal 2 - API (puerto 3002)
cd api
node index.js
```

---

## Notas para la siguiente IA

- El sistema usa el modelo `gpt-4o-mini` para clasificación de intenciones
- Los agentes existentes (`ventas`, `pagos`, etc.) tienen funciones `procesar_sync()` que funcionan con el Worker
- La configuración de negocio se carga desde MySQL en cada request
- El presupuesto de tokens se controla por plan de suscripción
- El archivo `orchestrator.py` original sigue existiendo pero no se usa activamente

---

## Errores Conocidos

- El contador de mensajes por minuto del Supervisor puede fallar si no hay event loop corriendo
- El sistema async no tiene fallback al sistema síncrono si falla

---

*Documento generado: Marzo 2026*
*Proyecto: ANTIGRAVITY - Bot NOMA*