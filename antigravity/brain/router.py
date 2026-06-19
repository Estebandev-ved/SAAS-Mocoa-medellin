import redis
import os
from datetime import datetime
import json
from brain.azure_client import get_azure_client, get_azure_model

PLAN_LIMITS = {
    "starter": 1000,
    "professional": 5000,
    "enterprise": float('inf')
}

class GPTRouter:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            db=0,
            decode_responses=True
        )
        self.client = get_azure_client()

    def _get_limit_key(self, negocio_id):
        mes_actual = datetime.now().strftime("%Y-%m")
        return f"gpt_calls:{negocio_id}:{mes_actual}"

    def _get_plan_key(self, negocio_id):
        return f"negocio_plan:{negocio_id}"

    def _get_plan(self, negocio_id):
        plan_key = self._get_plan_key(negocio_id)
        
        cached_plan = self.redis_client.get(plan_key)
        if cached_plan:
            return cached_plan
        
        try:
            import mysql.connector
            conn = mysql.connector.connect(
                host=os.getenv('MYSQL_HOST', 'localhost'),
                user=os.getenv('MYSQL_USER', 'root'),
                password=os.getenv('MYSQL_PASSWORD', ''),
                database=os.getenv('MYSQL_DATABASE', 'antigravity')
            )
            cursor = conn.cursor()
            
            cursor.execute("SELECT plan FROM negocios WHERE id = %s", (negocio_id,))
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            plan = result[0] if result else "starter"
            self.redis_client.setex(plan_key, 3600, plan)
            
            return plan
        except Exception as e:
            print(f"[GPTRouter] Error getting plan: {e}")
            return "starter"

    def check_limit(self, negocio_id):
        key = self._get_limit_key(negocio_id)
        
        current_usage = self.redis_client.get(key)
        current_count = int(current_usage) if current_usage else 0
        
        plan = self._get_plan(negocio_id)
        limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["starter"])
        
        return {
            "allowed": current_count < limit,
            "current": current_count,
            "limit": limit,
            "remaining": max(0, limit - current_count),
            "plan": plan
        }

    def increment_usage(self, negocio_id):
        key = self._get_limit_key(negocio_id)
        
        current = self.redis_client.get(key)
        count = int(current) if current else 0
        
        self.redis_client.setex(key, 2592000, count + 1)

    def call_gpt(self, negocio_id, messages, temperature=0.7, model=get_azure_model()):
        limit_info = self.check_limit(negocio_id)
        
        if not limit_info["allowed"]:
            return {
                "success": False,
                "error": "limite_excedido",
                "message": f"Has alcanzado el límite de {limit_info['limit']} llamadas este mes. Actualiza tu plan.",
                "limit_info": limit_info
            }
        
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=1000
            )
            
            self.increment_usage(negocio_id)
            
            return {
                "success": True,
                "response": response.choices[0].message.content,
                "usage": response.usage,
                "limit_info": self.check_limit(negocio_id)
            }
            
        except Exception as e:
            print(f"[GPTRouter] Error calling GPT: {e}")
            return {
                "success": False,
                "error": str(e),
                "fallback_response": self._generate_fallback_response(messages)
            }

    def _generate_fallback_response(self, messages):
        if not messages:
            return "Disculpa, tuve un problema. ¿Podrías repetir tu mensaje?"
        
        last_message = messages[-1].get("content", "")
        
        return "Gracias por tu mensaje. Estoy procesando tu solicitud. ¿Podrías darme un momento?"

    def get_stats(self, negocio_id):
        limit_info = self.check_limit(negocio_id)
        return {
            "plan": limit_info["plan"],
            "llamadas_usadas": limit_info["current"],
            "limite": limit_info["limit"],
            "disponibles": limit_info["remaining"]
        }


gpt_router = GPTRouter()
