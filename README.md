<div align="center">

# WebGIS HCM — RouteIQ

### Bản đồ thông minh tìm đường và phân tích giao thông TP. Hồ Chí Minh

Dự án hỗ trợ tìm đường tối ưu theo quãng đường, thời gian, tình trạng kẹt xe, tai nạn và hạ tầng. Hệ thống cho phép so sánh thuật toán Dijkstra và A*, đồng thời hỗ trợ tra cứu thông tin từng tuyến đường trực tiếp trên bản đồ.

</div>

---

## 1. Giới thiệu

**WebGIS HCM (RouteIQ)** là ứng dụng bản đồ web dành cho TP. Hồ Chí Minh, được xây dựng dựa trên việc kết hợp dữ liệu không gian (PostGIS) và thuật toán đồ thị (pgRouting). Ứng dụng cung cấp các khả năng:

- Tìm kiếm tuyến đường đi tối ưu không chỉ dựa trên tiêu chí khoảng cách ngắn nhất mà còn đánh giá các yếu tố như kẹt xe, tai nạn và chất lượng cơ sở hạ tầng.
- Quan sát các lớp dữ liệu giao thông thực tế bao gồm: tuyến đường, tình trạng kẹt xe theo khung giờ, các điểm tai nạn và hệ thống biển báo.
- Tra cứu hồ sơ chi tiết của tuyến đường gần nhất thông qua thao tác tương tác trực tiếp trên bản đồ.

Dự án phù hợp để ứng dụng trong công tác nghiên cứu khoa học (NCKH), thực hiện đồ án chuyên ngành GIS và làm nền tảng phát triển cho các hệ thống dẫn đường thông minh.

---

## 2. Tính năng nổi bật

### 2.1. Tìm đường đa tiêu chí

Hệ thống cung cấp các phương án định tuyến theo nhiều tiêu chí khác nhau:

| Tiêu chí | Mô tả | Trọng số tai nạn (`aw`) | Trọng số kẹt xe (`tw`) |
|---|---|:---:|:---:|
| Đường ngắn nhất | Tối thiểu hóa khoảng cách di chuyển. | 0.0 | 0.0 |
| Thời gian nhanh nhất | Ưu tiên tránh các đoạn đường di chuyển chậm. | 0.0 | 1.5 |
| Ít kẹt xe nhất | Tránh khu vực có mật độ giao thông cao theo từng khung giờ. | 0.0 | 2.5 |
| Ít tai nạn nhất | Hạn chế tuyến đường đi qua các điểm đen tai nạn. | 3.0 | 0.5 |
| Cơ sở hạ tầng | Cân bằng giữa yếu tố rủi ro tai nạn và tình trạng kẹt xe. | 0.5 | 0.5 |

Ứng dụng hỗ trợ tối ưu hóa cho 4 loại phương tiện:

| Phương tiện | Tốc độ trung bình | Tốc độ tối đa |
|---|:---:|:---:|
| Xe máy | 28 km/h | 60 km/h |
| Ô tô | 32 km/h | 80 km/h |
| Đi bộ | 5 km/h | 8 km/h |
| Xe buýt | 18 km/h | 40 km/h |

### 2.2. So sánh thuật toán Dijkstra và A*

Hệ thống backend thực thi đồng thời cả hai thuật toán trên cùng một bảng chi phí (cost):

- Nếu độ chênh lệch quãng đường ≤ 2% và tỉ lệ đoạn đường trùng lặp ≥ 80%, hệ thống sẽ trả về một tuyến đường duy nhất.
- Nếu vượt qua ngưỡng trên, hệ thống sẽ hiển thị hai tuyến đường riêng biệt (tuyến của thuật toán Dijkstra và tuyến của A*) để người dùng có thể tự do lựa chọn.

### 2.3. Tra cứu thông tin tuyến đường

Người dùng có thể kích hoạt chế độ thông tin và chọn vị trí bất kỳ trên bản đồ để tra cứu dữ liệu, được phân loại theo các nhóm:

| Nhóm thông tin | Nội dung chi tiết |
|---|---|
| Tai nạn giao thông | Tần suất, loại va chạm, mức độ nghiêm trọng, khung giờ xảy ra. |
| Tình trạng giao thông | Mức độ ùn tắc, khung giờ kẹt xe, tốc độ lưu thông tối thiểu/tối đa. |
| Cơ sở hạ tầng | Địa hình, số làn xe, chiều lưu thông, chiều rộng mặt đường. |
| Môi trường đường | Hệ thống chiếu sáng, tình trạng ngập, ổ gà, giao lộ. |
| Biển báo | Phân loại biển báo, phương tiện áp dụng quy định. |

Các mã định danh trong cơ sở dữ liệu sẽ được hệ thống tự động biên dịch sang định dạng ngôn ngữ tự nhiên (ví dụ: `terrain = 5` được hiển thị là "Đường cao tốc").

### 2.4. Trải nghiệm dẫn đường

- Hỗ trợ tính năng gợi ý (autocomplete) địa điểm tìm kiếm, tích hợp cơ sở dữ liệu nội bộ và Nominatim (hỗ trợ nhập liệu không dấu).
- Lựa chọn tọa độ điểm thông qua thao tác nhấp chuột trên bản đồ, kéo thả điểm đánh dấu (marker) hoặc sử dụng định vị vị trí GPS.
- Cung cấp hướng dẫn di chuyển theo từng bước (step-by-step).
- Cập nhật thời gian thực qua GPS để hiển thị quãng đường và thời gian còn lại.
- Phát cảnh báo khi người dùng tiến vào bán kính 1 km quanh các điểm đen tai nạn.

---

## 3. Công nghệ sử dụng

| Tầng hệ thống | Công nghệ ứng dụng | Phiên bản |
|---|---|---|
| Frontend | React, ReactDOM | ^18.3.1 |
| Bản đồ | Leaflet | ^1.9.4 |
| Build tool | Vite, `@vitejs/plugin-react` | ^5.4.0, ^4.3.1 |
| Backend | Flask, Flask-CORS | 3.0.3, 4.0.1 |
| DB driver | psycopg2-binary | 2.9.10 |
| HTTP client | requests | 2.31.0 |
| WSGI server | gunicorn | 23.0.0 |
| Cơ sở dữ liệu | PostgreSQL kết hợp PostGIS và pgRouting | PostgreSQL 18 (khuyến nghị) |
| Dịch vụ bên thứ ba | OpenStreetMap tiles, Nominatim, OSRM | — |

---

## 4. Cấu trúc thư mục dự án

```text
GIS_WEB_HCM/
├── README.md                             
├── WEBGIS_HCM-final/                     
    ├── index.html                        
    ├── package.json                      
    ├── vite.config.js                    
    ├── KIEM_TRA_DATABASE.bat             
    ├── HUONG_DAN.md                      
    ├── HUONG_DAN_FIX.md                  
    ├── backend/                          
    │   ├── app.py                        
    │   ├── kiem_tra_db.py                
    │   ├── start_backend.bat             
    │   ├── requirements.txt              
    │   └── env.example                   
    └── src/                              
        ├── main.jsx                      
        ├── App.jsx                       
        ├── config.js                     
        ├── styles.css                    
        ├── components/                   
        ├── services/                     
        ├── hooks/                        
        ├── utils/                        
        └── data/                         
```

**Vai trò của các thành phần chính:**
- **`backend/`**: Xử lý kết nối cơ sở dữ liệu, thực thi các truy vấn không gian, tính toán tuyến đường và chuẩn hóa dữ liệu trả về.
- **`src/components/`**: Quản lý giao diện người dùng và các tương tác trực tiếp với bản đồ.
- **`src/services/`**: Chịu trách nhiệm thực hiện toàn bộ các lời gọi mạng tới API.
- **`src/utils/`**: Cung cấp các hàm tiện ích như thuật toán tìm kiếm và xử lý hằng số.
- **`src/data/`**: Lưu trữ bản sao dữ liệu tĩnh làm phương án dự phòng khi máy chủ backend gặp sự cố kết nối.

---

## 5. Cơ sở dữ liệu

- **Tên cơ sở dữ liệu:** `nckh_hcm`
- **Yêu cầu extension:** `postgis`, `pgrouting`
- Cơ sở dữ liệu được khôi phục từ tệp `data.backup` thông qua lệnh `pg_dump`.

### Bảng dữ liệu chính

| Bảng dữ liệu | Chức năng |
|---|---|
| `roads` | Quản lý thông tin đoạn đường và đồ thị định tuyến. |
| `accidents` | Lưu trữ dữ liệu về các điểm tai nạn giao thông. |
| `traffic_conditions` | Theo dõi tình trạng kẹt xe theo các khung giờ. |
| `road_features` | Ghi nhận đặc điểm vật lý của mặt đường. |
| `traffic_signs` | Quản lý hệ thống biển báo giao thông. |
| `routing_weights` | Cấu hình trọng số phục vụ định tuyến. |
| `wards` | Dữ liệu ranh giới phường/xã. |
| `roads_vertices_pgr` | Các nút thuộc đồ thị pgRouting. |

---

## 6. Thuật toán tìm đường

Quá trình tìm kiếm tuyến đường được thực hiện qua các bước kỹ thuật sau:
1. **Xác định nút gần nhất:** Điểm xuất phát và điểm đến được ánh xạ vào nút đồ thị gần nhất bằng toán tử khoảng cách KNN của PostGIS (`geom <-> point`) trên bảng `roads_vertices_pgr`.
2. **Tính toán chi phí cạnh:** Chi phí được tính toán linh hoạt theo công thức kết hợp giữa khoảng cách, trọng số tai nạn và mức độ ùn tắc dựa theo khung giờ (slot) cụ thể.
3. **Ước tính thời gian:** Hệ thống dựa vào vận tốc trung bình của phương tiện để tính toán thời gian di chuyển dự kiến.

---

## 7. Tài liệu API

URL mặc định tại môi trường phát triển (Local): `http://localhost:5000`

- `GET /api/health`: Kiểm tra trạng thái hoạt động của cơ sở dữ liệu.
- `GET /api/db-status`: Báo cáo số lượng bản ghi và trạng thái hợp lệ của dữ liệu không gian (geometry).
- `GET /api/search`: Chức năng tìm kiếm địa điểm.
- `POST /api/route`: Yêu cầu tìm kiếm tuyến đường thông qua thuật toán Dijkstra.
- `POST /api/route-compare`: Thực thi đồng thời Dijkstra và A* để tiến hành so sánh.
- `POST /api/road-info`: Trích xuất thông tin tuyến đường tại tọa độ được chỉ định.

---

## 8. Triển khai và Cài đặt

### Yêu cầu hệ thống
- Node.js ≥ 18
- Python ≥ 3.9
- PostgreSQL cài đặt kèm PostGIS và pgRouting

### Các bước khởi chạy cục bộ (Local)
1. **Khôi phục cơ sở dữ liệu:** Khởi tạo DB `nckh_hcm` và khôi phục dữ liệu từ tệp `data.backup` bằng công cụ `pg_restore`.
2. **Khởi chạy Backend:** Cài đặt thư viện Python trong thư mục `backend` qua `requirements.txt` và chạy tệp `app.py`.
3. **Khởi chạy Frontend:** Sử dụng npm để cài đặt dependencies và thực thi lệnh `npm run dev` để kích hoạt giao diện tại cổng 5173.

### Triển khai Production
- **Frontend:** Triển khai qua nền tảng Vercel.
- **Backend:** Cấu hình chạy gunicorn trên nền tảng Render.
- **Cơ sở dữ liệu:** Lưu trữ trên Supabase với cấu hình Session pooler.

---

## 9. Cơ chế dự phòng (Fallback)

Nhằm bảo đảm tính khả dụng cao nhất, hệ thống áp dụng cơ chế dự phòng nhiều cấp độ:
- Trong trường hợp backend mất kết nối, quy trình định tuyến sẽ tự động chuyển sang phân tích cục bộ bằng JavaScript kết hợp với OSRM, hoặc vẽ tuyến đường ước tính dựa trên tính toán khoảng cách nội bộ.
- Khi tính năng tìm kiếm địa danh qua cơ sở dữ liệu gặp lỗi, hệ thống sẽ sử dụng danh sách 30 địa danh nội bộ dự phòng.
- Dữ liệu hiển thị lớp (Layer) sẽ tự động lấy từ thư mục `src/data/` nếu truy vấn API thất bại toàn diện.