import os
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)

def generar_respuesta(
    intencion: str,
    mensaje: str,
    contexto: list,
    datos_negocio: dict,
    datos_pedido: dict = None
) -> str:
    try:
        client = get_azure_client()
        
        nombre_negocio = datos_negocio.get("nombre", "la tienda")
        tipo_productos = datos_negocio.get("tipo", "productos")
        
        system_prompt = f"""Eres el asistente virtual de {nombre_negocio}, un negocio colombiano que vende {tipo_productos}. Tu personalidad es amable, eficiente y colombiana — usas expresiones naturales pero profesionales. Nunca seas repetitivo.

Reglas:
- Responde siempre en español colombiano natural
- Máximo 3 líneas por respuesta para WhatsApp
- Usa emojis con moderación (máximo 2 por mensaje)
- Si el cliente pregunta precio, dalo directamente
- Si hay un pedido, confirma con resumen claro y total
- Nunca inventes productos o precios que no te dieron
- Si no sabes algo, di que lo consulta y avisas"""
        
        messages = [{"role": "system", "content": system_prompt}]
        
        if contexto and len(contexto) > 0:
            messages.append({
                "role": "system",
                "content": "Esta es la conversación reciente:"
            })
            for msg in contexto[-10:]:
                rol = msg.get("rol", "desconocido")
                contenido = msg.get("contenido", "")
                messages.append({
                    "role": "user" if rol == "cliente" else "assistant",
                    "content": contenido
                })
        
        user_message = mensaje
        if datos_pedido and intencion == "pedido":
            user_message = f"{mensaje}\n\n[DATOS_DEL_PEDIDO: {datos_pedido}]"
        
        messages.append({"role": "user", "content": user_message})
        
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )
        
        respuesta = response.choices[0].message.content.strip()
        
        lineas = respuesta.split('\n')
        if len(lineas) > 3:
            respuesta = '\n'.join(lineas[:3])
        
        return respuesta
        
    except Exception as e:
        logger.error(f"Error generando respuesta: {str(e)}")
        
        respuestas_fallback = {
            "saludo": "¡Hola! 👋 ¿En qué puedo ayudarte hoy?",
            "consulta_precio": "Para darte el precio exacto, ¿me dices qué producto te interesa?",
            "consulta_producto": "Con gusto te doy información sobre nuestros productos. ¿Cuál te gustaría conocer?",
            "pedido": "Perfecto, déjame confirmar los detalles de tu pedido.",
            "pago": "¡Genial! Por favorenvía el comprobante de pago para confirmar tu pedido.",
            "estado_pedido": "Déjame verificar el estado de tu pedido...",
            "queja": "Lamento mucho la situación. ¿Me cuentas qué pasó para ayudarte?",
            "otro": "Entiendo. ¿Me puedes dar más detalles?"
        }
        
        return respuestas_fallback.get(intencion, "Gracias por tu mensaje. ¿En qué puedo ayudarte?")
