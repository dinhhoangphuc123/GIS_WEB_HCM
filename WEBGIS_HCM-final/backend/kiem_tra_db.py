#!/usr/bin/env python3
"""
Chạy script này để kiểm tra và chẩn đoán kết nối database.
Dùng: python kiem_tra_db.py
"""
import sys

try:
    import psycopg2
except ImportError:
    print(" Chưa cài psycopg2! Chạy: pip install psycopg2-binary")
    sys.exit(1)

DB_CONFIG = {
    'host':     'localhost',
    'port':     5432,
    'dbname':   'nckh_hcm',
    'user':     'postgres',
    'password': '123456',
}

print("=" * 60)
print("  WEBGIS HCM — Kiểm tra kết nối Database")
print("=" * 60)
print(f"  Host    : {DB_CONFIG['host']}:{DB_CONFIG['port']}")
print(f"  Database: {DB_CONFIG['dbname']}")
print(f"  User    : {DB_CONFIG['user']} / {DB_CONFIG['password']}")
print()

# Bước 1: Kết nối
print("[1] Kết nối PostgreSQL...")
try:
    conn = psycopg2.connect(**DB_CONFIG, connect_timeout=5)
    print("     Kết nối thành công!")
except psycopg2.OperationalError as e:
    err = str(e).strip()
    print(f"     THẤT BẠI: {err}")
    print()
    if "Connection refused" in err or "could not connect" in err.lower():
        print("     PostgreSQL chưa chạy. Cách bật:")
        print("       Win+R → services.msc → postgresql-x64-... → Start")
    elif "password" in err.lower() or "authentication" in err.lower():
        print("     Sai password. Sửa trong backend/app.py:")
        print("       'password': 'PASSWORD_THỰC_CỦA_BẠN'")
    elif "does not exist" in err.lower():
        print("     Database nckh_hcm chưa tồn tại. Restore bằng:")
        print("       pg_restore -U postgres -d postgres --create -F c data.backup")
    sys.exit(1)

cur = conn.cursor()

# Bước 2: Kiểm tra bảng và records
print()
print("[2] Số lượng records trong mỗi bảng:")
tables = [
    ('roads',             'Tuyến đường'),
    ('accidents',         'Điểm tai nạn'),
    ('traffic_signs',     'Biển báo'),
    ('traffic_conditions','Điều kiện giao thông'),
    ('road_features',     'Đặc điểm đường'),
    ('wards',             'Phường/Xã'),
    ('routing_weights',   'Trọng số định tuyến'),
]

all_ok = True
for tbl, name in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        cnt = cur.fetchone()[0]
        status = "" if cnt > 0 else "⚠️ "
        print(f"    {status} {name:25s}: {cnt:>5} records")
        if cnt == 0:
            all_ok = False
    except Exception as e:
        print(f"     {name:25s}: LỖI - {e}")
        all_ok = False

# Bước 3: Kiểm tra geometry
print()
print("[3] Kiểm tra tọa độ geometry:")
geom_checks = [
    ('accidents',     'Điểm tai nạn có tọa độ'),
    ('traffic_signs', 'Biển báo có tọa độ'),
    ('roads',         'Đường có tọa độ'),
]
for tbl, name in geom_checks:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE geom IS NOT NULL")
        cnt = cur.fetchone()[0]
        status = " " if cnt > 0 else "❌"
        print(f"    {status} {name:30s}: {cnt:>5}")
    except Exception as e:
        print(f"     {name}: {e}")

# Bước 4: Sample data
print()
print("[4] Sample data — 3 điểm tai nạn đầu tiên:")
try:
    cur.execute("""
        SELECT a.accident_id, r.road_name, 
               ST_Y(a.geom) as lat, ST_X(a.geom) as lng,
               a.severity
        FROM accidents a
        LEFT JOIN roads r ON r.road_id = a.road_id
        WHERE a.geom IS NOT NULL
        LIMIT 3
    """)
    rows = cur.fetchall()
    if rows:
        for row in rows:
            print(f"    ID={row[0]} | {row[1]} | lat={row[2]:.4f}, lng={row[3]:.4f} | sev={row[4]}")
    else:
        print("      Không có dữ liệu tai nạn có tọa độ!")
except Exception as e:
    print(f"     {e}")

cur.close()
conn.close()

print()
print("=" * 60)
if all_ok:
    print("   DATABASE ĐẦY ĐỦ DỮ LIỆU — Có thể chạy backend!")
    print()
    print("  Chạy backend: python app.py")
    print("  Test API    : http://localhost:5000/api/health")
else:
    print("    MỘT SỐ BẢNG CHƯA CÓ DỮ LIỆU")
    print()
    print("  Restore database:")
    print("  pg_restore -U postgres -d nckh_hcm -F c --clean data.backup")
print("=" * 60)
