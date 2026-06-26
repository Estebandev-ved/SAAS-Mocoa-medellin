import os
import mysql.connector
from dotenv import load_dotenv
import bcrypt

load_dotenv()

# We need to hash the password 'Password123#' using bcrypt (same format as node bcryptjs)
password_plain = "Password123#"
# Note: Python's bcrypt requires bytes
salt = bcrypt.gensalt(12)
hashed = bcrypt.hashpw(password_plain.encode('utf-8'), salt).decode('utf-8')

# Replace the first two characters if they are $2b$ to $2a$ if needed, but modern bcrypt supports both
# Let's write the query to unlock both demo@antigravity.co accounts and set password to 'Password123#'
conn = mysql.connector.connect(
    host=os.getenv('MYSQL_HOST', 'localhost'),
    user=os.getenv('MYSQL_USER', 'root'),
    password=os.getenv('MYSQL_PASSWORD', ''),
    database=os.getenv('MYSQL_DATABASE', 'antigravity')
)
cursor = conn.cursor()

# 1. Unlock and update demo@antigravity.co (id=1)
cursor.execute("""
    UPDATE negocios 
    SET password = %s, intentos_login_fallidos = 0, cuenta_bloqueada = 0, activo = 1 
    WHERE email_dueno = 'demo@antigravity.co'
""", (hashed,))

# 2. Add modules to negocio_id=1 to make sure they are active
modules = ['catalogo', 'pagos', 'crm', 'reportes']
for mod in modules:
    cursor.execute("""
        INSERT INTO negocio_modulos (negocio_id, modulo_name, activo)
        VALUES (1, %s, 1)
        ON DUPLICATE KEY UPDATE activo = 1
    """, (mod,))

conn.commit()
print("[OK] Demo accounts reset and unlocked successfully!")
print("Credentials:")
print("   Email: demo@antigravity.co")
print("   Password: Password123#")

cursor.close()
conn.close()
