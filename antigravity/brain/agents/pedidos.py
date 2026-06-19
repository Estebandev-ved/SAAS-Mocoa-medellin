import os
import logging
import re
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()

ESTADOS_PEDIDO = {
    'pendiente_pago': 'Esperando confirmación de pago',
    'pago_enviado': 'Pago recibido, esperando verificación',
    'pago_confirmado': 'Pago verificado',
    'en_preparacion': 'Preparando tu pedido',
    'enviado': 'En camino a ti',
    'entregado': 'Entregado',
    'cancelado': 'Cancelado'
}

def build_system_prompt(negocio_config: dict) -> str:
    nombre = negocio_config.get('nombre', 'este negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    tono = negocio_config.get('bot_tono', 'amigable')
    tiempo_entrega = negocio_config.get('tiempo_entrega', 30)
    
    tono_map = {
        'formal': "Usa un tono formal y profesional.",
        'amigable': "Usa un tono amigable y cálido.",
        'casual': "Usa un tono casual y cercano."
    }
    
    return f"""Eres el gestor de pedidos de {nombre}.

{tono_map.get(tono, tono_map['amigable'])}

ESTADOS POSIBLES:
- pendiente_pago: esperando confirmación de pago
- pago_confirmado: pago verificado
- en_preparacion: preparando el pedido
- enviado: en camino al cliente
- entregado: recibido por el cliente
- cancelado: pedido cancelado

CAPACIDADES:
- Consultar estado de pedido por número o por nombre del cliente
- Modificar pedidos (antes de preparación)
- Cancelar pedidos (con validación)
- Informar tiempo estimado de entrega: {tiempo_entrega} minutos

REGLAS:
- Tiempo estimado de entrega: {tiempo_entrega} minutos
- Si el pedido no existe: pedir el número exacto o el nombre
- Para cancelaciones: confirmar que el cliente está seguro antes de proceder
- Máximo 3 oraciones por respuesta (WhatsApp)"""

def procesar_sync(mensaje: str, contexto: list, negocio_config: dict, system_base: str = None) -> dict:
    system_prompt = system_base if system_base else build_system_prompt(negocio_config)
    
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in contexto[-6:]:
        messages.append({
            "role": msg.get("rol", "user"),
            "content": msg.get("contenido", "")
        })
    
    messages.append({"role": "user", "content": mensaje})
    
    try:
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=messages,
            temperature=0.5,
            max_tokens=400
        )
        
        respuesta = response.choices[0].message.content
        
        datos_accion = detectar_accion(mensaje)
        
        logger.info(f"[AgentePedidos] Respuesta generada, acción: {datos_accion}")
        
        return {
            'respuesta': respuesta,
            'tokens_usados': response.usage.total_tokens,
            'datos_accion': datos_accion
        }
        
    except Exception as e:
        logger.error(f"[AgentePedidos] Error: {e}")
        return {
            'respuesta': "Disculpa, no pude consultar tu pedido. ¿Podrías darme más detalles?",
            'tokens_usados': 0,
            'datos_accion': None
        }

def detectar_accion(mensaje: str) -> dict:
    mensaje_lower = mensaje.lower()
    
    if 'cancelar' in mensaje_lower or 'cancele' in mensaje_lower:
        numero_pedido = extraer_numero_pedido(mensaje)
        return {
            'tipo': 'cancelar_pedido',
            'numero_pedido': numero_pedido
        }
    
    if 'modificar' in mensaje_lower or 'cambiar' in mensaje_lower:
        numero_pedido = extraer_numero_pedido(mensaje)
        return {
            'tipo': 'modificar_pedido',
            'numero_pedido': numero_pedido
        }
    
    if 'estado' in mensaje_lower or 'seguimiento' in mensaje_lower or 'mi pedido' in mensaje_lower:
        numero_pedido = extraer_numero_pedido(mensaje)
        return {
            'tipo': 'consultar_estado',
            'numero_pedido': numero_pedido
        }
    
    return None

def extraer_numero_pedido(texto: str) -> str:
    patrones = [
        r'#?AG-\d{4}',
        r'pedido\s*#?(\d+)',
        r'número\s*(\d+)',
    ]
    
    for patron in patrones:
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            return match.group(0).upper()
    
    numeros = re.findall(r'\d+', texto)
    for num in numeros:
        if len(num) >= 4:
            return f"#AG-{num.zfill(4)}"
    
    return None

async def procesar(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    return procesar_sync(mensaje, contexto.get('mensajes', []), negocio_config)
