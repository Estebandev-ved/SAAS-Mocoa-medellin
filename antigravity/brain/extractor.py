import os
import json
import logging
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres un extractor de datos de pedidos de WhatsApp para un negocio colombiano. Del mensaje del cliente extrae los datos del pedido en formato JSON estricto.

Retorna ÚNICAMENTE este JSON sin markdown:
{
  "productos": [
    {
      "nombre": "nombre del producto mencionado",
      "cantidad": número entero,
      "variante": "variante si menciona (tamaño/color/etc)"
    }
  ],
  "direccion": "dirección de entrega si la menciona o null",
  "metodo_pago": "nequi|bancolombia|efectivo|bold|null",
  "notas": "cualquier nota especial o null"
}

Si no hay suficiente información para un campo, usa null.
Los precios NO van en la extracción, esos se consultan en la base de datos."""

def extraer_pedido(mensaje: str, negocio_id: int) -> dict:
    try:
        client = get_azure_client()
        
        response = client.chat.completions.create(
            model=get_azure_model(),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": mensaje}
            ],
            temperature=0,
            max_tokens=500
        )
        
        contenido = response.choices[0].message.content.strip()
        
        if contenido.startswith("```json"):
            contenido = contenido[7:]
        if contenido.startswith("```"):
            contenido = contenido[3:]
        if contenido.endswith("```"):
            contenido = contenido[:-3]
        
        contenido = contenido.strip()
        
        datos = json.loads(contenido)
        
        if "productos" not in datos:
            datos["productos"] = []
        
        for prod in datos["productos"]:
            if "cantidad" not in prod or prod["cantidad"] is None:
                prod["cantidad"] = 1
        
        logger.info(f"Pedido extraído: {datos}")
        return datos
        
    except json.JSONDecodeError as e:
        logger.error(f"Error parseando JSON del pedido: {str(e)}")
        return extraer_pedido_fallback(mensaje)
    except Exception as e:
        logger.error(f"Error extrayendo pedido: {str(e)}")
        return extraer_pedido_fallback(mensaje)

def extraer_pedido_fallback(mensaje: str) -> dict:
    mensaje_lower = mensaje.lower()
    
    productos_encontrados = []
    
    palabras_productos = {
        "camiseta": "Camiseta",
        "jean": "Jean",
        "pantalón": "Pantalón",
        "zapatilla": "Zapatillas",
        "zapatos": "Zapatillas",
        "gorra": "Gorra",
        "chaqueta": "Chaqueta",
        "buzo": "Buzo",
        "sudadera": "Sudadera"
    }
    
    for palabra, nombre in palabras_productos.items():
        if palabra in mensaje_lower:
            productos_encontrados.append({
                "nombre": nombre,
                "cantidad": 1,
                "variante": None
            })
    
    import re
    numeros = re.findall(r'(\d+)\s*(?:unidades?|unds?|unds|pares?|pares?)', mensaje_lower)
    if numeros and productos_encontrados:
        productos_encontrados[0]["cantidad"] = int(numeros[0])
    
    match_cant = re.search(r'(\d+)\s*(?:de|las|los|el)', mensaje_lower)
    if match_cant and productos_encontrados:
        productos_encontrados[0]["cantidad"] = int(match_cant.group(1))
    
    direccion = None
    direcciones_keywords = ["dirección", "dir", "entregar", "enviar a", "calle", "carrera", "av", "apartamento", "casa"]
    for keyword in direcciones_keywords:
        if keyword in mensaje_lower:
            match = re.search(r'(?:dirección|dir|entregar en|enviar a)\s*[:\-]?\s*([^,\n]+)', mensaje, re.IGNORECASE)
            if match:
                direccion = match.group(1).strip()
                break
    
    metodo_pago = None
    metodos = {
        "nequi": "nequi",
        "bancolombia": "bancolombia",
        "efectivo": "efectivo",
        "bold": "bold",
        "wompi": "wompi"
    }
    for metodo, valor in metodos.items():
        if metodo in mensaje_lower:
            metodo_pago = valor
            break
    
    notas = None
    if "nota" in mensaje_lower or "observación" in mensaje_lower:
        match = re.search(r'(?:nota|observación)[:\-]?\s*(.+)', mensaje, re.IGNORECASE)
        if match:
            notas = match.group(1).strip()
    
    return {
        "productos": productos_encontrados if productos_encontrados else [{"nombre": "Producto", "cantidad": 1, "variante": None}],
        "direccion": direccion,
        "metodo_pago": metodo_pago,
        "notas": notas
    }
