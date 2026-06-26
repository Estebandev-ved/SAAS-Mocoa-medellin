import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv('MYSQL_HOST', 'localhost'),
    user=os.getenv('MYSQL_USER', 'root'),
    password=os.getenv('MYSQL_PASSWORD', ''),
    database=os.getenv('MYSQL_DATABASE', 'antigravity')
)
cursor = conn.cursor(dictionary=True)

print("--- ULTIMOS 10 CLIENTES ---")
cursor.execute("SELECT * FROM clientes ORDER BY id DESC LIMIT 10")
for row in cursor.fetchall():
    print(row)

print("\n--- ULTIMAS 10 CONVERSACIONES ---")
cursor.execute("SELECT id, cliente_id, intencion_detectada, updated_at FROM conversaciones ORDER BY id DESC LIMIT 10")
for row in cursor.fetchall():
    print(row)

print("\n--- ULTIMOS 10 PEDIDOS ---")
cursor.execute("SELECT id, cliente_id, numero_pedido, estado, total, created_at FROM pedidos ORDER BY id DESC LIMIT 10")
for row in cursor.fetchall():
    print(row)

cursor.close()
conn.close()
