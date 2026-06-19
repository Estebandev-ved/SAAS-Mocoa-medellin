"""
Bot NOMA - API Flask
Integración con Antigravity
"""

from flask import Flask, request, jsonify
from db import guardar_pedido_mysql, verificar_conexion
from notifier import notificar_pedido_sync
from config import NEGOCIO_ID
import re

app = Flask(__name__)

sabores_disponibles = {
    "normal": 9000,
    "grande": 18000,
}

def analizar_pedido(texto):
    texto = texto.lower()
    resumen = []
    cantidad = 0
    sabor = "normal"
    total = 0
    metodo_pago = 'efectivo'
    
    for s in sabores_disponibles:
        patron = rf"(\d+)\s+yogures?\s+de\s+{s}"
        m = re.search(patron, texto)
        if m:
            cantidad = int(m.group(1))
            sabor = s
            total = cantidad * sabores_disponibles[s]
            resumen.append(f"{cantidad} de {s}")
            break
    
    if cantidad == 0:
        m = re.search(r"(\d+)\s+yogures?", texto)
        if m:
            cantidad = int(m.group(1))
            sabor = "normal"
            total = cantidad * sabores_disponibles["normal"]
            resumen.append(f"{cantidad} de normal")
    
    if 'nequi' in texto or 'transferir' in texto:
        metodo_pago = 'nequi'
    
    return resumen, cantidad, total, metodo_pago

@app.route('/responder', methods=['POST'])
def responder():
    mensaje = request.json.get('mensaje', '')
    numero_whatsapp = request.json.get('numero', '+573001234567')
    
    if not mensaje or not isinstance(mensaje, str):
        return jsonify({'respuesta': 'Mensaje inválido.'}), 400
    
    try:
        resumen, cantidad, total, metodo_pago = analizar_pedido(mensaje)
        
        if cantidad > 0:
            datos_pedido = {
                'productos': [{'nombre': s, 'cantidad': cantidad // len(resumen) if resumen else cantidad} for s in resumen] if resumen else [{'nombre': 'yogur', 'cantidad': cantidad}],
                'metodo_pago': metodo_pago,
                'notas': mensaje[:200]
            }
            
            resultado = guardar_pedido_mysql(
                numero_whatsapp=numero_whatsapp,
                datos_pedido=datos_pedido,
                negocio_id=NEGOCIO_ID
            )
            
            if resultado['exito']:
                notificar_pedido_sync(resultado)
                respuesta = f"✅ Pedido {resultado['numero_pedido']} registrado.\n💰 Total: ${resultado['total']:,.0f}"
            else:
                respuesta = f"⚠️ Tu pedido fue procesado pero no pudo guardarse en este momento."
        else:
            respuesta = "Entendido. ¿Hay algo más en lo que pueda ayudarte?"
        
        return jsonify({'respuesta': respuesta})
        
    except Exception as e:
        print(f"Error en /responder: {e}")
        return jsonify({'respuesta': 'Error interno. Intenta de nuevo más tarde.'}), 500

@app.route('/health', methods=['GET'])
def health():
    db_ok = verificar_conexion()
    return jsonify({
        'status': 'ok' if db_ok else 'degraded',
        'db_connected': db_ok
    })

if __name__ == "__main__":
    verificar_conexion()
    app.run(debug=True, port=5000)
