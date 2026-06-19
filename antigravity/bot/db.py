import mysql.connector
from mysql.connector import pooling
from datetime import datetime
import logging
from config import (
    DB_CONFIG, NEGOCIO_ID, DEFAULT_PRODUCT_ID,
    DEFAULT_METODO_PAGO, PEDIDO_PREFIX
)

logger = logging.getLogger(__name__)

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(pool_size=5, **DB_CONFIG)
    return _pool

def get_connection():
    return get_pool().get_connection()

def verificar_conexion():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM negocios")
        total = cursor.fetchone()[0]
        conn.close()
        print(f"[DB] Conexión OK — {total} negocio(s) en DB")
        return True
    except Exception as e:
        print(f"[DB ERROR] Falló conexión: {e}")
        return False

def buscar_o_crear_cliente(conn, negocio_id, numero_whatsapp, nombre=None):
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id FROM clientes WHERE negocio_id=%s AND whatsapp=%s",
        (negocio_id, numero_whatsapp)
    )
    cliente = cursor.fetchone()
    if cliente:
        cursor.close()
        return cliente['id']
    
    nombre_final = nombre or f"Cliente {numero_whatsapp[-4:]}"
    cursor.execute(
        "INSERT INTO clientes (negocio_id, nombre, whatsapp, created_at) VALUES (%s,%s,%s,NOW())",
        (negocio_id, nombre_final, numero_whatsapp)
    )
    conn.commit()
    cliente_id = cursor.lastrowid
    cursor.close()
    return cliente_id

def resolver_producto(conn, negocio_id, nombre_producto):
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, precio FROM productos WHERE negocio_id=%s AND LOWER(nombre) LIKE %s AND activo=1 LIMIT 1",
        (negocio_id, f"%{nombre_producto.lower()}%")
    )
    producto = cursor.fetchone()
    if producto:
        cursor.close()
        return producto['id'], float(producto['precio'])
    
    cursor.execute(
        "SELECT id, precio FROM productos WHERE negocio_id=%s AND activo=1 LIMIT 1",
        (negocio_id,)
    )
    default = cursor.fetchone()
    if default:
        cursor.close()
        return default['id'], float(default['precio'])
    
    cursor.close()
    return DEFAULT_PRODUCT_ID, 0.0

def crear_pedido(conn, negocio_id, cliente_id, items, metodo_pago):
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT COUNT(*) as total FROM pedidos WHERE negocio_id=%s", (negocio_id,))
    total = cursor.fetchone()['total']
    numero_pedido = f"#{PEDIDO_PREFIX}-{str(total+1).zfill(4)}"
    
    subtotal = sum(item['precio_unitario'] * item['cantidad'] for item in items)
    
    cursor.execute("""
        INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, total, created_at, updated_at)
        VALUES (%s,%s,%s,'pendiente_pago',%s,%s,%s,NOW(),NOW())
    """, (negocio_id, cliente_id, numero_pedido, metodo_pago, subtotal, subtotal))
    pedido_id = cursor.lastrowid
    
    for item in items:
        cursor.execute("""
            INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
            VALUES (%s,%s,%s,%s,%s)
        """, (pedido_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['precio_unitario'] * item['cantidad']))
    
    conn.commit()
    cursor.close()
    return pedido_id, numero_pedido, subtotal

def guardar_pedido_mysql(numero_whatsapp, datos_pedido, negocio_id=None):
    """
    Guarda un pedido completo en la base de datos de Antigravity.
    
    datos_pedido = {
        'productos': [{'nombre': str, 'cantidad': int}],
        'metodo_pago': str | None,
        'notas': str | None
    }
    
    Retorna: {
        'exito': bool,
        'pedido_id': int,
        'numero_pedido': str,
        'total': float,
        'cliente_id': int,
        'error': str | None
    }
    """
    nid = negocio_id or NEGOCIO_ID
    conn = None
    try:
        conn = get_connection()
        
        cliente_id = buscar_o_crear_cliente(conn, nid, numero_whatsapp)
        
        items = []
        for p in datos_pedido.get('productos', []):
            prod_id, precio = resolver_producto(conn, nid, p['nombre'])
            items.append({
                'producto_id': prod_id,
                'cantidad': p.get('cantidad', 1),
                'precio_unitario': precio
            })
        
        if not items:
            return {'exito': False, 'error': 'No se encontraron productos válidos'}
        
        metodo = datos_pedido.get('metodo_pago') or DEFAULT_METODO_PAGO
        pedido_id, numero, total = crear_pedido(conn, nid, cliente_id, items, metodo)
        
        update_cursor = conn.cursor()
        update_cursor.execute("""
            UPDATE clientes SET total_pedidos = total_pedidos + 1, ultimo_pedido = NOW()
            WHERE id = %s
        """, (cliente_id,))
        conn.commit()
        update_cursor.close()
        
        print(f"[DB] Pedido {numero} guardado — ${total:,.0f}")
        return {
            'exito': True,
            'pedido_id': pedido_id,
            'numero_pedido': numero,
            'total': total,
            'cliente_id': cliente_id,
            'negocio_id': nid,
            'error': None
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[DB ERROR] {e}")
        logger.error(f"Error guardando pedido: {e}")
        return {'exito': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()
