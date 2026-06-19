import os
import logging
import time
from typing import List, Dict, Optional
from brain.azure_client import get_azure_client, get_azure_model
import mysql.connector

logger = logging.getLogger(__name__)
client = get_azure_client()


SYSTEM_PROMPT = """Eres un agente de seguimiento de un negocio colombiano.
Tu objetivo es re-contactar clientes que mostraron interés pero no completaron una compra.

Tu trabajo es:
1. Recordar amablemente al cliente sobre lo que estaba interesado
2. Preguntar si aún está interesado o si necesita más información
3. Ofrecer ayuda adicional si es necesario
4. Ser breve y no invasivo (máximo 2 oraciones)

Nunca:
- Ser insistente o molesto
- Inventar información
- Presionar para comprar"""


async def buscar_clientes_sin_compra(negocio_id: int, horas_sin_compra: int = 2) -> List[dict]:
    """Busca clientes que expresaron intención de compra pero no completaron."""
    
    try:
        conn = mysql.connector.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            user=os.getenv('MYSQL_USER', 'root'),
            password=os.getenv('MYSQL_PASSWORD', ''),
            database=os.getenv('MYSQL_DATABASE', 'antigravity')
        )
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT DISTINCT c.id, c.nombre, c.telefono, 
                   MAX(al.fecha_creacion) as ultimo_mensaje,
                   al.intencion_detectada, al.respuesta_texto
            FROM clientes c
            JOIN agente_logs al ON al.cliente_id = c.id AND al.negocio_id = c.negocio_id
            WHERE c.negocio_id = %s
              AND al.intencion_detectada IN ('compra', 'pedido')
              AND al.fecha_creacion >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              AND NOT EXISTS (
                  SELECT 1 FROM pedidos p 
                  WHERE p.cliente_id = c.id 
                    AND p.estado NOT IN ('cancelado', 'rechazado')
                    AND p.fecha_creacion >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              )
            GROUP BY c.id
            HAVING MAX(al.fecha_creacion) <= DATE_SUB(NOW(), INTERVAL %s HOUR)
        """, (negocio_id, horas_sin_compra))
        
        resultados = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return resultados
        
    except Exception as e:
        logger.error(f"[AgenteSeguimiento] Error buscando clientes: {e}")
        return []


async def generar_mensaje_seguimiento(
    cliente_nombre: str,
    ultimo_producto: str,
    negocio_config: dict
) -> str:
    """Genera un mensaje de seguimiento personalizado."""
    
    nombre_bot = negocio_config.get('bot_nombre', 'Asistente')
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"""
Cliente: {cliente_nombre}
Producto de interés: {ultimo_producto}
Negocio: {nombre_bot}

Genera un mensaje breve de seguimiento (máximo 2 oraciones).
"""}
            ],
            temperature=0.7,
            max_tokens=150
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        logger.error(f"[AgenteSeguimiento] Error generando mensaje: {e}")
        return f"Hola {cliente_nombre}, ¿Aún estás interesado en {ultimo_producto}? Estamos para ayudarte."


async def procesar_respuesta_seguimiento(
    respuesta: str,
    contexto: dict,
    negocio_config: dict
) -> dict:
    """Procesa la respuesta del cliente al mensaje de seguimiento."""
    
    tono = negocio_config.get('bot_tono', 'amigable')
    nombre_bot = negocio_config.get('bot_nombre', 'Asistente')
    
    system = f"""Eres {nombre_bot}, asistente de un negocio.
El cliente respondió a un mensaje de seguimiento.
Responde de manera útil y natural."""
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": respuesta}
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        return {
            'respuesta': response.choices[0].message.content,
            'tokens_usados': response.usage.total_tokens,
            'tipo': 'seguimiento'
        }
        
    except Exception as e:
        logger.error(f"[AgenteSeguimiento] Error procesando respuesta: {e}")
        return {
            'respuesta': "Gracias por responder. ¿En qué podemos ayudarte?",
            'tokens_usados': 0,
            'tipo': 'seguimiento'
        }


async def ejecutar_seguimiento(negocio_id: int, negocio_config: dict) -> dict:
    """Ejecuta el proceso de seguimiento para un negocio."""
    
    clientes = await buscar_clientes_sin_compra(negocio_id, horas_sin_compra=2)
    
    if not clientes:
        return {
            'ejecutado': False,
            'mensaje': 'No hay clientes para seguir',
            'clientes_afectados': 0
        }
    
    mensajes_enviados = 0
    
    for cliente in clientes[:10]:
        try:
            ultimo_producto = cliente.get('respuesta_texto', 'nuestros productos')[:50]
            mensaje = await generar_mensaje_seguimiento(
                cliente.get('nombre', 'Cliente'),
                ultimo_producto,
                negocio_config
            )
            
            logger.info(f"[AgenteSeguimiento] Mensaje para cliente {cliente['id']}: {mensaje}")
            mensajes_enviados += 1
            
        except Exception as e:
            logger.error(f"[AgenteSeguimiento] Error con cliente {cliente['id']}: {e}")
    
    return {
        'ejecutado': True,
        'mensajes_enviados': mensajes_enviados,
        'clientes_afectados': len(clientes)
    }