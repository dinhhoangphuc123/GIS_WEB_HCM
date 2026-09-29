@echo off
chcp 65001 >nul 2>&1
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         WEBGIS HCM - KIỂM TRA VÀ SỬA KẾT NỐI DB        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

set PGPASSWORD=123456
set DB=nckh_hcm
set USR=postgres
set HOST=localhost
set PORT=5432

REM ── BƯỚC 1: PostgreSQL có chạy không? ─────────────────────────────────────
echo [Bước 1] Kiểm tra PostgreSQL...
pg_isready -h %HOST% -p %PORT% -q >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL CHƯA CHẠY!
    echo.
    echo 👉 Cách bật:
    echo    1. Nhấn Win+R, gõ: services.msc
    echo    2. Tìm dòng "postgresql-x64-..." (ví dụ postgresql-x64-16)
    echo    3. Click chuột phải → Start
    echo.
    echo    HOẶC mở CMD với quyền Admin, gõ:
    echo    net start postgresql-x64-16
    echo.
    pause
    goto :eof
)
echo ✅ PostgreSQL đang chạy

REM ── BƯỚC 2: Kết nối được không? ───────────────────────────────────────────
echo [Bước 2] Kiểm tra kết nối với user postgres / password 123456...
psql -h %HOST% -p %PORT% -U %USR% -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo ❌ Không kết nối được! Sai password?
    echo.
    echo 👉 Thử đổi password postgres thành 123456:
    echo    1. Mở pgAdmin hoặc psql với password hiện tại
    echo    2. Chạy: ALTER USER postgres PASSWORD '123456';
    echo.
    echo    HOẶC sửa password trong backend\app.py:
    echo    'password': 'PASSWORD_CUA_BAN'
    echo.
    pause
    goto :eof
)
echo ✅ Kết nối PostgreSQL thành công

REM ── BƯỚC 3: Database nckh_hcm có tồn tại không? ──────────────────────────
echo [Bước 3] Kiểm tra database nckh_hcm...
psql -h %HOST% -p %PORT% -U %USR% -lqt 2>nul | findstr /i "nckh_hcm" >nul
if errorlevel 1 (
    echo ❌ Database nckh_hcm CHƯA TỒN TẠI!
    echo.
    echo 👉 Đang restore từ data.backup...
    
    REM Tìm file data.backup
    set BACKUP_FILE=%~dp0data.backup
    if not exist "%BACKUP_FILE%" (
        echo ❌ Không tìm thấy file data.backup!
        echo    Vui lòng đặt file data.backup vào cùng thư mục với file bat này
        pause
        goto :eof
    )
    
    echo    Tạo database nckh_hcm...
    psql -h %HOST% -p %PORT% -U %USR% -c "CREATE DATABASE nckh_hcm;" >nul 2>&1
    
    echo    Restore data từ data.backup (có thể mất 1-2 phút)...
    pg_restore -h %HOST% -p %PORT% -U %USR% -d nckh_hcm -F c --no-owner --no-privileges "%BACKUP_FILE%" 2>&1
    
    if errorlevel 1 (
        echo ⚠️  Có một số warning khi restore (thường là bình thường)
    )
    echo ✅ Restore hoàn tất!
) else (
    echo ✅ Database nckh_hcm đã tồn tại
)

REM ── BƯỚC 4: Kiểm tra các bảng và số lượng records ─────────────────────────
echo.
echo [Bước 4] Kiểm tra dữ liệu trong database...
echo.
psql -h %HOST% -p %PORT% -U %USR% -d %DB% -c "
SELECT 
  'roads'              AS bang, COUNT(*) AS so_luong FROM roads
UNION ALL SELECT 'accidents',           COUNT(*) FROM accidents
UNION ALL SELECT 'traffic_signs',       COUNT(*) FROM traffic_signs
UNION ALL SELECT 'traffic_conditions',  COUNT(*) FROM traffic_conditions
UNION ALL SELECT 'road_features',       COUNT(*) FROM road_features
UNION ALL SELECT 'wards',               COUNT(*) FROM wards
ORDER BY bang;
" 2>&1

echo.
echo [Bước 5] Kiểm tra geometry (tọa độ) có hợp lệ không...
psql -h %HOST% -p %PORT% -U %USR% -d %DB% -c "
SELECT 
  'accidents có geom'     AS kiem_tra, COUNT(*) AS so_luong FROM accidents WHERE geom IS NOT NULL
UNION ALL SELECT 
  'traffic_signs có geom', COUNT(*) FROM traffic_signs WHERE geom IS NOT NULL
UNION ALL SELECT 
  'roads có geom',         COUNT(*) FROM roads WHERE geom IS NOT NULL;
" 2>&1

echo.
echo ══════════════════════════════════════════════════════════
echo.
echo ✅ XONG! Bây giờ hãy:
echo    1. Chạy:  backend\start_backend.bat
echo    2. Chạy:  npm run dev
echo    3. Mở:    http://localhost:5173
echo.
echo Nếu thấy số lượng records = 0 ở bảng nào, hãy kiểm tra lại data.backup
echo.
pause
