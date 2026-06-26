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

print("--- TABLAS EN LA BASE DE DATOS ---")
cursor.execute("SHOW TABLES")
for row in cursor.fetchall():
    print(list(row.values())[0])

print("\n--- NEGOCIOS ---")
cursor.execute("SELECT * FROM negocios")
for row in cursor.fetchall():
    print(row)

print("\n--- USUARIOS ---")
try:
    cursor.execute("SELECT id, negocio_id, nombre, email, rol, activo FROM usuarios")
    for row in cursor.fetchall():
        print(row)
except Exception as e:
    print("Error leyendo usuarios:", e)

cursor.close()
conn.close()
