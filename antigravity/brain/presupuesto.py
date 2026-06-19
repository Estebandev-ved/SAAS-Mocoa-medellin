import time
import logging
import os
import mysql.connector
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class PresupuestoTokens:
    """
    Control de presupuesto de tokens por plan de suscripción.
    Evita exceder límites y activa modo conservador cuando se acerca al límite.
    """
    
    LIMITES = {
        'starter': 50_000,
        'professional': 200_000,
        'enterprise': 999_999_999
    }
    
    LIMITE_POR_MINUTO = 50000
    
    def __init__(self):
        self.tokens_hoy: dict = {}
        self.tokens_minuto: dict = {}
        self.ultimo_reset_dia = time.strftime('%Y-%m-%d')
        
    def puede_procesar(self, negocio_id: int, plan: str) -> Tuple[bool, Optional[str]]:
        """Verifica si el negocio puede procesar más mensajes según su plan."""
        self._verificar_reset_diario()
        
        tokens_usados = self.tokens_hoy.get(negocio_id, 0)
        limite = self.LIMITES.get(plan, self.LIMITES['starter'])
        
        if tokens_usados >= limite:
            return False, f"Límite de IA diario alcanzado ({limite:,} tokens). Se renueva mañana."
        
        if tokens_usados >= limite * 0.8:
            return True, "advertencia"
            
        return True, None
    
    def puede_procesar_minuto(self, negocio_id: int) -> Tuple[bool, Optional[str]]:
        """Verifica el límite por minuto."""
        minuto_actual = int(time.time() / 60)
        key = f"{negocio_id}_{minuto_actual}"
        
        tokens_min = self.tokens_minuto.get(key, 0)
        
        if tokens_min >= self.LIMITE_POR_MINUTO:
            return False, "Límite de tokens por minuto alcanzado. Espera un momento."
        
        return True, None
    
    def registrar_tokens(self, negocio_id: int, tokens: int):
        """Registra el uso de tokens."""
        self._verificar_reset_diario()
        
        self.tokens_hoy[negocio_id] = self.tokens_hoy.get(negocio_id, 0) + tokens
        
        minuto_actual = int(time.time() / 60)
        key = f"{negocio_id}_{minuto_actual}"
        self.tokens_minuto[key] = self.tokens_minuto.get(key, 0) + tokens
        
        logger.info(f"[Presupuesto] negocio {negocio_id}: +{tokens} tokens (total hoy: {self.tokens_hoy[negocio_id]})")
    
    async def cargar_tokens_desde_db(self, negocio_id: int) -> int:
        """Carga los tokens usados hoy desde la base de datos."""
        try:
            conn = mysql.connector.connect(
                host=os.getenv('MYSQL_HOST', 'localhost'),
                user=os.getenv('MYSQL_USER', 'root'),
                password=os.getenv('MYSQL_PASSWORD', ''),
                database=os.getenv('MYSQL_DATABASE', 'antigravity')
            )
            cursor = conn.cursor()
            
            hoy = time.strftime('%Y-%m-%d')
            
            cursor.execute("""
                SELECT COALESCE(SUM(tokens_usados), 0)
                FROM agente_logs
                WHERE negocio_id = %s AND DATE(fecha_creacion) = %s
            """, (negocio_id, hoy))
            
            result = cursor.fetchone()
            tokens = result[0] if result else 0
            
            cursor.close()
            conn.close()
            
            self.tokens_hoy[negocio_id] = tokens
            
            return tokens
            
        except Exception as e:
            logger.error(f"[Presupuesto] Error cargando tokens desde DB: {e}")
            return 0
    
    def _verificar_reset_diario(self):
        """Resetea los contadores si cambió el día."""
        hoy = time.strftime('%Y-%m-%d')
        if hoy != self.ultimo_reset_dia:
            self.tokens_hoy = {}
            self.ultimo_reset_dia = hoy
            self.tokens_minuto = {}
            logger.info("[Presupuesto] Contadores de tokens reseteados por nuevo día")
    
    def obtener_limite(self, plan: str) -> int:
        """Retorna el límite de tokens para un plan."""
        return self.LIMITES.get(plan, self.LIMITES['starter'])
    
    def obtener_stats(self, negocio_id: int, plan: str) -> dict:
        """Retorna estadísticas de uso de tokens."""
        tokens_usados = self.tokens_hoy.get(negocio_id, 0)
        limite = self.obtener_limite(plan)
        
        return {
            'tokens_usados': tokens_usados,
            'limite': limite,
            'porcentaje': round((tokens_usados / limite) * 100, 1) if limite > 0 else 0,
            'restantes': max(0, limite - tokens_usados)
        }


_presupuesto_global: Optional[PresupuestoTokens] = None


def get_presupuesto() -> PresupuestoTokens:
    """Retorna la instancia global del presupuesto."""
    global _presupuesto_global
    if _presupuesto_global is None:
        _presupuesto_global = PresupuestoTokens()
    return _presupuesto_global