import socketio
import asyncio
from config import SOCKET_URL, SOCKET_SECRET, NEGOCIO_ID

sio = socketio.AsyncClient()

async def conectar():
    try:
        await sio.connect(
            SOCKET_URL,
            auth={'secret': SOCKET_SECRET, 'tipo': 'bot_interno'},
            wait_timeout=5
        )
        print(f"[NOTIFIER] Conectado a {SOCKET_URL}")
    except Exception as e:
        print(f"[NOTIFIER] No se pudo conectar: {e}")

async def emitir_nuevo_pedido(pedido_data):
    if not sio.connected:
        await conectar()
    try:
        room = f"negocio_{pedido_data.get('negocio_id', NEGOCIO_ID)}"
        await sio.emit('nuevo_pedido', {'room': room, **pedido_data})
        print(f"[NOTIFIER] Emitido nuevo_pedido {pedido_data.get('numero_pedido')}")
    except Exception as e:
        print(f"[NOTIFIER] Error emitiendo: {e}")

def notificar_pedido_sync(pedido_data):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(emitir_nuevo_pedido(pedido_data))
        else:
            asyncio.run(emitir_nuevo_pedido(pedido_data))
    except Exception as e:
        print(f"[NOTIFIER] Error en sync wrapper: {e}")
