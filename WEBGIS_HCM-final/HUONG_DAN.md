# WebGIS HCM — Hướng dẫn cài đặt & chạy (v3.0)

## Yêu cầu
- Python 3.9+  |  Node.js 18+
- PostgreSQL 18 + extension **PostGIS** + **pgRouting**
- Database: `nckh_hcm` (restore từ file `data.backup`)

---

## BƯỚC 1 — Restore database PostgreSQL

Mở **pgAdmin** hoặc **cmd/terminal**, chạy:

```bash
# Tạo database (nếu chưa có)
psql -U postgres -c "CREATE DATABASE nckh_hcm;"

# Restore từ file backup (cùng thư mục với file này)
pg_restore -U postgres -d nckh_hcm data.backup
```

> Password PostgreSQL: **123456**
> User PostgreSQL: **postgres**

Sau khi restore xong sẽ có các bảng:
- `roads` — tuyến đường + geometry
- `accidents` — dữ liệu tai nạn
- `traffic_conditions` — tình trạng kẹt xe
- `road_features` — đặc điểm mặt đường
- `traffic_signs` — biển báo
- `routing_weights` — trọng số tìm đường
- `wards` — phường/xã
- `roads_vertices_pgr` — đồ thị routing

---

## BƯỚC 2 — Khởi động Backend Flask

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Hoặc **double-click** `backend/start_backend.bat` (Windows).

Kiểm tra: mở trình duyệt → http://localhost:5000/api/health

Response OK:
```json
{"status":"ok","db":"nckh_hcm","roads":...,"accidents":...}
```

---

## BƯỚC 3 — Khởi động Frontend React

```bash
npm install
npm run dev
```

Mở: **http://localhost:5173**

---

## Cấu hình DB (nếu cần đổi)

Trong file `backend/app.py`, tìm `DB_CONFIG`:
```python
DB_CONFIG = {
    'host':     'localhost',
    'port':     5432,
    'dbname':   'nckh_hcm',
    'user':     'postgres',
    'password': '123456',
}
```

---

## Cấu trúc API

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/health` | GET | Kiểm tra kết nối DB |
| `/api/search?q=...` | GET | Tìm kiếm địa điểm |
| `/api/route` | POST | Tìm đường Dijkstra (pgRouting) |
| `/api/road-info` | POST | Click đường → lấy thông tin tuyến |
| `/api/accidents` | GET | Dữ liệu điểm tai nạn |
| `/api/traffic?hour=8` | GET | Mật độ giao thông theo giờ |

---

## Sử dụng chức năng Xem thông tin đường

1. Nhấn nút **"🗺️ Xem thông tin tuyến đường"** (dưới sidebar)
   hoặc click tab **"🗺️ Thông tin đường"** phía trên bản đồ
2. Click **bất kỳ vị trí nào** trên bản đồ
3. Panel bên phải hiện ra với thông tin đầy đủ, chia nhóm:
   - 🔴 **Tai nạn giao thông** — tần suất, loại, mức độ, khung giờ
   - 🟡 **Tình trạng giao thông** — kẹt xe, mật độ, phương tiện chủ yếu
   - 🔵 **Cơ sở hạ tầng** — địa hình, làn đường, tốc độ, chiều rộng
   - 🟢 **Môi trường đường** — ánh sáng, ngập, ổ gà, giao lộ
   - 🟣 **Biển báo** — loại biển, phương tiện áp dụng
4. Nhấn **"← Quay lại tìm đường"** để thoát

---

## Thuật toán road-info (tìm đường gần điểm click)

1. `ST_DWithin()` bán kính tự tăng: 100m → 200m → 500m → 1km → 2km
2. Lấy `road_name` của đoạn gần nhất
3. Tìm tất cả `road_id` cùng tên (cùng tuyến)
4. JOIN đủ 5 bảng: `accidents`, `traffic_conditions`, `road_features`, `traffic_signs`, `wards`
5. Convert toàn bộ mã số → tiếng Việt
