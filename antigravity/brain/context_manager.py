import redis
import json
import os
from datetime import datetime, timedelta

class ContextManager:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            db=0,
            decode_responses=True
        )
        self.ttl = 7200

    def _get_key(self, negocio_id, cliente_id):
        return f"context:{negocio_id}:{cliente_id}"

    def get_context(self, negocio_id, cliente_id):
        key = self._get_key(negocio_id, cliente_id)
        
        cached = self.redis_client.get(key)
        if cached:
            return json.loads(cached)
        
        contexto = self._load_from_db(negocio_id, cliente_id)
        
        if contexto:
            self.redis_client.setex(key, self.ttl, json.dumps(contexto))
        
        return contexto

    def _load_from_db(self, negocio_id, cliente_id):
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
                "SELECT mensajes FROM conversaciones WHERE negocio_id = %s AND cliente_id = %s AND activa = True ORDER BY updated_at DESC LIMIT 1",
                (negocio_id, cliente_id)
            )
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            if result and result['mensajes']:
                mensajes = json.loads(result['mensajes'])
                return mensajes[-10:] if len(mensajes) > 10 else mensajes
            
            return []
        except Exception as e:
            print(f"[ContextManager] Error loading from DB: {e}")
            return []

    def save_message(self, negocio_id, cliente_id, rol, contenido):
        key = self._get_key(negocio_id, cliente_id)
        
        contexto = self.get_context(negocio_id, cliente_id)
        if not contexto:
            contexto = []
        
        mensaje = {
            "rol": rol,
            "contenido": contenido,
            "timestamp": datetime.now().isoformat()
        }
        contexto.append(mensaje)
        
        if len(contexto) > 20:
            contexto = contexto[-20:]
        
        self.redis_client.setex(key, self.ttl, json.dumps(contexto))
        
        self._save_to_db_async(negocio_id, cliente_id, mensaje)

    def _save_to_db_async(self, negocio_id, cliente_id, mensaje):
        try:
            import mysql.connector
            from datetime import datetime
            import threading
            
            def save():
                try:
                    conn = mysql.connector.connect(
                        host=os.getenv('MYSQL_HOST', 'localhost'),
                        user=os.getenv('MYSQL_USER', 'root'),
                        password=os.getenv('MYSQL_PASSWORD', ''),
                        database=os.getenv('MYSQL_DATABASE', 'antigravity')
                    )
                    cursor = conn.cursor()
                    
                    cursor.execute(
                        "SELECT mensajes FROM conversaciones WHERE negocio_id = %s AND cliente_id = %s ORDER BY updated_at DESC LIMIT 1",
                        (negocio_id, cliente_id)
                    )
                    result = cursor.fetchone()
                    
                    if result:
                        mensajes = json.loads(result[0]) if result[0] else []
                        mensajes.append(mensaje)
                        cursor.execute(
                            "UPDATE conversaciones SET mensajes = %s, updated_at = NOW() WHERE negocio_id = %s AND cliente_id = %s",
                            (json.dumps(mensajes), negocio_id, cliente_id)
                        )
                    
                    conn.commit()
                    cursor.close()
                    conn.close()
                except Exception as e:
                    print(f"[ContextManager] Async save error: {e}")
            
            thread = threading.Thread(target=save)
            thread.start()
        except Exception as e:
            print(f"[ContextManager] Error initiating async save: {e}")

    def clear_context(self, negocio_id, cliente_id):
        key = self._get_key(negocio_id, cliente_id)
        self.redis_client.delete(key)


context_manager = ContextManager()
