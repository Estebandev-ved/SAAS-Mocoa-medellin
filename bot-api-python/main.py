import mysql.connector
import openai
from openai import AzureOpenAI
import os
from email.message import EmailMessage
import smtplib
import requests
import re
from datetime import datetime
from dotenv import load_dotenv
from crear_db import pedidos_db
from db import guardar_pedido_mysql



load_dotenv()

# Claves y configuración OpenAI desde Azure
client = AzureOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    api_version="2025-03-01-preview",
    azure_endpoint=os.getenv("OPENAI_ENDPOINT")
)

# Correo - AHORA DESDE VARIABLES DE ENTORNO (SEGURO)
EMAIL_REMITENTE = os.getenv("EMAIL_REMITENTE")
EMAIL_DESTINO = os.getenv("EMAIL_DESTINO")
CLAVE_APP = os.getenv("EMAIL_APP_PASSWORD")

# Validar configuración de email
if not all([EMAIL_REMITENTE, EMAIL_DESTINO, CLAVE_APP]):
    import warnings
    warnings.warn("⚠️ Configuración de email incompleta. Revisa las variables EMAIL_* en .env")

# Productos disponibles
sabores_disponibles = {
    "normal": 9000,
    "grande": 18000,  # 500 gramos
}

# Prompt del sistema
instrucciones_sistema = (
    "Actúa como un asistente virtual de ventas de NOMÁ, una marca de yogur griego artesanal. "
     "Siempre que alguien te escriba, responde de forma amable, clara, breve y orientada a concretar la venta. "
     "Ofreces yogur griego natural de 250 gramos a $9.000 cada uno y yogur griego natural de 500 gramos a $18.000 cada uno. "
     "Si preguntan el precio, respóndelo. Si piden una o más unidades, indícales el total. "
     "Si preguntan cómo pagar, indícales que pueden pagar en efectivo al momento de la entrega o por Nequi al número 3208303600. "
     "Si el usuario ya confirma que pagará en efectivo, responde solo confirmando el pago en efectivo y no pidas comprobante de Nequi. "
     "Si el usuario confirma que pagará por Nequi, pide el comprobante de pago. "
     "Si ya confirman la compra, responde con agradecimiento y disposición para coordinar el pedido. "
     "Evita repetir la misma información varias veces y no des discursos largos. Tu tono debe ser alegre, profesional y cálido."
)

# Función para guardar pedidos en MySQL
from db import guardar_pedido_mysql as guardar_pedido_mysql_db

def guardar_pedido_mysql(cliente, cantidad, sabor, total, estado='pendiente', metodo_pago='efectivo'):
    guardar_pedido_mysql_db(cliente, cantidad, sabor, total, estado, metodo_pago)

# Función para enviar correo
def enviar_correo(resumen, total):
    mensaje = EmailMessage()
    mensaje["Subject"] = "🧾 Nuevo pedido de yogures NOMÁ"
    mensaje["From"] = EMAIL_REMITENTE
    mensaje["To"] = EMAIL_DESTINO

    # Aseguramos que total sea texto antes de combinarlo
    mensaje.set_content(f"Nuevo pedido:\n\n{resumen}\n\nTotal: ${total:,}")

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(EMAIL_REMITENTE, CLAVE_APP)
        smtp.send_message(mensaje)

# 🔍 Analiza pedido
def analizar_pedido(texto):
    texto = texto.lower()
    resumen = []
    cantidad = 0
    sabor = "normal"
    total = 0
    for s in sabores_disponibles:
        patron = rf"(\d+)\s+yogures?\s+de\s+{s}"
        m = re.search(patron, texto)
        if m:
            cantidad = int(m.group(1))
            sabor = s
            total = cantidad * sabores_disponibles[s]
            resumen.append(f"{cantidad} de {s} = ${total:,}")
            break
    if cantidad == 0:
        m = re.search(r"(\d+)\s+yogures?", texto)
        if m:
            cantidad = int(m.group(1))
            sabor = "normal"
            total = cantidad * sabores_disponibles["normal"]
            resumen.append(f"{cantidad} de normal = ${total:,}")
    # Detectar método de pago
    metodo_pago = 'efectivo'
    if 'nequi' in texto or 'transfer' in texto or 'cuenta' in texto:
        metodo_pago = 'nequi'
    elif 'efectivo' in texto:
        metodo_pago = 'efectivo'
    return resumen, cantidad, sabor, total, metodo_pago

# 💳 Detecta intención de pago
def contiene_palabra_pago(texto):
    texto = texto.lower()
    claves = ["pagar", "transferir", "cuenta", "nequi", "forma de pago"]
    return any(palabra in texto for palabra in claves)

# 🤖 Respuesta OpenAI
def responder_con_openai(mensaje_usuario):
    # Si el mensaje ya indica pago en efectivo, genera respuesta directa sin pedir comprobante
    if "pago en efectivo" in mensaje_usuario or "efectivo" in mensaje_usuario:
        return "¡Perfecto! Tu pedido ha sido registrado y podrás pagar en efectivo al momento de la entrega. ¡Gracias por tu compra! 😊"

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_DEPLOYMENT", "gpt-5.2-chat"),
            messages=[
                {"role": "system", "content": instrucciones_sistema},
                {"role": "user", "content": mensaje_usuario}
            ],
            max_tokens=400
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        return f"❌ Error al conectar con OpenAI: {type(e).__name__} - {e}"
    
# 🖥️ Main loop
if __name__ == "__main__":
    print("🤖 Bot Yogur NOMÁ listo para tomar pedidos. Escribe tu mensaje ('salir' para terminar):\n")
    while True:
        entrada = input("👤 Cliente: ")
        if entrada.lower() in ["salir", "exit", "quit"]:
            break

        resumen, cantidad, sabor, total, metodo_pago = analizar_pedido(entrada)

        if cantidad > 0:
            resumen_texto = "\n".join(resumen)
            guardar_pedido_mysql(cliente="Cliente WhatsApp", cantidad=cantidad, sabor=sabor, total=total, metodo_pago=metodo_pago)
            enviar_correo(resumen_texto, total)
            # Personalizar respuesta según método de pago
            if metodo_pago == 'nequi':
                entrada += f"\n(Pedido detectado: {resumen_texto}. Total: ${total:,}. Pago por Nequi)"
            else:
                entrada += f"\n(Pedido detectado: {resumen_texto}. Total: ${total:,}. Pago en efectivo)"

        respuesta = responder_con_openai(entrada)
        print("🤖 Bot:", respuesta, "\n")

