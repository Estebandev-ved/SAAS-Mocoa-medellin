# Guía de integración y documentación del proyecto Bot NOMA

## Estructura del proyecto

- **bot-api-python/**: Backend en Python (Flask)
  - Maneja usuarios, pedidos, autenticación, correo y conexión a MySQL.
  - Endpoints protegidos, validaciones y seguridad avanzada.
  - Archivos principales: `web_pedidos.py`, `app.py`, `main.py`, `db.py`, `crear_db.py`.
  - Templates HTML para login, gestión de usuarios y pedidos.
  - Variables sensibles en `.env` (no subir a repositorio).

- **bot-whatsapp/**: Bot en Node.js
  - Interactúa con usuarios por WhatsApp usando Baileys.
  - Envía mensajes a la API Python y gestiona estados de conversación.
  - Variables sensibles en `.env`.

## Instalación y configuración

1. Clona el repositorio y navega a la carpeta del proyecto.
2. Crea y configura el archivo `.env` en cada carpeta con tus claves y endpoints.
3. Instala dependencias:
   - Python: `pip install -r requirements.txt` (agrega Flask, Flask-WTF, Flask-Limiter, python-dotenv, mysql-connector-python)
   - Node.js: `npm install` en `bot-whatsapp/`
4. Configura la base de datos MySQL y ejecuta el script de creación (`crear_base_datos.sql`).

## Ejecución

- Backend Python: `python web_pedidos.py` o `python app.py`
- Bot WhatsApp: `node index.js`

## Seguridad

- Variables sensibles y claves en `.env` (nunca en el código ni en el repositorio).
- Cookies seguras, CSRF, protección contra fuerza bruta, validaciones estrictas.
- Logging de eventos críticos en `app.log`.

## Pruebas y robustez

- Usa pruebas unitarias para funciones críticas (puedes usar `pytest` en Python y `jest` en Node.js).
- Revisa el archivo `app.log` para auditoría y solución de problemas.

## Comentarios y soporte

- Los archivos principales tienen comentarios explicativos.
- Para dudas o soporte, documenta los cambios y errores en el archivo `app.log`.

---

> Mantén tu entorno actualizado y nunca subas datos sensibles al repositorio. Revisa la documentación y los comentarios en el código para entender el flujo y la integración entre el bot y la API.
