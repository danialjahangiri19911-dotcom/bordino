@echo off
echo Starting Bordino servers...
start "Bordino Backend" cmd /k "cd /d E:\Bordino\claude\Bordino_Backend-develop\Bordino_Backend-develop && .venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"
start "Bordino Frontend" cmd /k "cd /d E:\Bordino\claude\Bordino_Frontend-develop\Bordino_Frontend-develop && pnpm dev"
echo.
echo Backend : http://127.0.0.1:8000   (Swagger: /swagger/)
echo Frontend: http://localhost:3000
echo Two windows opened. To stop: run stop-servers.bat or just close the windows.
pause
