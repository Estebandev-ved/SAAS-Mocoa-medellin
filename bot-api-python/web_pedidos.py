import mysql.connector
import os
from dotenv import load_dotenv
load_dotenv()

from main import responder_con_openai, analizar_pedido, enviar_correo
from db import guardar_pedido_mysql
from flask import Flask, render_template, jsonify, request, redirect, session, url_for
from flask_wtf import CSRFProtect
from crear_db import pedidos_db, autenticar_usuario, crear_usuario, hash_password, verify_password
import secrets
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging

# Importar módulo de seguridad empresarial
from security import firewall, security_middleware, add_security_headers, get_security_stats, unblock_ip



# =============================
# Bot NOMA - API Flask
# Seguridad, validaciones y logging
# =============================
# Este archivo gestiona usuarios, pedidos y autenticación.
# Incluye protección CSRF, cookies seguras, fuerza bruta y logging de eventos críticos.
# Revisa el README.md para guía de integración y buenas prácticas.

# Configuración de logging
logging.basicConfig(
    filename='app.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)


# Inicialización de la app Flask y seguridad
app = Flask(__name__)

# Secret key fija desde .env (no cambia en cada reinicio)
app.secret_key = os.getenv('FLASK_SECRET_KEY', secrets.token_hex(32))
if not os.getenv('FLASK_SECRET_KEY'):
    logging.warning("⚠️ FLASK_SECRET_KEY no configurada en .env. Usando clave temporal.")

app.config['SESSION_COOKIE_SECURE'] = True      # Solo se envía por HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True    # No accesible por JavaScript
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'   # Previene CSRF básico
csrf = CSRFProtect(app)  # Protección CSRF

# Limiter para protección contra fuerza bruta
limiter = Limiter(get_remote_address, app=app, default_limits=["200 per day", "50 per hour"])

# Registrar middleware de headers de seguridad
@app.after_request
def after_request_security(response):
    return add_security_headers(response)


# Manejar solicitudes de preflight OPTIONS para CORS globalmente
@app.before_request
def handle_options_preflight():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        origin = request.headers.get('Origin')
        if origin:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        else:
            response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        return response


@csrf.exempt
@app.route('/responder', methods=['POST'])
@security_middleware
def responder():
    """
    Endpoint para recibir mensajes del bot WhatsApp y responder usando OpenAI.
    Si detecta un pedido, lo guarda y envía correo.
    🔒 Protegido por firewall de seguridad empresarial.
    """
    # Logging detallado para depuración
    logging.info(f"/responder - Petición recibida: {request.json}")
    mensaje = request.json.get('mensaje', '')
    
    # Sanitizar input con firewall
    mensaje = firewall.sanitize_input(mensaje)
    
    if not mensaje or not isinstance(mensaje, str) or len(mensaje) > 1000:
        logging.warning(f"/responder - Mensaje inválido: {mensaje[:100] if mensaje else 'vacío'}...")
        return jsonify({'respuesta': 'Mensaje inválido. Por favor, envía un texto breve.'}), 400
    try:
        resumen, cantidad, sabor, total, metodo_pago = analizar_pedido(mensaje)
        if cantidad > 0:
            resumen_texto = "\n".join(resumen)
            guardar_pedido_mysql('Cliente WhatsApp', cantidad, sabor, total, estado='pendiente', metodo_pago=metodo_pago)
            try:
                enviar_correo(resumen_texto, total)
            except Exception as email_err:
                logging.error(f"Error enviando correo de pedido: {email_err}")
            
            # Personalizar mensaje para OpenAI
            if metodo_pago == 'nequi':
                mensaje += f"\n(Pedido detectado: {resumen_texto}. Total: ${total:,}. Pago por Nequi)"
            else:
                mensaje += f"\n(Pedido detectado: {resumen_texto}. Total: ${total:,}. Pago en efectivo)"
                
        respuesta = responder_con_openai(mensaje)
        if not respuesta:
            respuesta = "No se pudo generar respuesta. Intenta de nuevo más tarde."
        logging.info(f"/responder - Respuesta enviada: {respuesta}")
        return jsonify({'respuesta': respuesta})
    except Exception as e:
        logging.error(f"Error en /responder: {e}")
        return jsonify({'respuesta': 'Error interno. Intenta de nuevo más tarde.'}), 500

@app.route('/cambiar_contrasena', methods=['GET', 'POST'])
def cambiar_contrasena():
    """
    Permite al usuario cambiar su contraseña de forma segura.
    Valida la entrada y registra el evento en el log.
    """
    if 'usuario_id' not in session:
        return redirect(url_for('login'))
    error = None
    exito = None
    if request.method == 'POST':
        actual = request.form.get('actual', '').strip()
        nueva = request.form.get('nueva', '').strip()
        # Validación básica y sanitización
        if not actual or not nueva or len(nueva) < 8 or ' ' in nueva:
            error = 'Debes ingresar la contraseña actual y una nueva contraseña segura (mínimo 8 caracteres, sin espacios).' 
        elif nueva.lower() == actual.lower():
            error = 'La nueva contraseña no puede ser igual a la actual.'
        else:
            try:
                conn = pedidos_db()
                if conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT password FROM usuarios WHERE id=%s", (session['usuario_id'],))
                    result = cursor.fetchone()
                    if not result:
                        error = 'Usuario no encontrado.'
                    else:
                        actual_hash = result[0]
                        if hash_password(actual) == actual_hash:
                            cursor.execute("UPDATE usuarios SET password=%s WHERE id=%s", (hash_password(nueva), session['usuario_id']))
                            conn.commit()
                            exito = 'Contraseña cambiada correctamente.'
                            logging.info(f"Cambio de contraseña exitoso: usuario_id={session['usuario_id']}, ip={request.remote_addr}")
                        else:
                            error = 'Contraseña actual incorrecta.'
                            logging.warning(f"Intento fallido de cambio de contraseña: usuario_id={session['usuario_id']}, ip={request.remote_addr}")
                    cursor.close()
                    conn.close()
            except Exception as e:
                logging.error(f"Error en /cambiar_contrasena: usuario_id={session['usuario_id']}, ip={request.remote_addr}, error={e}")
                print(f"Error en cambio de contraseña: {e}")
                error = 'Error interno. Intenta de nuevo más tarde.'
    return render_template('cambiar_contrasena.html', error=error, exito=exito)
# Gestión de usuarios (solo admin)

import mysql.connector

def get_usuarios(search=None, page=1, per_page=10):
    usuarios = []
    try:
        conn = pedidos_db()
        if conn:
            cursor = conn.cursor()
            query = "SELECT id, username, rol FROM usuarios"
            params = []
            if search:
                query += " WHERE username LIKE %s"
                params.append(f"%{search}%")
            query += " ORDER BY id ASC LIMIT %s OFFSET %s"
            params.extend([per_page, (page-1)*per_page])
            cursor.execute(query, params)
            usuarios = cursor.fetchall()
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Error al obtener usuarios: {e}")
    return usuarios

@app.route('/usuarios')
def usuarios_panel():
    if 'usuario_id' not in session or session.get('rol') != 'admin':
        return redirect(url_for('login'))
    exito = request.args.get('exito')
    error = request.args.get('error')
    search = request.args.get('search', None)
    try:
        page = int(request.args.get('page', 1))
    except ValueError:
        page = 1
    per_page = 10
    usuarios = get_usuarios(search, page, per_page)
    return render_template('usuarios.html', usuarios=usuarios, usuario=session.get('username'), rol=session.get('rol'), exito=exito, error=error, search=search, page=page)

@app.route('/usuarios/crear', methods=['GET', 'POST'])
def crear_usuario_panel():
    """
    Permite al admin crear nuevos usuarios con validación y logging.
    """
    if 'usuario_id' not in session or session.get('rol') != 'admin':
        return redirect(url_for('login'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        rol = request.form.get('rol', '').strip()
        # Validación y sanitización
        if not username or not password or len(password) < 8 or ' ' in password or rol not in ['admin', 'vendedor']:
            error = 'Datos inválidos. El usuario y la contraseña son obligatorios, la contraseña debe tener al menos 8 caracteres, sin espacios, y el rol debe ser válido.'
        elif username.lower() == 'admin' and rol != 'admin':
            error = 'El usuario "admin" solo puede tener rol admin.'
        else:
            try:
                if crear_usuario(username, password, rol):
                    logging.info(f"Usuario creado: username={username}, rol={rol}, ip={request.remote_addr}")
                    return redirect(url_for('usuarios_panel', exito='Usuario creado correctamente.'))
                else:
                    logging.warning(f"Intento fallido de creación de usuario: username={username}, rol={rol}, ip={request.remote_addr}")
                    error = 'No se pudo crear el usuario. ¿Ya existe?'
            except Exception as e:
                print(f"Error al crear usuario: {e}")
                error = 'Error interno. Intenta de nuevo más tarde.'
                logging.error(f"Error al crear usuario: username={username}, rol={rol}, ip={request.remote_addr}, error={e}")
    return render_template('crear_usuario.html', error=error)

@app.route('/usuarios/eliminar/<int:usuario_id>', methods=['POST'])
def eliminar_usuario_panel(usuario_id):
    if 'usuario_id' not in session or session.get('rol') != 'admin':
        return redirect(url_for('login'))
    # Evitar que el admin se elimine a sí mismo
    if usuario_id == session['usuario_id']:
        return redirect(url_for('usuarios_panel', error='No puedes eliminar tu propio usuario admin.'))
    try:
        conn = pedidos_db()
        if conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM usuarios WHERE id=%s", (usuario_id,))
            conn.commit()
            cursor.close()
            conn.close()
            return redirect(url_for('usuarios_panel', exito='Usuario eliminado correctamente.'))
        else:
            return redirect(url_for('usuarios_panel', error='No se pudo eliminar el usuario.'))
    except Exception as e:
        print(f"Error eliminando usuario: {e}")
        return redirect(url_for('usuarios_panel', error='Error interno. Intenta de nuevo más tarde.'))
import collections



def get_pedidos():
    conn = pedidos_db()
    if conn is None:
        print("No se pudo conectar a la base de datos. Verifica usuario, contraseña y que MySQL esté corriendo.")
        return []
    cursor = conn.cursor()
    cursor.execute("SELECT id, cliente, cantidad, sabor, total, fecha, estado FROM pedidos ORDER BY fecha DESC")
    pedidos = cursor.fetchall()
    cursor.close()
    conn.close()
    return pedidos

@app.route('/cambiar_estado/<int:pedido_id>', methods=['POST'])
def cambiar_estado(pedido_id):
    if 'usuario_id' not in session or session.get('rol') not in ['admin', 'vendedor']:
        return redirect(url_for('login'))
    try:
        conn = pedidos_db()
        if conn is None:
            return "Error de conexión a la base de datos", 500
        cursor = conn.cursor()
        cursor.execute("UPDATE pedidos SET estado='realizado' WHERE id=%s", (pedido_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return "<script>window.location.href='/pedidos';</script>"
    except Exception as e:
        print(f"Error cambiando estado de pedido: {e}")
        return "Error interno. Intenta de nuevo más tarde.", 500

@app.route('/pedidos')
def ver_pedidos():
    if 'usuario_id' not in session:
        return redirect(url_for('login'))
    pedidos = get_pedidos()
    total_ventas = sum([p[4] for p in pedidos])
    # Agrupar ventas por fecha
    ventas_por_fecha = collections.defaultdict(float)
    fechas = []
    ventas = []
    for p in pedidos:
        fecha = str(p[5])[:10]  # Solo la fecha (YYYY-MM-DD)
        ventas_por_fecha[fecha] += float(p[4])
    for fecha in sorted(ventas_por_fecha.keys()):
        fechas.append(fecha)
        ventas.append(ventas_por_fecha[fecha])
    return render_template('panel_pedidos.html', pedidos=pedidos, total_ventas=total_ventas, fechas=fechas, ventas_por_dia=ventas, usuario=session.get('username'), rol=session.get('rol'))

@app.route('/')
def home():
    if 'usuario_id' in session:
        return redirect(url_for('ver_pedidos'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if not username or not password:
            error = 'Debes ingresar usuario y contraseña.'
        else:
            try:
                user = autenticar_usuario(username, password)
                if user:
                    session.clear()
                    session['usuario_id'] = user[0]
                    session['username'] = username
                    session['rol'] = user[1]
                    session.permanent = True
                    app.permanent_session_lifetime = 3600
                    logging.info(f"Login exitoso: usuario={username}, rol={user[1]}, ip={request.remote_addr}")
                    return redirect(url_for('ver_pedidos'))
                else:
                    logging.warning(f"Intento de login fallido: usuario={username}, ip={request.remote_addr}")
                    error = 'Usuario o contraseña incorrectos.'
            except Exception as e:
                print(f"Error en login: {e}")
                error = 'Error interno. Intenta de nuevo más tarde.'
                logging.error(f"Error en login: usuario={username}, ip={request.remote_addr}, error={e}")
    # Personalización por cliente (puedes cargar estos valores desde config, base de datos o .env)
    nombre_empresa = "NOMÁ Demo"  # Cambia por el nombre del cliente
    logo_url = "/static/img/logo.png"  # Ruta al logo personalizado
    color_principal = "#36a2eb"  # Color principal
    color_fondo = "#f5f6fa"      # Color de fondo
    return render_template(
        'login.html',
        error=error,
        nombre_empresa=nombre_empresa,
        logo_url=logo_url,
        color_principal=color_principal,
        color_fondo=color_fondo
    )



# 🔒 Endpoints de seguridad para admin
@app.route('/security/stats')
def security_stats():
    """Obtener estadísticas del firewall (solo admin)."""
    if 'usuario_id' not in session or session.get('rol') != 'admin':
        return jsonify({'error': 'No autorizado'}), 403
    stats = get_security_stats()
    return jsonify(stats)

@app.route('/security/unblock/<ip>', methods=['POST'])
def unblock_ip_route(ip):
    """Desbloquear una IP (solo admin)."""
    if 'usuario_id' not in session or session.get('rol') != 'admin':
        return jsonify({'error': 'No autorizado'}), 403
    if unblock_ip(ip):
        logging.info(f"IP desbloqueada por admin: {ip}, admin_id={session['usuario_id']}")
        return jsonify({'success': True, 'message': f'IP {ip} desbloqueada'})
    return jsonify({'success': False, 'message': 'IP no encontrada en lista de bloqueo'}), 404

# Endpoint seguro para logout
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Recomendaciones de seguridad:
# - Usa HTTPS en producción para proteger las cookies de sesión.
# - Configura app.config['SESSION_COOKIE_SECURE'] = True y app.config['SESSION_COOKIE_HTTPONLY'] = True
# - Considera usar Flask-Session para almacenamiento de sesión en servidor.

# =============================
# API Endpoints para React
# =============================

@csrf.exempt
@app.route('/api/auth/register', methods=['POST'])
def api_register():
    """API endpoint para registro de nuevos usuarios."""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Datos inválidos'}), 400
    
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    phone = data.get('phone', '').strip()
    
    # Validaciones
    if not name or not email or not password:
        return jsonify({'success': False, 'error': 'Todos los campos son obligatorios'}), 400
    
    if len(password) < 6:
        return jsonify({'success': False, 'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
    
    # Verificar si el email ya existe
    conn = pedidos_db()
    if conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id FROM usuarios WHERE username=%s", (email,))
            if cursor.fetchone():
                return jsonify({'success': False, 'error': 'El email ya está registrado'}), 400
            
            # Crear usuario
            hashed = hash_password(password)
            cursor.execute(
                "INSERT INTO usuarios (username, password, rol, nombre, telefono) VALUES (%s, %s, %s, %s, %s)",
                (email, hashed, 'user', name, phone)
            )
            conn.commit()
            user_id = cursor.lastrowid
            
            # Crear negocio asociado
            cursor.execute(
                "INSERT INTO negocios (usuario_id, nombre, telefono) VALUES (%s, %s, %s)",
                (user_id, f"Negocio de {name}", phone)
            )
            conn.commit()
            
            # Generar token simple (en producción usa JWT)
            token = secrets.token_hex(32)
            
            return jsonify({
                'success': True,
                'token': token,
                'user': {
                    'id': user_id,
                    'name': name,
                    'email': email,
                    'plan': 'free'
                }
            })
            
        except Exception as e:
            logging.error(f"Error en registro: {e}")
            return jsonify({'success': False, 'error': 'Error al registrar usuario'}), 500
        finally:
            cursor.close()
            conn.close()
    
    return jsonify({'success': False, 'error': 'Error de conexión'}), 500


@csrf.exempt
@app.route('/api/auth/registro', methods=['POST'])
def api_registro():
    """API endpoint completo de registro para antigravity."""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Datos inválidos'}), 400
    
    nombre = data.get('nombre', '').strip()
    email_dueno = data.get('email_dueno', '').strip().lower()
    whatsapp = data.get('whatsapp', '').strip()
    password = data.get('password', '')
    nombre_comercial = data.get('nombre_comercial', '').strip()
    tipo_negocio = data.get('tipo_negocio', '').strip()
    ciudad = data.get('ciudad', '').strip()
    departamento = data.get('departamento', '').strip()
    direccion = data.get('direccion', '').strip()
    plan = data.get('plan', 'starter')
    
    # Validaciones básicas
    if not nombre or not email_dueno or not password:
        return jsonify({'success': False, 'error': 'Nombre, email y contraseña son obligatorios'}), 400
    
    if len(password) < 8:
        return jsonify({'success': False, 'error': 'La contraseña debe tener al menos 8 caracteres'}), 400
    
    # Verificar si el email ya existe
    conn = pedidos_db()
    if conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id FROM usuarios WHERE username=%s", (email_dueno,))
            if cursor.fetchone():
                return jsonify({'success': False, 'error': 'El email ya está registrado'}), 400
            
            # Crear usuario
            hashed = hash_password(password)
            cursor.execute(
                "INSERT INTO usuarios (username, password, rol, nombre, telefono) VALUES (%s, %s, %s, %s, %s)",
                (email_dueno, hashed, 'user', nombre, whatsapp)
            )
            conn.commit()
            user_id = cursor.lastrowid
            
            # Crear negocio asociado
            cursor.execute(
                "INSERT INTO negocios (usuario_id, nombre, telefono, descripcion, direccion, whatsapp) VALUES (%s, %s, %s, %s, %s, %s)",
                (user_id, nombre_comercial or f"Negocio de {nombre}", whatsapp, tipo_negocio, direccion, whatsapp)
            )
            conn.commit()
            
            # Generar token simple
            token = secrets.token_hex(32)
            
            return jsonify({
                'success': True,
                'token': token,
                'negocio': {
                    'id': user_id,
                    'nombre': nombre_comercial or nombre,
                    'email': email_dueno,
                    'whatsapp': whatsapp,
                    'plan': plan,
                    'ciudad': ciudad,
                    'tipo_negocio': tipo_negocio
                }
            })
            
        except Exception as e:
            logging.error(f"Error en registro: {e}")
            return jsonify({'success': False, 'error': 'Error al registrar usuario'}), 500
        finally:
            cursor.close()
            conn.close()
    
    return jsonify({'success': False, 'error': 'Error de conexión'}), 500


@csrf.exempt
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """API endpoint para login desde React."""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Datos inválidos'}), 400
    
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'success': False, 'error': 'Email y contraseña requeridos'}), 400
    
    user = autenticar_usuario(email, password)
    
    if user:
        user_id, rol = user
        
        # Obtener info del usuario
        conn = pedidos_db()
        user_data = None
        if conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute("SELECT id, username, nombre, rol FROM usuarios WHERE id=%s", (user_id,))
                user_data = cursor.fetchone()
            finally:
                cursor.close()
                conn.close()
        
        if user_data:
            # Generar token simple (en producción usa JWT)
            token = secrets.token_hex(32)
            
            return jsonify({
                'success': True,
                'token': token,
                'user': {
                    'id': user_data['id'],
                    'name': user_data.get('nombre', user_data['username']),
                    'email': user_data['username'],
                    'rol': user_data['rol'],
                    'plan': 'free'
                }
            })
    
    return jsonify({'success': False, 'error': 'Email o contraseña incorrectos'}), 401


@csrf.exempt
@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """API logout endpoint."""
    return jsonify({'success': True})


@csrf.exempt
@app.route('/api/auth/verify', methods=['GET'])
def api_verify():
    """API verify token endpoint."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Token requerido'}), 401
    
    # En implementación real, verificarías el token contra la DB
    # Por ahora, simplemente verificamos si hay sesión
    if 'usuario_id' in session:
        conn = pedidos_db()
        if conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute("SELECT id, username, nombre FROM usuarios WHERE id=%s", (session.get('usuario_id'),))
                user = cursor.fetchone()
                if user:
                    return jsonify({'negocio': user})
            finally:
                cursor.close()
                conn.close()
    
    return jsonify({'error': 'Token inválido'}), 401


# Endpoint seguro para logout
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Desactiva debug en producción
if __name__ == "__main__":
    # Cambiado a puerto 5000 para evitar conflictos con la API Node (3002)
    # y alinearse con la URL por defecto del bot de WhatsApp
    port = int(os.getenv('PORT_API_PYTHON', 5000))
    app.run(debug=True, port=port)
