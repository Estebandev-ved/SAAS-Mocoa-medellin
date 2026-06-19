"""
Bot NOMA - API Flask
Archivo: app.py
-------------------
Este archivo expone el endpoint /responder para recibir mensajes del bot WhatsApp y responder usando OpenAI.
Incluye validaciones, manejo de errores y seguridad básica.
Revisa el README.md para guía de integración y buenas prácticas.
"""

from flask import Flask, request, jsonify
from main import responder_con_openai
from db import guardar_pedido_mysql
from main import analizar_pedido, enviar_correo

app = Flask(__name__)

@app.route('/responder', methods=['POST'])
def responder():
    mensaje = request.json.get('mensaje', '')
    if not mensaje or not isinstance(mensaje, str) or len(mensaje) > 500:
        return jsonify({'respuesta': 'Mensaje inválido. Por favor, envía un texto breve.'}), 400

    try:
        resumen, cantidad, sabor, total, metodo_pago = analizar_pedido(mensaje)
        if cantidad > 0:
            resumen_texto = "\n".join(resumen)
            guardar_pedido_mysql('Cliente WhatsApp', cantidad, sabor, total, estado='pendiente', metodo_pago=metodo_pago)
            enviar_correo(resumen_texto, total)
            # Personalizar mensaje para OpenAI
            if metodo_pago == 'nequi':
                mensaje += f"\n(Pedido detectado: {resumen_texto}. Total: ${total:,}. Pago por Nequi)"
            else:
                mensaje += f"\n(Pedido detectado: {resumen_texto}. Total: ${total:,}. Pago en efectivo)"
        respuesta = responder_con_openai(mensaje)
        if not respuesta:
            respuesta = "No se pudo generar respuesta. Intenta de nuevo más tarde."
        return jsonify({'respuesta': respuesta})
    except Exception as e:
        print(f"Error en /responder: {e}")
        return jsonify({'respuesta': 'Error interno. Intenta de nuevo más tarde.'}), 500
        
if __name__ == "__main__":
    app.run(debug=True, port=5000)
"""
Documentación rápida:
- Este endpoint recibe mensajes y responde usando OpenAI.
- Si detecta un pedido, lo guarda en la base de datos y envía correo.
- Usa variables de entorno para configuración y claves.
- Valida la entrada y maneja errores para mayor robustez.
"""