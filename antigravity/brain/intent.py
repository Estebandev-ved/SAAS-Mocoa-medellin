import os
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres un clasificador de intenciones para un negocio colombiano que vende por WhatsApp. Analiza el mensaje del cliente y clasifícalo en exactamente una de estas categorías:

- saludo: saludos, presentaciones, primeros contactos
- consulta_precio: preguntas sobre precios, costos, valores
- consulta_producto: preguntas sobre disponibilidad, características, descripción
- pedido: quiere comprar, pedir, encargar uno o varios productos con cantidad específica
- pago: enviando comprobante, confirmando pago, mencionando que ya pagó
- estado_pedido: pregunta por su pedido, entrega, domicilio
- queja: molestia, problema, inconveniente
- otro: cualquier cosa que no encaje arriba

Responde ÚNICAMENTE con el nombre de la categoría en minúsculas, sin explicación."""

def detectar_intencion(mensaje: str, contexto: list = None) -> str:
    try:
        client = get_azure_client()
        
        historial = ""
        if contexto and len(contexto) > 0:
            historial = "\n\nConversación reciente:\n"
            for msg in contexto[-5:]:
                rol = msg.get("rol", "desconocido")
                contenido = msg.get("contenido", "")
                historial += f"- {rol}: {contenido}\n"
        
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Clasifica este mensaje:{historial}\n\nMensaje actual: {mensaje}"}
            ],
            temperature=0,
            max_tokens=50
        )
        
        intencion = response.choices[0].message.content.strip().lower()
        
        intenciones_validas = [
            "saludo", "consulta_precio", "consulta_producto", 
            "pedido", "pago", "estado_pedido", "queja", "otro"
        ]
        
        if intencion not in intenciones_validas:
            intencion = "otro"
        
        return intencion
        
    except Exception as e:
        logger.error(f"Error detectando intención: {str(e)}")
        
        mensaje_lower = mensaje.lower()
        
        saludos = ["hola", "buenos", "buenas", "saludos", "que hay", "como estas"]
        if any(s in mensaje_lower for s in saludos):
            return "saludo"
        
        if "precio" in mensaje_lower or "cuanto" in mensaje_lower or "cuesta" in mensaje_lower:
            return "consulta_precio"
        
        if "pedir" in mensaje_lower or "comprar" in mensaje_lower or "quiero" in mensaje_lower:
            if any(p in mensaje_lower for p in ["uno", "dos", "3", "un", "una", "par", "x"]):
                return "pedido"
        
        if "pago" in mensaje_lower or "transferencia" in mensaje_lower or "comprobante" in mensaje_lower:
            return "pago"
        
        if "estado" in mensaje_lower or "pedido" in mensaje_lower or "donde" in mensaje_lower:
            return "estado_pedido"
        
        if "problema" in mensaje_lower or "queja" in mensaje_lower or "mal" in mensaje_lower:
            return "queja"
        
        return "otro"
