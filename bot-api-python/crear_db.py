import os
import requests
from dotenv import load_dotenv
load_dotenv()
import mysql.connector
from mysql.connector import Error
import bcrypt

def hash_password(password):
    """Hash password using bcrypt (secure)."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def crear_usuario(username, password, rol='vendedor'):
    username = str(username).strip()
    password = str(password)
    rol = str(rol)
    if not username or not password or len(password) < 6 or rol not in ['admin', 'vendedor', 'user']:
        print("Datos inválidos para crear usuario.")
        return False
    conn = pedidos_db()
    if conn:
        cursor = conn.cursor()
        try:
            hashed = hash_password(password)
            cursor.execute("INSERT INTO usuarios (username, password, rol) VALUES (%s, %s, %s)", (username, hashed, rol))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error creando usuario: {e}")
            return False
        finally:
            cursor.close()
            conn.close()

def autenticar_usuario(username, password):
    """Authenticate user with bcrypt password verification."""
    conn = pedidos_db()
    if conn:
        cursor = conn.cursor()
        try:
            # Fetch user by username only, then verify password with bcrypt
            cursor.execute("SELECT id, password, rol FROM usuarios WHERE username=%s", (username,))
            result = cursor.fetchone()
            if result:
                user_id, stored_hash, rol = result
                if verify_password(password, stored_hash):
                    return (user_id, rol)
            return None
        except Exception as e:
            print(f"Error autenticando usuario: {e}")
            return None
        finally:
            cursor.close()
            conn.close()

def pedidos_db():
    """Connect to MySQL using environment variables."""
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'pedidos_db')
        )
        return conn
    except Exception as e:
        print(f"Error al conectar: {e}")
        return None

def crear_base_datos():
    conn = pedidos_db()
    if conn:
        cursor = conn.cursor()
        try:
            with open("database/crear_base_datos.sql", "r") as f:
                sql_script = f.read()
            # Ejecutar cada sentencia por separado
            for statement in sql_script.split(';'):
                statement = statement.strip()
                if statement:
                    cursor.execute(statement)
            print("Base de datos y tabla creadas exitosamente.")
        except Error as e:
            print(f"Error ejecutando el script: {e}")
        finally:
            cursor.close()
            conn.close()

if __name__ == "__main__":
    crear_base_datos()
    # Crear usuario admin inicial
    username = "admin"
    password = "admin123"
    rol = "admin"
    if crear_usuario(username, password, rol):
        print(f"Usuario admin '{username}' creado exitosamente.")
    else:
        print(f"No se pudo crear el usuario admin. Puede que ya exista.")
