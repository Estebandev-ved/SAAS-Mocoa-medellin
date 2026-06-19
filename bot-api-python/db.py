# db.py
import mysql.connector
from datetime import datetime

import os
from dotenv import load_dotenv
load_dotenv()

def pedidos_db():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'pedidos_db')
    )

def guardar_pedido_mysql(cliente, cantidad, sabor, total, estado='pendiente', metodo_pago='efectivo'):
    try:
        conn = pedidos_db()
        cursor = conn.cursor()
        fecha = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        query = ("INSERT INTO pedidos (cliente, cantidad, sabor, total, fecha, estado, metodo_pago) "
                 "VALUES (%s, %s, %s, %s, %s, %s, %s)")
        values = (cliente, cantidad, sabor, total, fecha, estado, metodo_pago)
        cursor.execute(query, values)
        conn.commit()
        print("Pedido guardado exitosamente en MySQL")
    except Exception as e:
        import logging
        logging.error(f"Error guardando pedido en MySQL: {e}")
        print(f"Error guardando pedido en MySQL: {e}")
    finally:
        try:
            cursor.close()
        except:
            pass
        try:
            conn.close()
        except:
            pass