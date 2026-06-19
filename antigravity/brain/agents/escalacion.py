import os
import logging
import time
from typing import List, Dict, Optional, Tuple
from brain.azure_client import get_azure_client, get_azure_model
import mysql.connector

logger = logging.getLogger(__name__)
client = get_azure_client()

SYSTEM_PROMPT = """Eres un analizador de conversaciones. Tu trabajo es detectar cuando un cliente está frustrado
o cuando el bot no puede ayudarle adecuadamente.

Señales de frustración:
- Mensajes confusos o repetitivos
- Uso de mayúsculas (GRITAR)
- Palabras como "no entiendo", "esto no sirve", "no funciona", "estoy cansado"
- Múltiples mensajes sin respuesta satisfactoria

Señales de que el bot no puede ayudar:
- El cliente pide hablar con humano
- Preguntas fuera del dominio del negocio
- Problemas técnicos que el bot no puede resolver
- Solicitudes complejas que requieren intervención humana

Responde con JSON: {"escalar": true/false, "razon": "explicación breve", "urgencia": "alta/media/baja"}"""


async def analizar_frustracion(mensajes_recientes: List[dict]) -> Tuple[bool, str, str]:
    """Analiza si el cliente está frustrado basándose en los mensajes recientes."""
    
    if len(mensajes_recientes) < 2:
        return False, "", "baja"
    
    mensajes_texto = "\n".join([
        f"Cliente: {msg.get('contenido', '')}" 
        for msg in mensajes_recientes[-4:]
    ])
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analiza estos mensajes:\n{mensajes_texto}\n\nResponde en JSON."}
            ],
            temperature=0.3,
            max_tokens=100
        )
        
        import json
        try:
            resultado = json.loads(response.choices[0].message.content)
            return (
                resultado.get('escalar', False),
                resultado.get('razon', ''),
                resultado.get('urgencia', 'baja')
            )
        except:
            return False, "", "baja"
            
    except Exception as e:
        logger.error(f"[AgenteEscalacion] Error analizando: {e}")
        return False, "", "baja"


async def debe_escalar(
    negocio_id: int, 
    cliente_id: int, 
    mensaje: str,
    intencion: str
) -> Tuple[bool, str]:
    """Determina si la conversación debe ser escalada a un humano."""
    
    if intencion in ['queja', 'cancelacion']:
        return True, "El cliente reportó un problema que requiere atención personalizada"
    
    try:
        conn = mysql.connector.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            user=os.getenv('MYSQL_USER', 'root'),
            password=os.getenv('MYSQL_PASSWORD', ''),
            database=os.getenv('MYSQL_DATABASE', 'antigravity')
        )
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT contenido, rol
            FROM agente_logs
            WHERE negocio_id = %s AND cliente_id = %s
            ORDER BY fecha_creacion DESC
            LIMIT 5
        """, (negocio_id, cliente_id))
        
        mensajes_recientes = cursor.fetchall()
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"[AgenteEscalacion] Error BD: {e}")
        mensajes_recientes = []
    
    escalar, razon, urgencia = await analizar_frustracion(mensajes_recientes)
    
    if escalar:
        return True, razon
    
    frases_escalar = [
        "quiero hablar con un humano",
        "hablar con persona",
        "atención humana",
        "encargado",
        "dueño",
        "gerente",
        "no puedo resolver",
        "necesito ayuda de una persona"
    ]
    
    mensaje_lower = mensaje.lower()
    for frase in frases_escalar:
        if frase in mensaje_lower:
            return True, "El cliente solicitó atención humana"
    
    return False, ""


async def notificar_dueño(negocio_id: int, cliente_id: int, razon: str) -> dict:
    """Notifica al dueño del negocio sobre una conversación que necesita atención."""
    
    try:
        conn = mysql.connector.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            user=os.getenv('MYSQL_USER', 'root'),
            password=os.getenv('MYSQL_PASSWORD', ''),
            database=os.getenv('MYSQL_DATABASE', 'antigravity')
        )
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO notificaciones (negocio_id, tipo, titulo, mensaje, datos)
            VALUES (%s, 'escalacion', 'Cliente requiere atención', %s, %s)
        """, (negocio_id, razon, f'{{"cliente_id": {cliente_id}}}'))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {'notificado': True, 'timestamp': time.time()}
        
    except Exception as e:
        logger.error(f"[AgenteEscalacion] Error notificando: {e}")
        return {'notificado': False, 'error': str(e)}


async def generar_respuesta_escalacion(negocio_config: dict) -> str:
    """Genera la respuesta cuando se escala a humano."""
    
    nombre = negocio_config.get('nombre', 'el negocio')
    
    return f"""Entiendo tu necesidad. Un miembro de nuestro equipo de {nombre} te contactará pronto para ayudarte personalmente.

¿Podrías darme más detalles sobre lo que necesitas para que podamos asistirte mejor?"""