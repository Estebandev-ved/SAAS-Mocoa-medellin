# -*- coding: utf-8 -*-
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time
import logging
import os
import redis
import json
import mysql.connector

from brain.intent import detectar_intencion
from brain.extractor import extraer_pedido
from brain.context_manager import context_manager
from brain.prompt_builder import prompt_builder
from brain.router import gpt_router
from brain.orchestrator import procesar_flujo, clasificar_intencion_sync
from brain.orchestrator_async import proceso_async, iniciar_sistema_async

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ANTIGRAVITY Brain", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=0,
    decode_responses=True
)

class ProcesarRequest(BaseModel):
    mensaje: str
    contexto: list
    negocio_id: int
    cliente_id: int

class VerificarPagoRequest(BaseModel):
    imagen_base64: str
    negocio_id: int
    total_esperado: float

@app.get("/")
async def root():
    return {"status": "ok", "message": "ANTIGRAVITY Brain v2.0 funcionando", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}

def get_negocio_config(negocio_id: int) -> dict:
    try:
        conn = mysql.connector.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            user=os.getenv('MYSQL_USER', 'root'),
            password=os.getenv('MYSQL_PASSWORD', ''),
            database=os.getenv('MYSQL_DATABASE', 'antigravity')
        )
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT n.*, 
                   GROUP_CONCAT(p.id, '::', p.nombre, '::', p.precio, '::', COALESCE(p.stock, 0) SEPARATOR '||') as productos
            FROM negocios n
            LEFT JOIN productos p ON p.negocio_id = n.id AND p.activo = 1
            WHERE n.id = %s
            GROUP BY n.id
        """, (negocio_id,))
        result = cursor.fetchone()
        
        modulos_activos = []
        if result:
            cursor.execute("SELECT modulo_name FROM negocio_modulos WHERE negocio_id = %s AND activo = 1", (negocio_id,))
            modulos_rows = cursor.fetchall()
            modulos_activos = [m['modulo_name'] for m in modulos_rows] if modulos_rows else []
        
        cursor.close()
        conn.close()
        
        if not result:
            return _default_config()
        
        productos = []
        if result.get('productos'):
            for p in result['productos'].split('||'):
                parts = p.split('::')
                if len(parts) >= 4:
                    productos.append({
                        'id': int(parts[0]),
                        'nombre': parts[1],
                        'precio': float(parts[2]),
                        'stock': int(parts[3])
                    })
        
        return {
            'id': result['id'],
            'nombre': result['nombre'],
            'descripcion_negocio': result.get('descripcion_negocio', ''),
            'bot_nombre': result.get('bot_nombre', 'Asistente'),
            'bot_tono': result.get('bot_tono', 'amigable'),
            'horario_inicio': str(result.get('horario_activo_inicio', '08:00:00'))[:5],
            'horario_fin': str(result.get('horario_activo_fin', '20:00:00'))[:5],
            'direccion': result.get('direccion', ''),
            'telefono': result.get('telefono', ''),
            'ciudad': result.get('ciudad', ''),
            'numero_nequi': result.get('numero_nequi', ''),
            'numero_bancolombia': result.get('numero_bancolombia', ''),
            'metodos_pago': json.loads(result.get('metodos_pago_activos', '[]')) if result.get('metodos_pago_activos') else ['Nequi', 'Bancolombia'],
            'productos': productos,
            'plan': result.get('plan', 'starter'),
            'whatsapp_conectado': result.get('whatsapp_conectado', False),
            'tiempo_entrega': 30,
            'modulos_activos': modulos_activos
        }
        
    except Exception as e:
        logger.error(f"[Brain] Error cargando config negocio {negocio_id}: {e}")
        return _default_config()

def _default_config():
    return {
        'nombre': 'Tu Negocio',
        'descripcion_negocio': '',
        'bot_nombre': 'Asistente',
        'bot_tono': 'amigable',
        'horario_inicio': '08:00',
        'horario_fin': '20:00',
        'direccion': '',
        'telefono': '',
        'ciudad': '',
        'numero_nequi': '',
        'numero_bancolombia': '',
        'metodos_pago': ['Nequi', 'Bancolombia'],
        'productos': [],
        'plan': 'starter',
        'whatsapp_conectado': False,
        'tiempo_entrega': 30,
        'modulos_activos': []
    }

def guardar_log_agente(negocio_id: int, cliente_id: int, intencion: str, agente: str, 
                       mensaje_entrada: str, respuesta: str, tokens: int, tiempo_ms: int):
    try:
        conn = mysql.connector.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            user=os.getenv('MYSQL_USER', 'root'),
            password=os.getenv('MYSQL_PASSWORD', ''),
            database=os.getenv('MYSQL_DATABASE', 'antigravity')
        )
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO agente_logs 
            (negocio_id, cliente_id, intencion_detectada, agente_utilizado, 
             mensaje_entrada, respuesta_texto, tokens_usados, tiempo_respuesta_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (negocio_id, cliente_id, intencion, agente, mensaje_entrada, respuesta, tokens, tiempo_ms))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        redis_client.incr(f"stats:agente_logs:{negocio_id}:{time.strftime('%Y-%m-%d')}")
        
    except Exception as e:
        logger.error(f"[Brain] Error guardando log agente: {e}")

@app.post("/procesar")
async def procesar_mensaje(request: ProcesarRequest):
    tiempo_inicio = time.time()
    
    logger.info(f"[Brain] Procesando mensaje cliente {request.cliente_id} negocio {request.negocio_id}")
    
    try:
        negocio_config = get_negocio_config(request.negocio_id)
        
        resultado = await proceso_async(
            mensaje=request.mensaje,
            contexto={'mensajes': request.contexto},
            negocio_config=negocio_config,
            cliente_id=request.cliente_id
        )
        
        context_manager.save_message(request.negocio_id, request.cliente_id, "cliente", request.mensaje)
        context_manager.save_message(request.negocio_id, request.cliente_id, "bot", resultado.get('respuesta', ''))
        
        tiempo_procesamiento = round((time.time() - tiempo_inicio) * 1000)
        
        guardar_log_agente(
            request.negocio_id, request.cliente_id,
            resultado.get('intencion', 'conversacion'), resultado.get('agente_usado', 'async'),
            request.mensaje, resultado.get('respuesta', ''),
            resultado.get('tokens_usados', 0), tiempo_procesamiento
        )
        
        return {
            "intencion": resultado.get('intencion', 'conversacion'),
            "respuesta": resultado.get('respuesta', ''),
            "agente_usado": resultado.get('agente_usado', 'async'),
            "datos_accion": resultado.get('datos_accion'),
            "tokens_usados": resultado.get('tokens_usados', 0),
            "tiempo_ms": tiempo_procesamiento
        }
        
    except Exception as e:
        logger.error(f"[Brain] Error procesando mensaje: {str(e)}")
        return {
            "intencion": "error",
            "respuesta": "Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías repetirlo?",
            "agente_usado": "error",
            "datos_accion": None,
            "tokens_usados": 0,
            "tiempo_ms": 0,
            "error": str(e)
        }

@app.post("/verificar-pago")
async def verificar_pago(request: VerificarPagoRequest):
    logger.info(f"[Brain] Verificando pago negocio {request.negocio_id}, esperado: ${request.total_esperado}")
    
    if not request.imagen_base64 or len(request.imagen_base64) < 100:
        return {
            "valido": False,
            "error": "Imagen no proporcionada o muy corta"
        }
    
    try:
        from brain.azure_client import get_azure_client, get_azure_model
        client = get_azure_client()
        
        if not os.getenv('AZURE_OPENAI_API_KEY') and not os.getenv('OPENAI_API_KEY'):
            return {
                "valido": False,
                "error": "API key de OpenAI o Azure no configurada"
            }
        
        respuesta = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Analiza esta imagen de un comprobante de pago colombiano (Nequi, Bancolombia, Bold, Daviplata). Extrae:
1. Es un comprobante real?
2. Cual es el monto mostrado?
3. Que banco o app es?
4. Que fecha tiene?

Responde SOLO en JSON: {"es_valido": true/false, "monto": numero, "banco": "nombre", "fecha": "YYYY-MM-DD", "error": "razon si no es valido"}"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{request.imagen_base64}"
                            }
                        }
                    ]
                }
            ],
            temperature=0,
            max_tokens=300
        )
        
        contenido = respuesta.choices[0].message.content
        try:
            datos = json.loads(contenido)
        except:
            datos = {"es_valido": False, "monto": 0, "banco": "desconocido", "fecha": None, "error": "No se pudo parsear"}
        
        tolerancia = 1000
        monto_valido = abs(datos.get("monto", 0) - request.total_esperado) <= tolerancia
        
        return {
            "valido": datos.get("es_valido", False) and monto_valido,
            "monto": datos.get("monto", 0),
            "banco": datos.get("banco", "desconocido"),
            "fecha": datos.get("fecha"),
            "monto_esperado": request.total_esperado,
            "diferencia": abs(datos.get("monto", 0) - request.total_esperado),
            "error": datos.get("error")
        }
        
    except Exception as e:
        logger.error(f"[Brain] Error verificando pago: {str(e)}")
        return {
            "valido": False,
            "error": str(e)
        }

@app.post("/generar-respuesta-custom")
async def generar_respuesta_custom(request: ProcesarRequest):
    logger.info(f"[Brain] Generando respuesta custom negocio {request.negocio_id}")
    
    try:
        negocio_config = get_negocio_config(request.negocio_id)
        
        system_prompt = f"""Eres {negocio_config.get('bot_nombre', 'Asistente')}, asistente virtual.
El dueno del negocio esta conversando manualmente. Sugiere una respuesta breve y util."""
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "user", "content": f"Cliente dice: {request.mensaje}"})
        
        gpt_result = gpt_router.call_gpt(request.negocio_id, messages, temperature=0.5)
        
        return {
            "sugerencia": gpt_result.get("response", "Gracias por escribirnos") if gpt_result.get("success") else "Gracias por contactarnos"
        }
        
    except Exception as e:
        logger.error(f"[Brain] Error generando respuesta custom: {str(e)}")
        return {"sugerencia": "Gracias por contactarnos"}

@app.get("/catalogo/invalidar/{negocio_id}")
async def invalidar_catalogo(negocio_id: int):
    prompt_builder.invalidate_cache(negocio_id)
    redis_client.delete(f"config:{negocio_id}")
    return {"success": True, "mensaje": "Cache del catálogo invalidado"}

@app.get("/stats/{negocio_id}")
async def get_stats(negocio_id: int):
    stats = gpt_router.get_stats(negocio_id)
    negocio_config = get_negocio_config(negocio_id)
    stats['negocio'] = negocio_config.get('nombre', 'Desconocido')
    return stats

@app.get("/config/{negocio_id}")
async def get_config(negocio_id: int):
    config = get_negocio_config(negocio_id)
    return config

@app.on_event("startup")
async def startup_event():
    logger.info("[Brain] Iniciando sistema multi-agente...")
    await iniciar_sistema_async()
    logger.info("[Brain] Sistema multi-agente activo")

@app.get("/agentes/stats")
async def get_agentes_stats():
    """Retorna estadisticas globales del sistema multi-agente."""
    from brain.orchestrator_async import get_maestro
    from brain.presupuesto import get_presupuesto
    from brain.monitor import MonitorCarga
    
    maestro = get_maestro()
    presupuesto = get_presupuesto()
    
    stats = await maestro.obtener_stats()
    
    stats['supervisores_detalle'] = []
    for negocio_id, supervisor in maestro.supervisores.items():
        stats['supervisores_detalle'].append({
            'negocio_id': negocio_id,
            'workers_activos': supervisor.obtener_workers_activos(),
            'max_workers': supervisor.MAX_WORKERS_POR_NEGOCIO,
            'mensajes_minuto': supervisor.mensajes_ultimo_minuto,
            'ultimo_mensaje': supervisor.ultimo_mensaje
        })
    
    return stats

@app.get("/agentes/presupuesto/{negocio_id}")
async def get_presupuesto_negocio(negocio_id: int):
    """Retorna el estado del presupuesto de tokens de un negocio."""
    from brain.presupuesto import get_presupuesto
    
    presupuesto = get_presupuesto()
    negocio_config = get_negocio_config(negocio_id)
    plan = negocio_config.get('plan', 'starter')
    
    return presupuesto.obtener_stats(negocio_id, plan)

@app.post("/agentes/ejecutar-seguimiento/{negocio_id}")
async def ejecutar_seguimiento(negocio_id: int):
    """Ejecuta el agente de seguimiento para un negocio."""
    from brain.agents.seguimiento import ejecutar_seguimiento
    
    negocio_config = get_negocio_config(negocio_id)
    resultado = await ejecutar_seguimiento(negocio_id, negocio_config)
    
    return resultado

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
