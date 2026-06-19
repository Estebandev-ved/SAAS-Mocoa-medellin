import os
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()

SEÑALES_CANCELACION = [
    'no voy a volver', 'no voy a volver', 'no volveré', 'ya no voy',
    'competencia', 'otro lugar', 'otro negocio', 'muy caro', 
    'carísimo', 'cancelar suscripción', 'darme de baja'
]

def build_system_prompt(negocio_config: dict) -> str:
    nombre = negocio_config.get('nombre', 'este negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    tono = negocio_config.get('bot_tono', 'amigable')
    ofertas = negocio_config.get('ofertas_retencion', [])
    
    ofertas_str = "No hay ofertas activas en este momento."
    if ofertas:
        ofertas_str = "\n".join([
            f"- {o.get('nombre', 'Oferta')}: {o.get('descripcion', '')}"
            for o in ofertas[:5]
        ])
    
    tono_map = {
        'formal': "Usa un tono formal pero empático.",
        'amigable': "Usa un tono amigable y comprensivo.",
        'casual': "Usa un tono casual pero respetuoso."
    }
    
    return f"""Eres el especialista en retención de clientes de {nombre}.
Tu objetivo es reconectar con el cliente y ofrecer alternativas.

{tono_map.get(tono, tono_map['amigable'])}

SEÑALES DE CANCELACIÓN:
- El cliente dice que no va a volver
- Menciona la competencia
- Dice que es muy caro
- Quiere cancelar suscripción o servicio

OFERTAS DISPONIBLES:
{ofertas_str}

ESTRATEGIA:
1. Valida su experiencia sin ponerte a la defensiva
2. Pregunta por la razón específica
3. Ofrece la oferta más relevante según la razón
4. Si aun así quiere irse: agradece y deja la puerta abierta para regresar

REGLAS:
- NO insistas demasiado
- NO prometas lo que no puedes cumplir
- La satisfacción del cliente es lo primero
- Máximo 4 oraciones por respuesta"""

def procesar_sync(mensaje: str, contexto: list, negocio_config: dict, system_base: str = None) -> dict:
    system_prompt = system_base if system_base else build_system_prompt(negocio_config)
    
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in contexto[-8:]:
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
            max_tokens=500
        )
        
        logger.info(f"[AgenteRetencion] Respuesta generada")
        
        return {
            'respuesta': response.choices[0].message.content,
            'tokens_usados': response.usage.total_tokens,
            'datos_accion': None
        }
        
    except Exception as e:
        logger.error(f"[AgenteRetencion] Error: {e}")
        return {
            'respuesta': "Agradecemos tu preferencia. Si en el futuro decides volver, serás bienvenido.",
            'tokens_usados': 0,
            'datos_accion': None
        }

async def procesar(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    return procesar_sync(mensaje, contexto.get('mensajes', []), negocio_config)
