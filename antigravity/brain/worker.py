import asyncio
import time
import logging
import os
from typing import Optional, Dict
from brain.azure_client import get_azure_client, get_azure_model

logger = logging.getLogger(__name__)

client = get_azure_client()


class Worker:
    """
    Worker especializado - Ejecuta tareas específicas de un tipo de agente.
    Puede haber múltiples workers del mismo tipo para paralelismo.
    """
    
    def __init__(self, tipo: str):
        self.tipo = tipo
        self.ocupado = False
        self.tarea_actual: Optional[dict] = None
        self.inicio_tarea: Optional[float] = None
        self.procesados = 0
        self.tiempo_total_ms = 0
        
    async def procesar(self, mensaje: str, contexto: dict, config: dict, tipo_worker) -> dict:
        """Procesa el mensaje con el agente correspondiente."""
        self.ocupado = True
        self.tarea_actual = {'mensaje': mensaje, 'inicio': time.time()}
        self.inicio_tarea = time.time()
        
        try:
            if hasattr(tipo_worker, 'value'):
                tipo_str = tipo_worker.value
            else:
                tipo_str = str(tipo_worker)
            
            resultado = await self._ejecutar_agente(tipo_str, mensaje, contexto, config)
            
            tiempo_ms = int((time.time() - self.inicio_tarea) * 1000)
            self.procesados += 1
            self.tiempo_total_ms += tiempo_ms
            
            return resultado
            
        except Exception as e:
            logger.error(f"[Worker {self.tipo}] Error: {e}")
            return {
                'respuesta': "Disculpa, no pude procesar tu mensaje. ¿Podrías reformularlo?",
                'intencion': 'error',
                'agente_usado': self.tipo,
                'tokens_usados': 0,
                'tiempo_ms': 0,
                'error': str(e)
            }
        finally:
            self.ocupado = False
            self.tarea_actual = None
            self.inicio_tarea = None
    
    async def _ejecutar_agente(self, tipo: str, mensaje: str, contexto: dict, config: dict) -> dict:
        """Ejecuta el agente correspondiente al tipo."""
        
        agentes = {
            'ventas': 'brain.agents.ventas',
            'pagos': 'brain.agents.pagos',
            'pedidos': 'brain.agents.pedidos',
            'faq': 'brain.agents.faq',
            'reclamos': 'brain.agents.reclamos',
            'retencion': 'brain.agents.retencion',
            'generic': None
        }
        
        if tipo == 'generic':
            return await self._respuesta_generica(mensaje, contexto, config)
        
        modulo_nombre = agentes.get(tipo)
        if not modulo_nombre:
            return await self._respuesta_generica(mensaje, contexto, config)
        
        try:
            import importlib
            modulo = importlib.import_module(modulo_nombre)
            
            if hasattr(modulo, 'procesar'):
                return await modulo.procesar(mensaje, contexto, config)
            elif hasattr(modulo, 'procesar_sync'):
                return modulo.procesar_sync(mensaje, contexto.get('mensajes', []), config)
            else:
                return await self._respuesta_generica(mensaje, contexto, config)
                
        except Exception as e:
            logger.error(f"[Worker] Error ejecutando agente {tipo}: {e}")
            return await self._respuesta_generica(mensaje, contexto, config)
    
    async def _respuesta_generica(self, mensaje: str, contexto: dict, config: dict) -> dict:
        """Genera una respuesta genérica cuando no hay agente específico."""
        tono = config.get('bot_tono', 'amigable')
        nombre_bot = config.get('bot_nombre', 'Asistente')
        
        tonos = {
            'formal': "Responde de manera profesional y cortés.",
            'amigable': "Responde de manera amigable y cálida.",
            'casual': "Responde de manera casual y moderna."
        }
        
        system_prompt = f"""Eres {nombre_bot}, asistente virtual de un negocio colombiano.
{tonos.get(tono, tonos['amigable'])}
El cliente dice: {mensaje}
Responde de forma breve (máximo 3 oraciones) y útil."""
        
        try:
            response = client.chat.completions.create(
                model=get_azure_model(),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": mensaje}
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            return {
                'respuesta': response.choices[0].message.content,
                'intencion': 'conversacion',
                'agente_usado': 'generic',
                'tokens_usados': response.usage.total_tokens,
                'tiempo_ms': 0
            }
        except Exception as e:
            logger.error(f"[Worker] Error en respuesta generica: {e}")
            return {
                'respuesta': "Disculpa, no pude procesar tu mensaje.",
                'intencion': 'conversacion',
                'agente_usado': 'generic',
                'tokens_usados': 0,
                'tiempo_ms': 0
            }
    
    def obtener_stats(self) -> dict:
        """Retorna estadísticas del worker."""
        avg_ms = self.tiempo_total_ms / self.procesados if self.procesados > 0 else 0
        return {
            'tipo': self.tipo,
            'ocupado': self.ocupado,
            'procesados': self.procesados,
            'tiempo_promedio_ms': int(avg_ms)
        }