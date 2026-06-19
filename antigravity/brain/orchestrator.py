import os
import time
import json
import logging
from datetime import datetime
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)

client = get_azure_client()

INTENCIONES = ['compra', 'pago', 'pedido', 'consulta', 'queja', 'cancelacion', 'conversacion']

CLASIFICADOR_SYSTEM = """Eres un clasificador de intenciones para un chatbot de WhatsApp. Analiza el mensaje del usuario y determina la intención principal.

Categorías:
- compra: Quiere comprar un producto
- pago: Consulta sobre métodos de pago o quiere confirmar pago
- pedido: Consulta estado de un pedido o quiere hacer seguimiento
- consulta: Pregunta general sobre productos, horarios, ubicación
- queja: Reporta un problema o está insatisfecho
- cancelacion: Quiere cancelar algo
- conversacion: Interacción social o saludo

Responde SOLO con la categoría en minúsculas.
No añadas explicaciones."""

RESPUESTAS_FALLBACK = {
    'es': "Disculpa, no pude procesar tu mensaje. ¿Podrías reformularlo?",
    'en': "Sorry, I couldn't process your message. Could you rephrase it?"
}

async def clasificar_intencion(mensaje: str, idioma: str = 'es') -> str:
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": CLASIFICADOR_SYSTEM},
                {"role": "user", "content": mensaje}
            ],
            temperature=0,
            max_tokens=10
        )
        
        intencion = response.choices[0].message.content.strip().lower()
        
        if intencion not in INTENCIONES:
            intencion = 'conversacion'
        
        logger.info(f"[Orchestrator] Intención clasificada: {intencion}")
        return intencion
        
    except Exception as e:
        logger.error(f"[Orchestrator] Error clasificando intención: {e}")
        return 'conversacion'

async def despachar(intencion: str, mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    from brain.agents import ventas, pagos, pedidos, faq, reclamos, retencion
    
    agentes = {
        'compra': ventas,
        'pago': pagos,
        'pedido': pedidos,
        'consulta': faq,
        'queja': reclamos,
        'cancelacion': retencion
    }
    
    agente = agentes.get(intencion)
    
    if agente:
        try:
            resultado = await agente.procesar(mensaje, contexto, negocio_config)
            return resultado
        except Exception as e:
            logger.error(f"[Orchestrator] Error en agente {intencion}: {e}")
            return await respuesta_generica(mensaje, contexto, negocio_config)
    
    return await respuesta_generica(mensaje, contexto, negocio_config)

async def respuesta_generica(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    tono = negocio_config.get('bot_tono', 'amigable')
    nombre_bot = negocio_config.get('bot_nombre', 'Asistente')
    
    tonos = {
        'formal': "Responde de manera profesional y cortés",
        'amigable': "Responde de manera amigable y cálida",
        'casual': "Responde de manera casual y moderna"
    }
    
    system_prompt = f"""Eres {nombre_bot}, asistente virtual de un negocio colombiano.
{tonos.get(tono, tonos['amigable'])}
El cliente dice: {mensaje}
Responde de forma breve (máximo 3 oraciones) y útil."""
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": mensaje}
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        return {
            'respuesta': response.choices[0].message.content,
            'intencion': 'conversacion',
            'agente_usado': 'generic',
            'datos_accion': None,
            'tokens_usados': response.usage.total_tokens,
            'tiempo_ms': 0
        }
    except Exception as e:
        logger.error(f"[Orchestrator] Error en respuesta generica: {e}")
        return {
            'respuesta': RESPUESTAS_FALLBACK.get(negocio_config.get('idioma', 'es'), RESPUESTAS_FALLBACK['es']),
            'intencion': 'conversacion',
            'agente_usado': 'generic',
            'datos_accion': None,
            'tokens_usados': 0,
            'tiempo_ms': 0
        }

def procesar_flujo(mensaje: str, contexto: list, negocio_config: dict, cliente_id: int) -> dict:
    tiempo_inicio = time.time()
    
    intencion = clasificar_intencion_sync(mensaje)
    
    agentes_map = {
        'compra': 'ventas',
        'pago': 'pagos',
        'pedido': 'pedidos',
        'consulta': 'faq',
        'queja': 'reclamos',
        'cancelacion': 'retencion',
        'conversacion': 'generic'
    }
    
    agente_usado = agentes_map.get(intencion, 'generic')
    
    tono = negocio_config.get('bot_tono', 'amigable')
    nombre_bot = negocio_config.get('bot_nombre', 'Asistente')
    
    tonos_personalidad = {
        'formal': "Usa un tono formal y profesional. Sé respetuoso y cortés.",
        'amigable': "Usa un tono amigable, cálido y cercano. Haz que el cliente se sienta bienvenido.",
        'casual': "Usa un tono casual y moderno, como hablando con un amigo."
    }
    
    catalog_info = ""
    productos = negocio_config.get('productos', [])
    if productos:
        catalog_info = "PRODUCTOS DISPONIBLES:\n" + "\n".join([
            f"- {p.get('nombre', 'Producto')}: ${p.get('precio', 0):,.0f} COP"
            for p in productos[:15]
        ])
    
    system_base = f"""Eres {nombre_bot}, el asistente virtual de un negocio colombiano.

{tonos_personalidad.get(tono, tonos_personalidad['amigable'])}

{nombre_negocio := negocio_config.get('nombre', 'este negocio')}
{descripcion := negocio_config.get('descripcion_negocio', '')}

{catalog_info}

Horario de atención: {negocio_config.get('horario_inicio', '08:00')} a {negocio_config.get('horario_fin', '20:00')}
"""
    
    from brain.agents import ventas, pagos, pedidos, faq, reclamos, retencion
    
    try:
        if intencion == 'compra':
            resultado = ventas.procesar_sync(mensaje, contexto, negocio_config, system_base)
        elif intencion == 'pago':
            resultado = pagos.procesar_sync(mensaje, contexto, negocio_config, system_base)
        elif intencion == 'pedido':
            resultado = pedidos.procesar_sync(mensaje, contexto, negocio_config, system_base)
        elif intencion == 'consulta':
            resultado = faq.procesar_sync(mensaje, contexto, negocio_config, system_base)
        elif intencion == 'queja':
            resultado = reclamos.procesar_sync(mensaje, contexto, negocio_config, system_base)
        elif intencion == 'cancelacion':
            resultado = retencion.procesar_sync(mensaje, contexto, negocio_config, system_base)
        else:
            resultado = generar_respuesta_simple(mensaje, contexto, system_base)
    except Exception as e:
        logger.error(f"[Orchestrator] Error procesando con agente {agente_usado}: {e}")
        resultado = generar_respuesta_simple(mensaje, contexto, system_base)
    
    tiempo_ms = int((time.time() - tiempo_inicio) * 1000)
    
    return {
        'intencion': intencion,
        'respuesta': resultado.get('respuesta', 'Lo siento, no pude procesar tu solicitud.'),
        'agente_usado': agente_usado,
        'datos_accion': resultado.get('datos_accion'),
        'tokens_usados': resultado.get('tokens_usados', 0),
        'tiempo_ms': tiempo_ms
    }

def clasificar_intencion_sync(mensaje: str) -> str:
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": CLASIFICADOR_SYSTEM},
                {"role": "user", "content": mensaje}
            ],
            temperature=0,
            max_tokens=10
        )
        
        intencion = response.choices[0].message.content.strip().lower()
        
        if intencion not in INTENCIONES:
            intencion = 'conversacion'
        
        return intencion
    except Exception as e:
        logger.error(f"[Orchestrator] Error clasificando: {e}")
        return 'conversacion'

def generar_respuesta_simple(mensaje: str, contexto: list, system_prompt: str) -> dict:
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in contexto[-5:]:
        messages.append({
            "role": msg.get("rol", "user"),
            "content": msg.get("contenido", "")
        })
    
    messages.append({"role": "user", "content": mensaje})
    
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
            'datos_accion': None
        }
    except Exception as e:
        logger.error(f"[Orchestrator] Error generando respuesta: {e}")
        return {
            'respuesta': "Disculpa, no pude procesar tu mensaje. ¿Podrías reformularlo?",
            'tokens_usados': 0,
            'datos_accion': None
        }
