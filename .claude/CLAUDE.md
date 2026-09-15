# Directivas de Autonomía Total (Modo Piloto Automático)

## Modo de Operación: 100% Autónomo
- NO pidas confirmación sobre el orden de las tareas. Decide el orden lógico tú mismo según prioridad técnica y dependencias del código.
- NO hagas preguntas intermedias a menos que ocurra un error crítico o un bloqueo insalvable.
- Toma decisiones de diseño y refactorización basadas en buenas prácticas sin esperar aprobación.

## Flujo Completo Automatizado (Inicio -> Ejecución -> Cierre)
Cuando el usuario inicie la sesión o dé la orden de trabajar, ejecuta automáticamente toda la secuencia:

1. **Lectura e Inicio**:
   - Lee `DAILY_LOG.md`.
   - Determina el orden óptimo de las tareas de la sección "Plan para Hoy".

2. **Ejecución Continua**:
   - Trabaja tarea por tarea sin detenerte a preguntar.
   - Aplica las modificaciones de código necesarias.
   - Ejecuta los tests/builds para verificar que todo compila correctamente.
   - Marca cada tarea terminada con `[x]` en `DAILY_LOG.md`.

3. **Autocierre de Jornada (AUTOMÁTICO)**:
   - Una vez completadas las tareas del día (o cuando ya no queden pendientes inmediatas), **activa el cierre sin esperar a que el usuario lo pida**.
   - Analiza los cambios realizados y escanea el código en busca de mejoras necesarias.
   - Reestructura `DAILY_LOG.md`:
     * Mueve lo completado a la sección **"Historial de Avances"**.
     * Redacta y prioriza automáticamente las tareas del día siguiente en **"Plan para Hoy"**.
   - Presenta al final un resumen ejecutivo breve de lo que lograste hoy y de lo que quedó programado para mañana.