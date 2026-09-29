# 🗺️ WebGIS HCM — Hướng Dẫn Fix Lỗi Kết Nối Database

## ❌ Lỗi: "Chưa kết nối được với database" khi click đường

Đây là lỗi **backend Flask chưa kết nối được PostgreSQL**. Làm theo các bước sau:

---

## Bước 1: Kiểm tra PostgreSQL có đang chạy không

M�� **CMD** hoặc **PowerShell**, gõ:
```
pg_isready -h localhost -p 5432
```

✅ Nếu thấy `localhost:5432 - accepting connections` → PostgreSQL OK  
❌ Nếu thấy `no response` → PostgreSQL chưa chạy

**Cách bật PostgreSQL:**
1. Nhấn `Win + R`, gõ `services.msc`, Enter
2. Tìm dòng `postgresql-x64-xx` (xx là version của bạn)
3. Click chuột phải → **Start**

---

## Bước 2: Kiểm tra database `nckh_hcm` đã tồn tại chưa

```
psql -U postgres -c "\l"
```
Nhập password `123456` nếu được hỏi.

✅ Nếu thấy `nckh_hcm` trong danh sách → OK  
❌ Nếu không có → cần restore:

**Restore database từ file data.backup:**
```
# Cách 1: Tạo mới database rồi restore vào
createdb -U postgres nckh_hcm
pg_restore -U postgres -d nckh_hcm -F c "đường_dẫn\data.backup"

# Cách 2: Restore kèm tạo DB
pg_restore -U postgres -d postgres --create -F c "đường_dẫn\data.backup"
```

---

## Bước 3: Kiểm tra password

Trong file `backend/app.py`, đảm bảo:
```python
DB_CONFIG = {
    'host':     'localhost',
    'port':     5432,
    'dbname':   'nckh_hcm',
    'user':     'postgres',
    'password': '123456',   # ← password của bạn
}
```

Nếu password khác `123456`, sửa lại cho đúng.

---

## Bước 4: Khởi động Backend

```
cd backend
python app.py
```

Hoặc double-click `start_backend.bat`

M�� trình duyệt vào: `http://localhost:5000/api/health`  
✅ Nếu thấy JSON với `"status": "ok"` → Backend OK

---

## Bước 5: Khởi động Frontend

```
npm install
npm run dev
```

M�� `http://localhost:5173`

---

## 🎯 Các tính năng trong bản này

### Click đường → Thông tin tuyến đường
- Chọn mode **"Xem thông tin đường"** (nút ở Sidebar)
- Click vào bất kỳ điểm nào trên đường → hiện popup với đầy đủ thông tin:
  - Tên đường, phường/xã, chiều dài, số làn, chiều lưu thông
  - Thông tin tai nạn, kẹt xe, biển báo trên đường đó

### Điểm tai nạn (màu ĐEN)
- Bật layer **"Tai nạn"** ở Sidebar
- Điểm đen to/nhỏ tùy theo mức độ nghiêm trọng
- Click vào điểm → hiện popup: tên đường, tần suất, loại tai nạn, khung giờ

### Điểm biển báo (màu VÀNG)
- Bật layer **"Biển báo"**
- Click → hiện loại biển, phương tiện áp dụng

### Lớp kẹt xe (sơn màu đỏ-cam)
- Bật layer **"Kẹt xe"**
- Các vùng kẹt xe hiện dạng blob màu cam→đỏ, càng kẹt càng đỏ đậm
- Click vào vùng → hiện mật độ và tốc độ trung bình
