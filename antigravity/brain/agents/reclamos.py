import os
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()

TRIGGERS_ESCALADO = [
    'abogado', 'demanda', 'derecho', 'legal', 'jurídico', 
    'superintedencia', 'defensa del consumidor', 'denunciar',
    '100000', '150000', '200000', 'mas de ', 'más de '
]

def build_system_prompt(negocio_config: dict) -> str:
    nombre = negocio_config.get('nombre', 'este negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    tono = negocio_config.get('bot_tono', 'amigable')
    politicas = negocio_config.get('politicas_devolucion', 'Consultar con el equipo.')
    
    tono_map = {
        'formal': "Responde de manera profesional y empática.",
        'amigable': "Responde de manera empática y cercana.",
        'casual': "Responde de manera casual pero empática."
    }
    
    return f"""Eres el gestor de quejas de {nombre}.
Tu objetivo es resolver el problema del cliente de forma empática y eficiente.

{tono_map.get(tono, tono_map['amigable'])}

POLÍTICAS:
{politicas}

CAPACIDADES:
- Escuchar y validar la queja
- Ofrecer soluciones concretas
- Escalar a humano cuando sea necesario
- Dar seguimiento

TRIGGERS DE ESCALADO HUMANO:
- El cliente menciona datos legales o jurídicos
- Monto en disputa > $100.000
- Tercer contacto por el mismo problema
- Cliente expresa nivel de frustración muy alto

Cuando debas escalar, responde con el texto exacto:
'ESCALAR_HUMANO: [resumen del problema]'
para que el sistema notifique al dueño.

Máximo 4 oraciones por respuesta."""

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
            temperature=0.5,
            max_tokens=500
        )
        
        respuesta = response.choices[0].message.content
        
        datos_accion = None
        if respuesta.startswith('ESCALAR_HUMANO:'):
            datos_accion = {
                'tipo': 'escalar_humano',
                'resumen': respuesta.replace('ESCALAR_HUMANO:', '').strip()
            }
        
        logger.info(f"[AgenteReclamos] Respuesta generada, escalar: {datos_accion is not None}")
        
        return {
            'respuesta': respuesta,
            'tokens_usados': response.usage.total_tokens,
            'datos_accion': datos_accion
        }
        
    except Exception as e:
        logger.error(f"[AgenteReclamos] Error: {e}")
        return {
            'respuesta': "Lamento mucho escuchar esto. Voy a escalar tu caso a nuestro equipo para ayudarte personalmente.",
            'tokens_usados': 0,
            'datos_accion': {'tipo': 'escalar_humano', 'resumen': mensaje}
        }

async def procesar(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    return procesar_sync(mensaje, contexto.get('mensajes', []), negocio_config)
