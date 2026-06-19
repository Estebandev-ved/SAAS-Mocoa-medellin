import os
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)
client = get_azure_client()

TRIGGERS = ["quiero", "pedir", "comprar", "helado", "yogur", "probar", "necesito", "encargar", " quiero ", " deseo "]

def build_system_prompt(negocio_config: dict) -> str:
    nombre = negocio_config.get('nombre', 'este negocio')
    bot_nombre = negocio_config.get('bot_nombre', 'Asistente')
    tono = negocio_config.get('bot_tono', 'amigable')
    descripcion = negocio_config.get('descripcion_negocio', '')
    horario_inicio = negocio_config.get('horario_inicio', '08:00:00')[:5]
    horario_fin = negocio_config.get('horario_fin', '20:00:00')[:5]
    productos = negocio_config.get('productos', [])
    metodos_pago = negocio_config.get('metodos_pago', ['Nequi', 'Bancolombia'])
    
    catalogo = ""
    if productos:
        catalogo = "\n".join([
            f"- {p.get('nombre', 'Producto')}: ${p.get('precio', 0):,.0f} COP"
            + (f" ({p.get('stock', 0)} disponibles)" if p.get('stock', 0) > 0 else " (Agotado)")
            for p in productos
        ])
    else:
        catalogo = "No hay productos disponibles"
    
    metodos_str = ", ".join(metodos_pago) if isinstance(metodos_pago, list) else str(metodos_pago)
    
    tono_map = {
        'formal': "Sé amable, profesional y orientado a cerrar la venta.",
        'amigable': "Sé amable, entusiasta y cercano. Haz que el cliente se sienta bienvenido.",
        'casual': "Usa un tono casual y moderno, como hablando con un amigo cercano."
    }
    
    return f"""Eres {bot_nombre}, asesor de ventas de {nombre}.
{descripcion}

PRODUCTOS DISPONIBLES:
{catalogo}

MÉTODOS DE PAGO: {metodos_str}
HORARIO: {horario_inicio} a {horario_fin}

REGLAS:
1. {tono_map.get(tono, tono_map['amigable'])}
2. Destaca la calidad de los productos
3. Si pide más de 2 del mismo: sugiere el mayor tamaño o cantidad
4. Cierra la venta preguntando dirección de entrega
5. NUNCA inventes productos que no están en el catálogo
6. Si no sabes algo: di que consultarás y avisas
7. Máximo 3 oraciones por respuesta (es WhatsApp)
8. Tono: {tono}
9. Usa emojis discretamente si el tono lo permite"""

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
            max_tokens=400
        )
        
        respuesta = response.choices[0].message.content
        
        productos_detectados = extraer_productos(mensaje, negocio_config.get('productos', []))
        datos_accion = None
        
        if productos_detectados:
            datos_accion = {
                'tipo': 'crear_pedido',
                'productos': productos_detectados
            }
        
        logger.info(f"[AgenteVentas] Respuesta generada, productos detectados: {len(productos_detectados) if productos_detectados else 0}")
        
        return {
            'respuesta': respuesta,
            'tokens_usados': response.usage.total_tokens,
            'datos_accion': datos_accion
        }
        
    except Exception as e:
        logger.error(f"[AgenteVentas] Error: {e}")
        return {
            'respuesta': "Disculpa, no pude procesar tu solicitud de compra. ¿Podrías intentarlo de nuevo?",
            'tokens_usados': 0,
            'datos_accion': None
        }

def extraer_productos(mensaje: str, productos: list) -> list:
    productos_encontrados = []
    mensaje_lower = mensaje.lower()
    
    for producto in productos:
        nombre = producto.get('nombre', '').lower()
        if nombre in mensaje_lower:
            cantidad = 1
            numeros = [int(s) for s in mensaje.split() if s.isdigit()]
            if numeros:
                cantidad = numeros[0]
            
            productos_encontrados.append({
                'producto_id': producto.get('id'),
                'nombre': producto.get('nombre'),
                'cantidad': cantidad,
                'precio_unitario': producto.get('precio', 0),
                'subtotal': producto.get('precio', 0) * cantidad
            })
    
    return productos_encontrados

async def procesar(mensaje: str, contexto: dict, negocio_config: dict) -> dict:
    return procesar_sync(mensaje, contexto.get('mensajes', []), negocio_config)
