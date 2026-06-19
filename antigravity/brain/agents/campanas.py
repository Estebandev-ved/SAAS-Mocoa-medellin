import os
import logging
import time
from typing import List, Dict, Optional
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()


def build_system_prompt(negocio_config: dict, campana: dict) -> str:
    """Build system prompt para el agente de campañas."""
    nombre = negocio_config.get('nombre', 'Negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    tono = negocio_config.get('bot_tono', 'amigable')
    
    mensaje_campana = campana.get('mensaje', '')
    
    tono_map = {
        'formal': "Usa un tono formal y profesional.",
        'amigable': "Usa un tono amigable y cálido.",
        'casual': "Usa un tono casual y moderno."
    }
    
    return f"""Eres {bot_nombre}, asistente de un negocio colombiano llamado {nombre}.
{tono_map.get(tono, tono_map['amigable'])}

Tienes que enviar el siguiente mensaje a tus clientes:
---
{mensaje_campana}
---

Instrucciones:
1. El mensaje debe ser breve (máximo 2 párrafos)
2. Personaliza con el nombre del cliente si es posible
3. No agregues información que no esté en el mensaje de la campaña
4. Si el cliente responde,场均 behave como un agente de ventas normal"""


async def generar_mensaje_personalizado(
    cliente_nombre: str, 
    mensaje_base: str, 
    negocio_config: dict
) -> str:
    """Personaliza el mensaje de campaña para un cliente específico."""
    
    system_prompt = f"""Eres un asistente que personaliza mensajes de campañas.
El mensaje base es: "{mensaje_base}"
El nombre del cliente es: {cliente_nombre}

Personaliza el mensaje para que incluya el nombre del cliente de manera natural.
El mensaje debe mantener el mismo contenido pero sentirse más personal.
Responde SOLO con el mensaje personalizado."""
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Personaliza: {mensaje_base}"}
            ],
            temperature=0.5,
            max_tokens=200
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        logger.error(f"[AgenteCampanas] Error personalizando mensaje: {e}")
        return mensaje_base.replace('{nombre}', cliente_nombre)


async def procesar_respuesta(
    respuesta_cliente: str,
    mensaje_campana: str,
    negocio_config: dict,
    contexto: list
) -> dict:
    """Procesa la respuesta de un cliente a una campaña."""
    
    system_prompt = f"""Eres {negocio_config.get('bot_nombre', 'Asistente')}, asistente de un negocio.
El cliente respondió a una campaña con: "{respuesta_cliente}"

Responde de manera útil y natural según la intención del cliente."""
    
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in contexto[-3:]:
        messages.append({
            "role": msg.get("rol", "user"),
            "content": msg.get("contenido", "")
        })
    
    messages.append({"role": "user", "content": respuesta_cliente})
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=messages,
            temperature=0.7,
            max_tokens=300
        )
        
        return {
            'respuesta': response.choices[0].message.content,
            'tokens_usados': response.usage.total_tokens,
            'tipo': 'respuesta_campana'
        }
        
    except Exception as e:
        logger.error(f"[AgenteCampanas] Error procesando respuesta: {e}")
        return {
            'respuesta': "Gracias por tu respuesta. En breve te contactaremos.",
            'tokens_usados': 0,
            'tipo': 'respuesta_campana'
        }


async def crear_campana(
    negocio_id: int,
    nombre: str,
    mensaje: str,
    destinatarios: List[int],
    programacion: Optional[dict] = None
) -> dict:
    """Crea una nueva campaña."""
    
    return {
        'id': int(time.time()),
        'negocio_id': negocio_id,
        'nombre': nombre,
        'mensaje': mensaje,
        'destinatarios': len(destinatarios),
        'enviados': 0,
        'respuestas': 0,
        'programacion': programacion,
        'estado': 'pendiente',
        'creado_en': time.time()
    }


async def enviar_mensaje_campana(
    cliente_id: int,
    mensaje: str,
    negocio_config: dict
) -> dict:
    """Envía un mensaje de campaña a un cliente."""
    
    return {
        'cliente_id': cliente_id,
        'mensaje': mensaje,
        'enviado': True,
        'timestamp': time.time()
    }