import asyncio
import time
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class MonitorCarga:
    """
    Motor de Auto-Escalado - Monitorea la carga del sistema y ajusta recursos.
    """
    
    UMBRAL_SPAWN_COLA = 10
    UMBRAL_KILL_COLA = 2
    UMBRAL_SPAWN_TIEMPO_MS = 3000
    UMBRAL_KILL_TIEMPO_MS = 500
    UMBRAL_OCUPACION_SPAWN = 0.8
    UMBRAL_OCUPACION_KILL = 0.2
    SPAWN_COOLDOWN = 5
    
    def __init__(self, maestro):
        self.maestro = maestro
        self.ultima_evaluacion = 0
        self.modo_conservador = False
        
    async def iniciar(self):
        """Inicia el loop de monitoreo."""
        logger.info("[MonitorCarga] Iniciando motor de auto-escalado...")
        
        while True:
            await asyncio.sleep(self.SPAWN_COOLDOWN)
            await self.evaluar()
    
    async def evaluar(self):
        """Evalúa si necesita escalar o reducir recursos."""
        ahora = time.time()
        if ahora - self.ultima_evaluacion < self.SPAWN_COOLDOWN:
            return
        
        self.ultima_evaluacion = ahora
        
        try:
            stats = await self.maestro.obtener_stats()
            
            await self._evaluar_escalado_global(stats)
            await self._evaluar_escalado_por_supervisor(stats)
            
            logger.info(f"[MonitorCarga] Stats: cola={stats['cola_actual']}, "
                       f"supervisores={stats['supervisores_activos']}, "
                       f"workers={stats['workers_activos']}, "
                       f"tiempo_ms={stats['tiempo_respuesta_promedio_ms']}")
                       
        except Exception as e:
            logger.error(f"[MonitorCarga] Error en evaluación: {e}")
    
    async def _evaluar_escalado_global(self, stats: dict):
        """Evalúa escalado a nivel global."""
        if stats['cola_actual'] > self.UMBRAL_SPAWN_COLA:
            self.modo_conservador = False
            logger.info("[MonitorCarga] Alta carga detectada - modo activo")
            
        elif stats['cola_actual'] < self.UMBRAL_KILL_COLA and stats['workers_activos'] > 1:
            logger.info("[MonitorCarga] Baja carga - recursos mínimos activos")
    
    async def _evaluar_escalado_por_supervisor(self, stats: dict):
        """Evalúa escalado por cada supervisor (negocio)."""
        for negocio_id, supervisor in self.maestro.supervisores.items():
            mensajes_por_minuto = supervisor.mensajes_ultimo_minuto
            
            if mensajes_por_minuto > 20:
                if supervisor.MAX_WORKERS_POR_NEGOCIO < 5:
                    supervisor.MAX_WORKERS_POR_NEGOCIO += 1
                    logger.info(f"[MonitorCarga] negocio {negocio_id}: "
                               f"aumentando max_workers a {supervisor.MAX_WORKERS_POR_NEGOCIO}")
                    
            elif mensajes_por_minuto < 2 and supervisor.MAX_WORKERS_POR_NEGOCIO > 1:
                supervisor.MAX_WORKERS_POR_NEGOCIO -= 1
                logger.info(f"[MonitorCarga] negocio {negocio_id}: "
                           f"reduciendo max_workers a {supervisor.MAX_WORKERS_POR_NEGOCIO}")
    
    async def limpiar_supervisores_inactivos(self):
        """Elimina supervisores que llevan 5 minutos sin mensajes."""
        inactivos = []
        for negocio_id, supervisor in self.maestro.supervisores.items():
            if supervisor.esta_inactivo():
                inactivos.append(negocio_id)
        
        for negocio_id in inactivos:
            del self.maestro.supervisores[negocio_id]
            logger.info(f"[MonitorCarga] Supervisor inactivo eliminado: negocio {negocio_id}")
    
    def activar_modo_conservador(self):
        """Activa modo conservador cuando se acerca al límite de tokens."""
        self.modo_conservador = True
        logger.warning("[MonitorCarga] Modo conservador activado - límite de tokens cercano")
    
    def obtener_stats(self) -> dict:
        """Retorna estadísticas del monitor."""
        return {
            'modo_conservador': self.modo_conservador,
            'ultima_evaluacion': self.ultima_evaluacion,
            'cola_umbral_spawn': self.UMBRAL_SPAWN_COLA,
            'cola_umbral_kill': self.UMBRAL_KILL_COLA,
            'tiempo_ms_spawn': self.UMBRAL_SPAWN_TIEMPO_MS,
            'tiempo_ms_kill': self.UMBRAL_KILL_TIEMPO_MS
        }