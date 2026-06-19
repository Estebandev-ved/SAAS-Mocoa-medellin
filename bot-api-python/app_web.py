
from flask import Flask, render_template_string, request, redirect, Response
import mysql.connector
from crear_db import pedidos_db
import smtplib
from email.message import EmailMessage


app = Flask(__name__)

def insertar_datos_ejemplo():
    conn = pedidos_db()
    cursor = conn.cursor()
    # Insertar cliente de ejemplo si no hay clientes
    cursor.execute("SELECT COUNT(*) FROM clientes")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (%s, %s, %s)",
                       ("Juan Perez", "3001234567", "Calle Falsa 123"))
    # Insertar pedido de ejemplo si no hay pedidos
    cursor.execute("SELECT COUNT(*) FROM pedidos")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO pedidos (cliente, cantidad, sabor, total, fecha, estado) VALUES (%s, %s, %s, %s, %s, %s)",
                       ("Juan Perez", 2, "normal", 18000, "2025-08-16 10:00:00", "pendiente"))
    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
    insertar_datos_ejemplo()

def get_pedidos():
    conn = pedidos_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, cliente, cantidad, sabor, total, fecha, estado FROM pedidos ORDER BY fecha DESC")
    pedidos = cursor.fetchall()
    cursor.close()
    conn.close()
    return pedidos

def get_clientes():
    conn = pedidos_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, telefono, direccion FROM clientes ORDER BY nombre")
    clientes = cursor.fetchall()
    cursor.close()
    conn.close()
    return clientes

@app.route('/clientes')
def clientes():
    clientes = get_clientes()
    html = '''
    <h2>Clientes</h2>
    <a href="/nuevo_cliente">Registrar nuevo cliente</a>
    <table border="1" cellpadding="5">
        <tr><th>ID</th><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th>Historial</th></tr>
        {% for c in clientes %}
        <tr>
            <td>{{c[0]}}</td><td>{{c[1]}}</td><td>{{c[2]}}</td><td>{{c[3]}}</td>
            <td><a href="/historial/{{c[0]}}">Ver pedidos</a></td>
        </tr>
        {% endfor %}
    </table>
    <a href="/">Volver a pedidos</a>
    '''
    return render_template_string(html, clientes=clientes)

@app.route('/historial/<int:cliente_id>')
def historial(cliente_id):
    conn = pedidos_db()
    cursor = conn.cursor()
    cursor.execute("SELECT nombre FROM clientes WHERE id=%s", (cliente_id,))
    cliente = cursor.fetchone()
    cursor.execute("SELECT cantidad, sabor, total, fecha, estado FROM pedidos WHERE cliente=%s ORDER BY fecha DESC", (cliente[0],))
    pedidos = cursor.fetchall()
    cursor.close()
    conn.close()
    html = '''
    <h2>Historial de pedidos de {{cliente}}</h2>
    <table border="1" cellpadding="5">
        <tr><th>Cantidad</th><th>Sabor</th><th>Total</th><th>Fecha</th><th>Estado</th></tr>
        {% for p in pedidos %}
        <tr>
            <td>{{p[0]}}</td><td>{{p[1]}}</td><td>${{p[2]:,}}</td><td>{{p[3]}}</td><td>{{p[4]}}</td>
        </tr>
        {% endfor %}
    </table>
    <a href="/clientes">Volver a clientes</a>
    '''
    return render_template_string(html, cliente=cliente[0], pedidos=pedidos)

@app.route('/nuevo_cliente', methods=['GET', 'POST'])
def nuevo_cliente():
    if request.method == 'POST':
        nombre = request.form['nombre']
        telefono = request.form['telefono']
        direccion = request.form['direccion']
        conn = pedidos_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO clientes (nombre, telefono, direccion) VALUES (%s, %s, %s)",
                       (nombre, telefono, direccion))
        conn.commit()
        cursor.close()
        conn.close()
        return redirect('/clientes')
    html = '''
    <h2>Registrar nuevo cliente</h2>
    <form method="post">
        Nombre: <input name="nombre" required><br>
        Teléfono: <input name="telefono"><br>
        Dirección: <input name="direccion"><br>
        <input type="submit" value="Guardar">
    </form>
    <a href="/clientes">Volver</a>
    '''
    return render_template_string(html)
    return pedidos

def get_stats():
    conn = pedidos_db()
    cursor = conn.cursor()
    cursor.execute("SELECT SUM(total), COUNT(*), SUM(CASE WHEN estado='pendiente' THEN 1 ELSE 0 END), SUM(CASE WHEN estado='entregado' THEN 1 ELSE 0 END) FROM pedidos")
    total_ventas, total_pedidos, pendientes, entregados = cursor.fetchone()
    cursor.close()
    conn.close()
    return {
        'total_ventas': total_ventas or 0,
        'total_pedidos': total_pedidos or 0,
        'pendientes': pendientes or 0,
        'entregados': entregados or 0
    }

@app.route('/')
def index():
    pedidos = get_pedidos()
    stats = get_stats()
    html = '''
    <h2>Pedidos NOMÁ</h2>
    <div style="background:#f0f0f0;padding:10px;margin-bottom:15px;">
        <b>Ventas totales:</b> ${{stats['total_ventas']:,}}<br>
        <b>Total pedidos:</b> {{stats['total_pedidos']}}<br>
        <b>Pendientes:</b> {{stats['pendientes']}}<br>
        <b>Entregados:</b> {{stats['entregados']}}
    </div>
    <a href="/nuevo">Agregar pedido</a> | <a href="/clientes">Ver clientes</a> | <a href="/exportar_csv">Exportar pedidos a CSV</a>
    <table border="1" cellpadding="5">
        <tr><th>ID</th><th>Cliente</th><th>Cantidad</th><th>Sabor</th><th>Total</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr>
        {% for p in pedidos %}
        <tr>
            <td>{{p[0]}}</td><td>{{p[1]}}</td><td>{{p[2]}}</td><td>{{p[3]}}</td><td>${{p[4]:,}}</td><td>{{p[5]}}</td><td>{{p[6]}}</td>
            <td>
                {% if p[6] == 'pendiente' %}
                <form method="post" action="/entregar/{{p[0]}}" style="display:inline;">
                    <button type="submit">Marcar como entregado</button>
                </form>
                {% else %}✔️{% endif %}
            </td>
        </tr>
        {% endfor %}
    </table>
    '''
    return render_template_string(html, pedidos=pedidos, stats=stats)

@app.route('/exportar_csv')
def exportar_csv():
    pedidos = get_pedidos()
    def generar():
        yield 'ID,Cliente,Cantidad,Sabor,Total,Fecha,Estado\n'
        for p in pedidos:
            fila = ','.join([str(p[0]), p[1], str(p[2]), p[3], str(p[4]), str(p[5]), p[6]])
            yield fila + '\n'
    return Response(generar(), mimetype='text/csv', headers={"Content-Disposition": "attachment;filename=pedidos.csv"})

# Formulario para agregar pedido
# Formulario para agregar pedido
@app.route('/nuevo', methods=['GET', 'POST'])
def nuevo():
    if request.method == 'POST':
        cliente = request.form['cliente']
        cantidad = int(request.form['cantidad'])
        sabor = request.form['sabor']
        total = int(request.form['total'])
        conn = pedidos_db()
        cursor = conn.cursor()
        fecha = request.form['fecha']
        estado = request.form.get('estado', 'pendiente')
        cursor.execute("INSERT INTO pedidos (cliente, cantidad, sabor, total, fecha, estado) VALUES (%s, %s, %s, %s, %s, %s)",
                       (cliente, cantidad, sabor, total, fecha, estado))
        conn.commit()
        cursor.close()
        conn.close()

        # Enviar correo de notificación
        try:
            EMAIL_REMITENTE = "germanrubiano154@gmail.com"
            EMAIL_DESTINO = "grubiano23@gmail.com"
            CLAVE_APP = "gnbyrcxwodwvvowb"
            mensaje = EmailMessage()
            mensaje["Subject"] = "🧾 Nuevo pedido de yogures NOMÁ"
            mensaje["From"] = EMAIL_REMITENTE
            mensaje["To"] = EMAIL_DESTINO
            mensaje.set_content(f"Nuevo pedido:\n\nCliente: {cliente}\nCantidad: {cantidad}\nSabor: {sabor}\nTotal: ${total:,}\nEstado: {estado}\nFecha: {fecha}")
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
                smtp.login(EMAIL_REMITENTE, CLAVE_APP)
                smtp.send_message(mensaje)
        except Exception as e:
            print(f"Error al enviar correo: {e}")

        return redirect('/')
    html = '''
    <h2>Agregar pedido</h2>
    <form method="post">
        Cliente: <input name="cliente" required><br>
        Cantidad: <input name="cantidad" type="number" required><br>
        Sabor: <input name="sabor" value="normal" required><br>
        Total: <input name="total" type="number" required><br>
        Fecha: <input name="fecha" value="{{fecha}}" required><br>
        Estado: <select name="estado">
            <option value="pendiente" selected>Pendiente</option>
            <option value="entregado">Entregado</option>
        </select><br>
        <input type="submit" value="Guardar">
    </form>
    <a href="/">Volver</a>
    '''
    from datetime import datetime
    fecha = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return render_template_string(html, fecha=fecha)


# Ruta para marcar pedido como entregado
@app.route('/entregar/<int:pedido_id>', methods=['POST'])
def entregar(pedido_id):
    conn = pedidos_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE pedidos SET estado='entregado' WHERE id=%s", (pedido_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return redirect('/')

if __name__ == '__main__':
    app.run(debug=True)
