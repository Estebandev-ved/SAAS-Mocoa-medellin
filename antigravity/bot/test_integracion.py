"""
Test de integración Bot NOMA + Antigravity
Ejecutar desde antigravity/bot/
"""

from db import guardar_pedido_mysql, verificar_conexion
from config import NEGOCIO_ID

def test_conexion():
    print("=== TEST 1: Conexión a DB ===")
    ok = verificar_conexion()
    assert ok, "❌ Falló conexión a antigravity DB"
    print("✅ Conexión OK\n")

def test_guardar_pedido():
    print("=== TEST 2: Guardar pedido simulado ===")
    resultado = guardar_pedido_mysql(
        numero_whatsapp="+573001234567",
        datos_pedido={
            'productos': [
                {'nombre': 'yogur', 'cantidad': 2}
            ],
            'metodo_pago': 'nequi',
            'notas': 'Test de integración'
        },
        negocio_id=NEGOCIO_ID
    )
    assert resultado['exito'], f"❌ Error: {resultado['error']}"
    print(f"✅ Pedido creado: {resultado['numero_pedido']}")
    print(f"   Total: ${resultado['total']:,.0f}")
    print(f"   ID: {resultado['pedido_id']}\n")
    return resultado

def test_verificar_en_db(pedido_id):
    print("=== TEST 3: Verificar en MySQL ===")
    print(f"""Ejecuta en MySQL para verificar:

SELECT p.numero_pedido, p.total, p.estado, c.nombre as cliente, c.whatsapp
FROM pedidos p
JOIN clientes c ON p.cliente_id = c.id
WHERE p.id = {pedido_id};

SELECT ip.cantidad, ip.precio_unitario, pr.nombre as producto
FROM items_pedido ip
JOIN productos pr ON ip.producto_id = pr.id
WHERE ip.pedido_id = {pedido_id};
    """)

if __name__ == "__main__":
    test_conexion()
    resultado = test_guardar_pedido()
    test_verificar_en_db(resultado['pedido_id'])
    print("\n🎉 Todos los tests pasaron.")
    print("Verifica en el dashboard de React que")
    print("el pedido aparezca en tiempo real.")
