import asyncio
import time
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

from brain.supervisor import Supervisor

_maestro_global: Optional['AgenteMaestro'] = None
_monitor_global: Optional['MonitorCarga'] = None


def get_maestro() -> 'AgenteMaestro':
    """Retorna la instancia global del AgenteMaestro."""
    global _maestro_global
    if _maestro_global is None:
        _maestro_global = AgenteMaestro()
    return _maestro_global


def get_monitor() -> 'MonitorCarga':
    """Retorna la instancia global del Monitor de carga."""
    global _monitor_global
    if _monitor_global is None:
        _monitor_global = MonitorCarga(get_maestro())
    return _monitor_global


async def iniciar_sistema_async():
    """Inicia el Agente Maestro y el Monitor de carga."""
    maestro = get_maestro()
    monitor = get_monitor()
    
    asyncio.create_task(maestro.iniciar())
    asyncio.create_task(monitor.iniciar())
    
    logger.info("[OrchestratorAsync] Sistema multi-agente iniciado")


async def proceso_async(mensaje: str, contexto: dict, negocio_config: dict, cliente_id: int) -> dict:
    """
    Procesa un mensaje usando el sistema multi-agente async.
    Procesa inmediatamente y retorna la respuesta.
    Si falla, usa fallback síncrono.
    """
    try:
        maestro = get_maestro()
        negocio_id = negocio_config.get('id', 0)
        
        if negocio_id not in maestro.supervisores:
            maestro.supervisores[negocio_id] = Supervisor(negocio_id)
        
        supervisor = maestro.supervisores[negocio_id]
        resultado = await supervisor.manejar(mensaje, contexto, cliente_id)
        
        return resultado
        
    except Exception as e:
        logger.warning(f"[OrchestratorAsync] Fallback síncrono activado: {e}")
        
        try:
            from brain.orchestrator import procesar_flujo
            contexto_list = contexto.get('mensajes', contexto) if isinstance(contexto, dict) else contexto
            resultado = procesar_flujo(mensaje, contexto_list, negocio_config, cliente_id)
            return {
                'respuesta': resultado.get('respuesta', ''),
                'intencion': resultado.get('intencion', 'conversacion'),
                'agente_usado': f"{resultado.get('agente_usado')}_fallback",
                'tokens_usados': resultado.get('tokens_usados', 0),
                'tiempo_ms': resultado.get('tiempo_ms', 0),
                'fallback': True
            }
        except Exception as e2:
            logger.error(f"[OrchestratorAsync] Fallback también falló: {e2}")
            return {
                'respuesta': "Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?",
                'intencion': 'error',
                'agente_usado': 'error',
                'tokens_usados': 0,
                'tiempo_ms': 0,
                'error': str(e2)
            }


class AgenteMaestro:
    """
    Agente Maestro - Director Orquestador del sistema multi-agente.
    Recibe todos los mensajes entrantes, evalúa carga y decide escalado.
    """
    
    def __init__(self):
        self.cola: asyncio.Queue = asyncio.Queue()
        self.supervisores: Dict[int, Supervisor] = {}
        self.running: bool = False
        self.stats = {
            'mensajes_procesados': 0,
            'cola_actual': 0,
            'supervisores_activos': 0,
            'workers_activos': 0,
            'tiempo_respuesta_promedio_ms': 0,
            'tokens_hoy': 0,
            'inicio': time.time()
        }
        
    async def encolar(self, mensaje: str, negocio_id: int, contexto: dict, cliente_id: int):
        """Agrega un mensaje a la cola de procesamiento."""
        await self.cola.put({
            'mensaje': mensaje,
            'negocio_id': negocio_id,
            'contexto': contexto,
            'cliente_id': cliente_id,
            'timestamp': time.time()
        })
        
    async def iniciar(self):
        """Inicia el loop principal del Maestro."""
        self.running = True
        logger.info("[AgenteMaestro] Iniciando loop principal...")
        
        while self.running:
            try:
                task = await asyncio.wait_for(self.cola.get(), timeout=1.0)
                asyncio.create_task(self._procesar_mensaje(task))
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"[AgenteMaestro] Error en loop: {e}")
                
    async def _procesar_mensaje(self, task: dict):
        """Procesa un mensaje individual."""
        inicio = time.time()
        
        try:
            negocio_id = task['negocio_id']
            
            if negocio_id not in self.supervisores:
                self.supervisores[negocio_id] = Supervisor(negocio_id)
                logger.info(f"[AgenteMaestro] Nuevo Supervisor creado para negocio {negocio_id}")
            
            supervisor = self.supervisores[negocio_id]
            resultado = await supervisor.manejar(
                task['mensaje'],
                task['contexto'],
                task['cliente_id']
            )
            
            tiempo_ms = int((time.time() - inicio) * 1000)
            self.stats['mensajes_procesados'] += 1
            self.stats['tiempo_respuesta_promedio_ms'] = (
                (self.stats['tiempo_respuesta_promedio_ms'] * (self.stats['mensajes_procesados'] - 1) + tiempo_ms)
                / self.stats['mensajes_procesados']
            )
            
            logger.info(f"[AgenteMaestro] Mensaje procesado en {tiempo_ms}ms")
            
        except Exception as e:
            logger.error(f"[AgenteMaestro] Error procesando mensaje: {e}")
            
    async def obtener_stats(self) -> dict:
        """Retorna estadísticas del sistema."""
        self.stats['cola_actual'] = self.cola.qsize()
        self.stats['supervisores_activos'] = len(self.supervisores)
        
        total_workers = 0
        for sup in self.supervisores.values():
            total_workers += sup.obtener_workers_activos()
        self.stats['workers_activos'] = total_workers
        
        return self.stats.copy()
    
    async def detener(self):
        """Detiene el Agente Maestro."""
        self.running = False
        logger.info("[AgenteMaestro] Detenido")


from brain.monitor import MonitorCarga