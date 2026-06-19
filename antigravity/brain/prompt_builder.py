import redis
import json
import os

class PromptBuilder:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            db=0,
            decode_responses=True
        )
        self.config_ttl = 1800
        self.catalogo_ttl = 600

    def _get_config_key(self, negocio_id):
        return f"config:{negocio_id}"

    def _get_catalogo_key(self, negocio_id):
        return f"catalogo:{negocio_id}"

    def get_negocio_config(self, negocio_id):
        key = self._get_config_key(negocio_id)
        
        cached = self.redis_client.get(key)
        if cached:
            return json.loads(cached)
        
        config = self._load_config_from_db(negocio_id)
        
        if config:
            self.redis_client.setex(key, self.config_ttl, json.dumps(config))
        
        return config

    def _load_config_from_db(self, negocio_id):
        try:
            import mysql.connector
            conn = mysql.connector.connect(
                host=os.getenv('MYSQL_HOST', 'localhost'),
                user=os.getenv('MYSQL_USER', 'root'),
                password=os.getenv('MYSQL_PASSWORD', ''),
                database=os.getenv('MYSQL_DATABASE', 'antigravity')
            )
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute(
                """SELECT nombre, bot_nombre, bot_tono, bot_bienvenida, 
                          horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario
                   FROM negocios WHERE id = %s""",
                (negocio_id,)
            )
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return result if result else self._default_config()
        except Exception as e:
            print(f"[PromptBuilder] Error loading config: {e}")
            return self._default_config()

    def _default_config(self):
        return {
            "nombre": "Tu Negocio",
            "bot_nombre": "Asistente",
            "bot_tono": "amigable",
            "bot_bienvenida": "¡Hola! ¿En qué puedo ayudarte?",
            "horario_activo_inicio": "08:00:00",
            "horario_activo_fin": "22:00:00",
            "mensaje_fuera_horario": "Estamos fuera de horario. ¿Te contactamos mañana?"
        }

    def get_catalogo(self, negocio_id):
        key = self._get_catalogo_key(negocio_id)
        
        cached = self.redis_client.get(key)
        if cached:
            return json.loads(cached)
        
        catalogo = self._load_catalogo_from_db(negocio_id)
        
        if catalogo:
            self.redis_client.setex(key, self.catalogo_ttl, json.dumps(catalogo))
        
        return catalogo

    def _load_catalogo_from_db(self, negocio_id):
        try:
            import mysql.connector
            conn = mysql.connector.connect(
                host=os.getenv('MYSQL_HOST', 'localhost'),
                user=os.getenv('MYSQL_USER', 'root'),
                password=os.getenv('MYSQL_PASSWORD', ''),
                database=os.getenv('MYSQL_DATABASE', 'antigravity')
            )
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute(
                "SELECT nombre, descripcion, precio, stock FROM productos WHERE negocio_id = %s AND activo = True ORDER BY nombre",
                (negocio_id,)
            )
            productos = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return productos if productos else []
        except Exception as e:
            print(f"[PromptBuilder] Error loading catalogo: {e}")
            return []

    def build_system_prompt(self, negocio_id):
        config = self.get_negocio_config(negocio_id)
        catalogo = self.get_catalogo(negocio_id)
        
        tono_instrucciones = {
            "formal": "Usa un lenguaje formal y profesional.",
            "amigable": "Usa un lenguaje amigable, cálido y cercano.",
            "casual": "Usa un lenguaje casual y moderno, como hablando con un amigo."
        }
        
        catalogo_formateado = ""
        if catalogo:
            catalogo_formateado = "\n".join([
                f"- {p['nombre']}: ${p['precio']:,.0f} COP" + (f" ({p['stock']} disponibles)" if p.get('stock', 0) > 0 else "")
                for p in catalogo[:20]
            ])
        
        prompt = f"""Eres {config.get('bot_nombre', 'Asistente')}, el asistente virtual de {config.get('nombre', 'este negocio')}.
{tono_instrucciones.get(config.get('bot_tono', 'amigable'), tono_instrucciones['amigable'])}

Tu función es ayudar a los clientes con:
1. Consultas sobre productos y precios
2. Tomar pedidos
3. Responder preguntas sobre el negocio
4. Brindar información sobre métodos de pago y entrega

Productos disponibles:
{catalogo_formateado if catalogo_formateado else "No hay productos disponibles en este momento."}

Horario de atención: {config.get('horario_activo_inicio', '08:00')} a {config.get('horario_activo_fin', '22:00')}

Cuando tomes un pedido, pregunta:
- Qué productos quiere y cuántas unidades
- Dirección de entrega
- Método de pago preferido

Responde siempre en español colombiano, usa pesos colombianos (COP) para precios.
Sé conciso pero detallado cuando sea necesario."""
        
        return prompt

    def invalidate_cache(self, negocio_id):
        config_key = self._get_config_key(negocio_id)
        catalogo_key = self._get_catalogo_key(negocio_id)
        
        self.redis_client.delete(config_key)
        self.redis_client.delete(catalogo_key)


prompt_builder = PromptBuilder()
