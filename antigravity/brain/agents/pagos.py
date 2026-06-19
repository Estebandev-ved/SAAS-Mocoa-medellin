import os
import json
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()

def build_system_prompt(negocio_config: dict) -> str:
    nombre = negocio_config.get('nombre', 'este negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    metodos_pago = negocio_config.get('metodos_pago', [])
    numero_nequi = negocio_config.get('numero_nequi', '')
    numero_bancolombia = negocio_config.get('numero_bancolombia', '')
    
    info_pago = []
    if numero_nequi:
        info_pago.append(f"Nequi: {numero_nequi}")
    if numero_bancolombia:
        info_pago.append(f"Bancolombia: {numero_bancolombia}")
    
    if isinstance(metodos_pago, list):
        for m in metodos_pago:
            if isinstance(m, dict):
                if m.get('tipo') == 'nequi' and not numero_nequi:
                    info_pago.append(f"Nequi: {m.get('numero', '')}")
                elif m.get('tipo') == 'bancolombia' and not numero_bancolombia:
                    info_pago.append(f"Bancolombia: {m.get('numero', '')}")
    
    info_str = "\n".join(info_pago) if info_pago else "Consultar métodos de pago disponibles"
    
    return f"""Eres el agente de pagos de {nombre}.

INFORMACIÓN DE PAGO:
{info_str}

REGLAS:
1. Confirma siempre el monto exacto del pedido
2. Para Nequi/Bancolombia: solicita comprobante
3. Valida que el comprobante sea legible y tenga:
   - Monto correcto
   - Fecha del día o anterior
   - Número de teléfono destino correcto
4. Da instrucciones claras y concisas
5. Confirma antes de marcar como pagado

Para validar: responde con
✓ Pago confirmado: [monto] - [fecha]
✗ Error: [razón]

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
            temperature=0.3,
            max_tokens=400
        )
        
        respuesta = response.choices[0].message.content
        
        datos_accion = None
        if '✓' in respuesta or 'confirmado' in respuesta.lower():
            monto = extraer_monto(mensaje)
            if monto:
                datos_accion = {
                    'tipo': 'confirmar_pago',
                    'monto': monto
                }
        
        logger.info(f"[AgentePagos] Respuesta generada")
        
        return {
            'respuesta': respuesta,
            'tokens_usados': response.usage.total_tokens,
            'datos_accion': datos_accion
        }
        
    except Exception as e:
        logger.error(f"[AgentePagos] Error: {e}")
        return {
            'respuesta': "Disculpa, no pude procesar la información de pago. ¿Podrías intentarlo de nuevo?",
            'tokens_usados': 0,
            'datos_accion': None
        }

def extraer_monto(texto: str) -> float:
    import re
    numeros = re.findall(r'\$?([\d.,]+)\s*(?:COP|USD|pesos)?', texto.lower())
    
    for num in numeros:
        limpio = num.replace('.', '').replace(',', '')
        try:
            return float(limpio)
        except:
            pass
    
    return 0.0

async def verificar_comprobante(imagen_base64: str, total_esperado: float) -> dict:
    prompt_vision = """Analiza este comprobante de pago colombiano.
Detecta si es Nequi, Bancolombia, Bold o Daviplata.
Extrae el monto. Responde SOLO en JSON:
{ "es_valido": true/false, "monto": numero, "banco": "nombre", "fecha": "YYYY-MM-DD", "error": "razón si no es válido" }"""
    
    try:
        if not imagen_base64 or len(imagen_base64) < 100:
            return {
                'valido': False,
                'error': 'Imagen no proporcionada o inválida'
            }
        
        if not os.getenv('OPENAI_API_KEY'):
            return {
                'valido': False,
                'error': 'API key de OpenAI no configurada'
            }
        
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_vision},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{imagen_base64}"}}
                    ]
                }
            ],
            temperature=0,
            max_tokens=300
        )
        
        contenido = response.choices[0].message.content
        
        try:
            datos = json.loads(contenido)
        except:
            datos = {"es_valido": False, "monto": 0, "banco": "desconocido", "fecha": None, "error": "No se pudo parsear la respuesta"}
        
        tolerancia = 1000
        monto_valido = abs(datos.get("monto", 0) - total_esperado) <= tolerancia
        
        return {
            'valido': datos.get("es_valido", False) and monto_valido,
            'monto_detectado': datos.get("monto", 0),
            'banco': datos.get("banco", "desconocido"),
            'fecha': datos.get("fecha"),
            'monto_esperado': total_esperado,
            'diferencia': abs(datos.get("monto", 0) - total_esperado),
            'error': datos.get("error")
        }
        
    except Exception as e:
        logger.error(f"[AgentePagos] Error verificando comprobante: {e}")
        return {
            'valido': False,
            'error': str(e)
        }

async def procesar(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    return procesar_sync(mensaje, contexto.get('mensajes', []), negocio_config)
