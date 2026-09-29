@echo off
chcp 65001 >nul 2>&1
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║            WEBGIS HCM — Khởi động Backend               ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
cd /d "%~dp0"

REM ── Kiểm tra Python ────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  Chưa cài Python! Cài tại: https://python.org
    pause & exit /b 1
)

REM ── Kiểm tra PostgreSQL ─────────────────────────────────────────────────────
echo [1/4] Kiểm tra PostgreSQL...
pg_isready -h localhost -p 5432 -q >nul 2>&1
if errorlevel 1 (
    echo  PostgreSQL CHƯA CHẠY!
    echo    Mở services.msc, bật postgresql-x64-... lên rồi chạy lại
    echo.
    echo    Hoặc chạy: KIEM_TRA_DATABASE.bat để tự động fix
    pause & exit /b 1
) else (
    echo     PostgreSQL OK
)

REM ── Kiểm tra database ───────────────────────────────────────────────────────
echo [2/4] Kiểm tra database nckh_hcm...
set PGPASSWORD=123456
psql -h localhost -p 5432 -U postgres -d nckh_hcm -c "SELECT COUNT(*) FROM accidents;" >nul 2>&1
if errorlevel 1 (
    echo  Database nckh_hcm lỗi hoặc chưa tồn tại!
    echo    Chạy KIEM_TRA_DATABASE.bat để restore tự động
    pause & exit /b 1
) else (
    echo     Database nckh_hcm OK
)

REM ── Cài thư viện ────────────────────────────────────────────────────────────
echo [3/4] Cài thư viện Python...
pip install -r requirements.txt -q
echo     Thư viện OK

REM ── Chạy backend ────────────────────────────────────────────────────────────
echo [4/4] Khởi động Flask API...
echo.
echo ══════════════════════════════════════════════════════════
echo   API đang chạy tại: http://localhost:5000
echo   Kiểm tra DB:       http://localhost:5000/api/health
echo   Dữ liệu đường:     http://localhost:5000/api/roads
echo   Dữ liệu tai nạn:   http://localhost:5000/api/accidents
echo   Biển báo:          http://localhost:5000/api/traffic_signs
echo ══════════════════════════════════════════════════════════
echo.
python app.py
pause
