@echo off
echo ========================================
echo   ANTIGRAVITY - Iniciando servicios
echo ========================================

echo.
echo [1/5] Matando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] Verificando puertos libres...
netstat -ano | findstr ":3002" >nul 2>&1
if %errorlevel%==0 (
    echo   Puerto 3002 ocupado, liberando...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do taskkill /F /PID %%a >nul 2>&1
)
netstat -ano | findstr ":3001" >nul 2>&1
if %errorlevel%==0 (
    echo   Puerto 3001 ocupado, liberando...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [3/5] Iniciando API Server (puerto 3002)...
start "API Server" cmd /c "cd /d %~dp0 && node api/index.js"
timeout /t 3 /nobreak >nul

echo [4/5] Iniciando Instance Manager (puerto 3001)...
start "Instance Manager" cmd /c "cd /d %~dp0 && node instance-manager/index.js"
timeout /t 3 /nobreak >nul

echo [5/5] Iniciando Queue Worker (campañas masivas)...
where redis-cli >nul 2>&1
if %errorlevel%==0 (
    redis-cli ping >nul 2>&1
    if not %errorlevel%==0 (
        echo   AVISO: Redis no responde en localhost:6379 - las campanas masivas no se enviaran hasta que este corriendo.
    )
) else (
    echo   AVISO: no se encontro redis-cli - si Redis no esta corriendo, las campanas masivas no se enviaran.
    echo   Instalalo o usa "docker compose -f infra\docker-compose.yml up -d redis".
)
start "Queue Worker" cmd /c "cd /d %~dp0 && node queue/index.js"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Servicios iniciados:
echo   API:            http://localhost:3002
echo   Instance Mgr:   http://localhost:3001
echo   Queue Worker:   procesa campañas masivas (requiere Redis)
echo   Frontend:       http://localhost:5173
echo ========================================
echo.
echo Presiona cualquier tecla para abrir el dashboard...
pause >nul
start http://localhost:5173/dashboard
