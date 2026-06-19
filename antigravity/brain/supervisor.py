import asyncio
import time
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class TipoWorker(Enum):
    VENTAS = "ventas"
    PAGOS = "pagos"
    PEDIDOS = "pedidos"
    FAQ = "faq"
    RECLAMOS = "reclamos"
    RETENCION = "retencion"
    CAMPANAS = "campanas"
    SEGUIMIENTO = "seguimiento"
    ESCALACION = "escalacion"
    GENERIC = "generic"


@dataclass
class WorkerInstance:
    tipo: TipoWorker
    ocupado: bool = False
    tarea_actual: Optional[dict] = None
    inicio_tarea: Optional[float] = None
    
    def ocupar(self, tarea: dict):
        self.ocupado = True
        self.tarea_actual = tarea
        self.inicio_tarea = time.time()
        
    def liberar(self):
        self.ocupado = False
        self.tarea_actual = None
        self.inicio_tarea = None


class Supervisor:
    """
    Supervisor por Negocio - Gestiona los workers de un negocio específico.
    Cada negocio con tráfico tiene su propio Supervisor.
    """
    
    MAX_WORKERS_POR_NEGOCIO = 3
    
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id
        self.config: Optional[dict] = None
        self.workers: Dict[TipoWorker, List[WorkerInstance]] = {
            tipo: [] for tipo in TipoWorker
        }
        self.mensajes_ultimo_minuto = 0
        self.ultimo_mensaje = time.time()
        self._iniciar_contador()
        
    def _iniciar_contador(self):
        """Reinicia el contador cada minuto."""
        async def reiniciar():
            while True:
                await asyncio.sleep(60)
                self.mensajes_ultimo_minuto = 0
                logger.debug(f"[Supervisor {self.negocio_id}] Contador reiniciado")
        
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(reiniciar())
            else:
                loop.run_until_complete(reiniciar())
        except:
            pass
        
    async def cargar_config(self, negocio_id: int):
        """Carga la configuración del negocio desde la base de datos."""
        from brain.main import get_negocio_config
        self.config = get_negocio_config(negocio_id)
        
    async def manejar(self, mensaje: str, contexto: dict, cliente_id: int) -> dict:
        """Maneja un mensaje entrante."""
        self.mensajes_ultimo_minuto += 1
        self.ultimo_mensaje = time.time()
        
        if not self.config:
            await self.cargar_config(self.negocio_id)
        
        intencion = await self._clasificar_intencion(mensaje)
        tipo_worker = self._mapear_intencion_worker(intencion)
        
        worker = self._obtener_worker(tipo_worker)
        if worker:
            return await worker.procesar(mensaje, contexto, self.config, tipo_worker)
        
        return {
            'respuesta': "Disculpa, no pude procesar tu mensaje en este momento.",
            'intencion': intencion,
            'agente_usado': tipo_worker.value,
            'tokens_usados': 0,
            'tiempo_ms': 0
        }
    
    async def _clasificar_intencion(self, mensaje: str) -> str:
        """Clasifica la intención del mensaje."""
        from brain.orchestrator import clasificar_intencion_sync
        return clasificar_intencion_sync(mensaje)
    
    def _mapear_intencion_worker(self, intencion: str) -> TipoWorker:
        """Mapea intención a tipo de worker."""
        mapeo = {
            'compra': TipoWorker.VENTAS,
            'pago': TipoWorker.PAGOS,
            'pedido': TipoWorker.PEDIDOS,
            'consulta': TipoWorker.FAQ,
            'queja': TipoWorker.RECLAMOS,
            'cancelacion': TipoWorker.RETENCION,
            'conversacion': TipoWorker.GENERIC
        }
        return mapeo.get(intencion, TipoWorker.GENERIC)
    
    def _obtener_worker(self, tipo: TipoWorker) -> Optional[WorkerInstance]:
        """Obtiene un worker libre o crea uno nuevo."""
        from brain.worker import Worker
        workers_libres = [w for w in self.workers[tipo] if not w.ocupado]
        
        if workers_libres:
            return workers_libres[0]
        
        if self._contar_workers_totales() < self.MAX_WORKERS_POR_NEGOCIO:
            from brain.worker import Worker
            worker_instance = Worker(tipo=tipo.value)
            self.workers[tipo].append(worker_instance)
            return worker_instance
        
        workers_ocupados = [w for w in self.workers[tipo] if w.ocupado]
        if workers_ocupados:
            return workers_ocupados[0]
        
        return None
    
    def _contar_workers_totales(self) -> int:
        """Cuenta el total de workers activos."""
        return sum(len(self.workers[t]) for t in TipoWorker)
    
    def obtener_workers_activos(self) -> int:
        """Retorna el número de workers activos (ocupados)."""
        return sum(1 for workers in self.workers.values() for w in workers if w.ocupado)
    
    def esta_inactivo(self) -> bool:
        """Verifica si el supervisor lleva 5 minutos sin mensajes."""
        return (time.time() - self.ultimo_mensaje) > 300