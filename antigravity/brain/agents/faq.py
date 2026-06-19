import os
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()

def build_system_prompt(negocio_config: dict) -> str:
    nombre = negocio_config.get('nombre', 'este negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    tono = negocio_config.get('bot_tono', 'amigable')
    descripcion = negocio_config.get('descripcion_negocio', '')
    horario_inicio = negocio_config.get('horario_inicio', '08:00:00')[:5]
    horario_fin = negocio_config.get('horario_fin', '20:00:00')[:5]
    direccion = negocio_config.get('direccion', '')
    telefono = negocio_config.get('telefono', '')
    ciudad = negocio_config.get('ciudad', '')
    productos = negocio_config.get('productos', [])
    
    info_negocio = []
    if descripcion:
        info_negocio.append(f"Sobre nosotros: {descripcion}")
    if direccion:
        info_negocio.append(f"Dirección: {direccion}" + (f", {ciudad}" if ciudad else ""))
    if telefono:
        info_negocio.append(f"Teléfono: {telefono}")
    info_negocio.append(f"Horario: {horario_inicio} a {horario_fin}")
    
    catalogo = ""
    if productos:
        catalogo = "PRODUCTOS/SERVICIOS:\n" + "\n".join([
            f"- {p.get('nombre', 'Producto')}"
            + (f": {p.get('descripcion', '')}" if p.get('descripcion') else "")
            for p in productos[:15]
        ])
    
    tono_map = {
        'formal': "Usa un tono formal y profesional.",
        'amigable': "Usa un tono amigable, cálido y cercano.",
        'casual': "Usa un tono casual y moderno."
    }
    
    return f"""Eres el asistente informativo de {nombre}.

{tono_map.get(tono, tono_map['amigable'])}

INFORMACIÓN DEL NEGOCIO:
{chr(10).join(info_negocio)}

{catalogo}

CAPACIDADES:
- Responder preguntas frecuentes
- Dar información de productos (características, disponibilidad)
- Informar horarios y ubicación
- Dar datos de contacto

REGLA: Si no sabes la respuesta exacta, di que consultarás con el equipo y avisarás.
Máximo 3 oraciones por respuesta."""

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
        
        logger.info(f"[AgenteFAQ] Respuesta generada")
        
        return {
            'respuesta': response.choices[0].message.content,
            'tokens_usados': response.usage.total_tokens,
            'datos_accion': None
        }
        
    except Exception as e:
        logger.error(f"[AgenteFAQ] Error: {e}")
        return {
            'respuesta': "Disculpa, no pude responder tu consulta. ¿Podrías reformular la pregunta?",
            'tokens_usados': 0,
            'datos_accion': None
        }

async def procesar(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    return procesar_sync(mensaje, contexto.get('mensajes', []), negocio_config)
