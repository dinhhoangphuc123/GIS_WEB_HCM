# backend/app.py  —  WebGIS HCM  v3.0
# Đã sửa đúng schema thực tế từ data.backup:
#
#  Bảng chính:
#    roads(road_id, ward_id, road_name, geom, length_m, road_width,
#          lane_count, direction, terrain, road_condition, lighting,
#          flooding_level, main_vehicle[], source, target, length, cost)
#    accidents(accident_id, road_id, accident_frequency, accident_type[],
#              severity, time_window[], geom)
#    traffic_conditions(traffic_id, road_id, traffic_time_window[],
#                       congestion_level[], speed_min, speed_max)
#    road_features(feature_id, road_id, potholes, many_intersections,
#                  near_intersection, surface_condition)
#    traffic_signs(sign_id, road_id, sign_type[], applicable_vehicle[], geom)
#    routing_weights(weight_id, road_id, accident_weight, congestion_weight,
#                    flooding_weight, sign_penalty, total_cost)
#    wards(ward_id, ward_name, geom)
#    roads_vertices_pgr(id, geom)
#
# Endpoints:
#   GET  /api/health
#   GET  /api/search?q=...
#   POST /api/route
#   POST /api/road-info    ← click đường lấy thông tin đầy đủ
#   GET  /api/accidents
#   GET  /api/traffic

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2, psycopg2.extras
import math, os, json, traceback, datetime
import requests as req_lib

app = Flask(__name__)
# ALLOWED_ORIGINS: các domain frontend, cách nhau bằng dấu phẩy (vd https://webgis-hcm.vercel.app).
# Không đặt → cho phép tất cả (tiện khi chạy local).
CORS(app, origins=[o.strip() for o in os.getenv('ALLOWED_ORIGINS', '*').split(',') if o.strip()])

# ─── Kết nối DB ───────────────────────────────────────────────────────────────
DB_CONFIG = {
    'host':     os.getenv('DB_HOST',     'localhost'),
    'port':     int(os.getenv('DB_PORT', '5432')),
    'dbname':   os.getenv('DB_NAME',     'nckh_hcm'),
    'user':     os.getenv('DB_USER',     'postgres'),   # user: postgres
    'password': os.getenv('DB_PASS',     '123456'),     # pass: 123456
}

# DATABASE_URL: chuỗi kết nối đầy đủ (Supabase → dùng Session pooler, cổng 5432).
DATABASE_URL = os.getenv('DATABASE_URL')

def get_db():
    cfg = dict(DB_CONFIG)
    cfg['connect_timeout'] = 5
    try:
        if DATABASE_URL:
            return psycopg2.connect(DATABASE_URL, connect_timeout=5)
        return psycopg2.connect(**cfg)
    except psycopg2.OperationalError as e:
        raise ConnectionError(
            f"Không kết nối được PostgreSQL. "
            f"Hãy kiểm tra: 1) PostgreSQL đang chạy? 2) DB đã tồn tại? "
            f"3) DATABASE_URL (hoặc DB_USER/DB_PASS) đúng chưa? | Chi tiết: {e}"
        ) from e

# ─── Bảng convert số → chữ ───────────────────────────────────────────────────
CONVERT_MAP = {
    'accident_frequency':  {None:'0 – 1 vụ tai nạn', 0:'0 – 1 vụ tai nạn',
                            1:'0 – 1 vụ tai nạn', 2:'2 – 3 vụ tai nạn', 3:'Trên 3 vụ tai nạn'},
    'accident_type':       {1:'Xe máy - Xe máy', 2:'Xe máy - Ô tô', 3:'Ô tô - Ô tô'},
    'time_window':         {1:'Buổi sáng', 2:'Buổi trưa', 3:'Buổi chiều', 4:'Buổi tối'},
    'traffic_time_window': {1:'Kẹt xe buổi sáng', 2:'Kẹt xe buổi trưa',
                            3:'Kẹt xe buổi chiều', 4:'Kẹt xe buổi tối', 5:'Không kẹt xe'},
    'severity':            {1:'Nhẹ', 2:'Trung bình', 3:'Nặng'},
    'congestion_level':    {1:'Nhẹ', 2:'Trung bình', 3:'Nặng'},
    'main_vehicle':        {1:'Xe máy', 2:'Ô tô', 3:'Xe buýt'},
    'surface_condition':   {1:'Bình thường'},
    'road_condition':      {1:'Bình thường', 2:' Khó đi'},
    'terrain':             {1:'Đường phẳng', 2:'Đường dốc nhẹ', 3:'Đường phố đi bộ',
                            4:'Đường kênh rạch', 5:'Đường cao tốc',
                            6:'Đường khu chợ / TTTM', 7:'Đường ngập lụt',
                            8:'Đường công trình xây dựng', 9:'Đường đang xây dựng lại'},
    'lane_count':          {1:'1 làn', 2:'2 làn', 3:'3 làn', 4:'4 làn',
                            5:'5 làn', 6:'6 làn', 7:'7 làn', 8:'8 làn'},
    'direction':           {1:'1 chiều', 2:'2 chiều'},
    'lighting':            {1:'Có đèn đường', 2:'Không có đèn đường'},
    'flooding_level':      {1:'Không ngập', 2:'Ngập thấp', 3:'Ngập trung bình', 4:'Ngập cao'},
    'potholes':            {1:'Có ổ gà', 2:'Không có ổ gà'},
    'many_intersections':  {1:'Dưới 2 giao lộ', 2:'Trên 2 giao lộ'},
    'near_intersection':   {1:'Gần ngã tư', 2:'Không gần ngã tư'},
    'sign_type':           {1:'Biển tốc độ', 2:'Biển báo nguy hiểm', 3:'Biển cấm',
                            4:'Biển hiệu lệnh', 5:'Biển chỉ dẫn', 6:'Biển phụ', 7:'Biển 1 chiều'},
    'applicable_vehicle':  {1:'Xe máy', 2:'Moto', 3:'Ô tô', 4:'Xe tải'},
}

NUMERIC_COLS = {'speed_min', 'speed_max', 'length_m', 'road_width'}

FIELD_LABELS = {
    'road_name':'Tên đường', 'ward_name':'Phường / Xã',
    'accident_frequency':'Tần suất tai nạn', 'accident_type':'Loại tai nạn',
    'time_window':'Khung giờ xảy ra tai nạn', 'traffic_time_window':'Khung giờ kẹt xe',
    'severity':'Mức độ nghiêm trọng', 'congestion_level':'Mức độ ùn tắc',
    'main_vehicle':'Phương tiện chủ yếu', 'surface_condition':'Tình trạng mặt đường',
    'road_condition':'Điều kiện đường', 'terrain':'Địa hình',
    'lane_count':'Số làn đường', 'direction':'Chiều lưu thông',
    'lighting':'Ánh sáng', 'flooding_level':'Mức độ ngập',
    'potholes':'Ổ gà', 'many_intersections':'Số giao lộ',
    'near_intersection':'Gần ngã tư', 'sign_type':'Loại biển báo',
    'applicable_vehicle':'Phương tiện áp dụng',
    'speed_min':'Tốc độ tối thiểu (km/h)', 'speed_max':'Tốc độ tối đa (km/h)',
    'length_m':'Chiều dài đoạn (m)', 'road_width':'Chiều rộng (m)',
}

def _cvt(field, value):
    """Convert 1 giá trị số → chữ."""
    if value is None: return None
    if field in NUMERIC_COLS: return value
    m = CONVERT_MAP.get(field)
    if not m: return value
    if isinstance(value, list):
        parts = [m.get(v, str(v)) for v in value if v is not None]
        return ', '.join(parts) if parts else None
    return m.get(value, str(value))

def convert_display(row_dict):
    """Chuyển dict DB → dict hiển thị tiếng Việt (bỏ None, bỏ id)."""
    skip = {'road_id','ward_id','feature_id','traffic_id','sign_id','weight_id'}
    out = {}
    for field, value in row_dict.items():
        if field in skip or value is None: continue
        label = FIELD_LABELS.get(field, field)
        cvt   = _cvt(field, value)
        if cvt is not None:
            out[label] = cvt
    return out

# ─── Routing helpers ──────────────────────────────────────────────────────────
VEHICLE_SPEEDS = {
    'motorbike':{'avg':28,'max':60}, 'car':{'avg':32,'max':80},
    'walk':{'avg':5,'max':8},        'bus':{'avg':18,'max':40},
}
CRITERIA_CFG = {
    'shortest':      {'aw':0.0, 'tw':0.0},
    'fastest':       {'aw':0.0, 'tw':1.5},
    'traffic':       {'aw':0.0, 'tw':2.5},
    'safety':        {'aw':3.0, 'tw':0.5},
    'infrastructure':{'aw':0.5, 'tw':0.5},
}

def time_slot(hour):
    if 6<=hour<9:  return 0
    if 9<=hour<15: return 1
    if 15<=hour<19:return 2
    if 19<=hour<24:return 3
    return 4

def nearest_node(cur, lat, lng):
    cur.execute("""
        SELECT id FROM roads_vertices_pgr
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s,%s),4326) LIMIT 1
    """, (lng, lat))
    r = cur.fetchone()
    return r[0] if r else None

def build_cost_sql(criteria, slot):
    """
    Trả về SQL string để nhúng INLINE vào pgr_dijkstra / pgr_aStar.
    KHÔNG dùng TEMP TABLE vì pgRouting chạy SQL trong executor riêng,
    không nhìn thấy TEMP TABLE của session ngoài → luôn báo lỗi 'relation _dc does not exist'.
    Dùng dollar-quoting riêng biệt ($ / $) để tránh xung đột dấu nháy đơn.
    """
    cfg = CRITERIA_CFG.get(criteria, CRITERIA_CFG['shortest'])
    aw, tw = cfg['aw'], cfg['tw']
    idx = slot + 1
    return f"""
        SELECT r.road_id AS id, r.source, r.target,
          GREATEST(0.001,
            r.length_m
            + COALESCE(rw.accident_weight, 0) * {aw}
            + CASE WHEN tc.congestion_level IS NOT NULL
                        AND array_length(tc.congestion_level, 1) >= {idx}
                        AND tc.congestion_level[{idx}] IS NOT NULL
                   THEN tc.congestion_level[{idx}] * r.length_m * {tw} * 0.01
                   ELSE 0 END
          ) AS cost,
          GREATEST(0.001,
            r.length_m
            + COALESCE(rw.accident_weight, 0) * {aw}
            + CASE WHEN tc.congestion_level IS NOT NULL
                        AND array_length(tc.congestion_level, 1) >= {idx}
                        AND tc.congestion_level[{idx}] IS NOT NULL
                   THEN tc.congestion_level[{idx}] * r.length_m * {tw} * 0.01
                   ELSE 0 END
          ) AS reverse_cost
        FROM roads r
        LEFT JOIN routing_weights rw ON rw.road_id = r.road_id
        LEFT JOIN traffic_conditions tc ON tc.road_id = r.road_id
        WHERE r.source IS NOT NULL AND r.target IS NOT NULL
    """

# ─── /api/health ──────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM roads");             rc = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM roads_vertices_pgr");nc = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM accidents");         ac = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM traffic_conditions");tc = cur.fetchone()[0]
        cur.close(); conn.close()
        return jsonify({'status':'ok','db':DB_CONFIG['dbname'],
                        'roads':rc,'nodes':nc,'accidents':ac,'traffic':tc})
    except Exception as e:
        return jsonify({'status':'error','message':str(e)}), 500

# ─── /api/search ──────────────────────────────────────────────────────────────
@app.route('/api/search')
def search():
    q = request.args.get('q','').strip()
    limit = min(int(request.args.get('limit',6)), 10)
    if not q or len(q)<2: return jsonify([])
    results = []
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT DISTINCT road_name AS name,
                   ST_Y(ST_Centroid(geom)) AS lat,
                   ST_X(ST_Centroid(geom)) AS lng,
                   w.ward_name AS sub
            FROM roads r
            LEFT JOIN wards w ON w.ward_id = r.ward_id
            WHERE road_name ILIKE %s AND geom IS NOT NULL
            ORDER BY road_name LIMIT %s
        """, (f'%{q}%', limit))
        for i,row in enumerate(cur.fetchall()):
            results.append({'id':f'db_{i}','name':row['name'] or '?',
                            'sub':row['sub'] or 'TP.HCM',
                            'lat':float(row['lat']),'lng':float(row['lng']),'source':'db'})
        cur.close(); conn.close()
    except Exception as e:
        print(f"[search DB] {e}")
    # Fallback Nominatim
    if len(results) < 3:
        try:
            r = req_lib.get(
                f"https://nominatim.openstreetmap.org/search"
                f"?q={q},+Ho+Chi+Minh+City&format=json&limit={limit}&countrycodes=vn",
                timeout=5, headers={'User-Agent':'WebGIS-HCM/1.0'})
            if r.ok:
                for p in r.json():
                    results.append({'id':f'osm_{p["place_id"]}',
                                    'name':p.get('display_name','').split(',')[0],
                                    'sub':'TP.HCM','lat':float(p['lat']),'lng':float(p['lon']),
                                    'source':'nominatim'})
        except: pass
    return jsonify(results[:limit])

# ─── /api/route ───────────────────────────────────────────────────────────────
@app.route('/api/route', methods=['POST'])
def find_route():
    body     = request.get_json(silent=True) or {}
    fp       = body.get('from', {})
    tp       = body.get('to',   {})
    vehicle  = body.get('vehicle',  'motorbike')
    criteria = body.get('criteria', 'shortest')
    hour     = int(body.get('hour', 8))

    if not fp.get('lat') or not tp.get('lat'):
        return jsonify({'error':'Thiếu tọa độ'}), 400
    try:
        conn = get_db(); cur = conn.cursor()
        sn = nearest_node(cur, fp['lat'], fp['lng'])
        dn = nearest_node(cur, tp['lat'], tp['lng'])
        if not sn or not dn:
            conn.close(); return jsonify({'error':'Không tìm thấy node'}), 404

        slot = time_slot(hour)
        rows = _run_dijkstra(cur, criteria, slot, sn, dn)
        conn.commit(); cur.close(); conn.close()

        if not rows: return jsonify({'error':'Không tìm thấy đường đi'}), 404
        result = _build_route_result(None, rows, vehicle)
        if not result: return jsonify({'error':'Không có tọa độ'}), 404

        return jsonify({**result, 'isMock':False, 'source':'dijkstra', 'criteria':criteria, 'vehicle':vehicle})
    except Exception as e:
        traceback.print_exc(); return jsonify({'error':f'Lỗi: {e}'}), 500

# ─── Shared route builder helper ─────────────────────────────────────────────
def _build_route_result(cur, rows, vehicle):
    """Từ rows pgr_* → dict kết quả chuẩn."""
    coords = []; names = []; total = 0.0
    for row in rows:
        if row[2]:
            g = json.loads(row[2])
            if g['type'] == 'LineString':
                for c in g['coordinates']:
                    coords.append([c[1], c[0]])
        total += row[3] or 0
        if row[1] and row[1] not in names:
            names.append(row[1])
    if not coords:
        return None
    steps = [{'dir':'start','label':'Xuất phát','name':names[0] if names else '?','dist':0}]
    for n in names[1:]:
        steps.append({'dir':'turnRight','label':'Đi theo','name':n,'dist':0})
    steps.append({'dir':'dest','label':'Đến nơi','name':names[-1] if names else '?','dist':0})
    spd = VEHICLE_SPEEDS.get(vehicle, VEHICLE_SPEEDS['motorbike'])
    return {
        'distanceM':  round(total, 1),
        'durationS':  round((total / 1000) / spd['avg'] * 3600, 1),
        'speedKmh':   spd['avg'],
        'coordinates': coords,
        'steps':       steps,
        'roadNames':   names,
        'isMock':      False,
    }

def _run_dijkstra(cur, criteria, slot, sn, dn):
    """
    Chạy pgr_dijkstra với cost SQL inline (dollar-quoting $dijkstra$).
    Không dùng TEMP TABLE vì pgRouting không nhìn thấy TEMP TABLE từ session ngoài.
    """
    cost_sql = build_cost_sql(criteria, slot)
    cur.execute(f"""
        SELECT di.seq, r.road_name,
               ST_AsGeoJSON(r.geom) AS gj,
               r.length_m
        FROM pgr_dijkstra(
            $dijkstra${cost_sql}$dijkstra$,
            %s, %s, directed:=false
        ) di
        LEFT JOIN roads r ON r.road_id = di.edge
        ORDER BY di.seq
    """, (sn, dn))
    return cur.fetchall()

def _run_astar(cur, criteria, slot, sn, dn):
    """
    Chạy pgr_aStar với cost SQL inline + JOIN roads_vertices_pgr để lấy x1,y1,x2,y2.
    - Dùng tag $astar$ (khác $dijkstra$) để tránh nested dollar-quoting conflict.
    - Tách astar_inner ra biến f-string riêng trước khi nhúng vào SQL chính.
    """
    cost_sql = build_cost_sql(criteria, slot)
    astar_inner = f"""
        SELECT dc.id, dc.source, dc.target, dc.cost, dc.reverse_cost,
               ST_X(vs.geom) AS x1, ST_Y(vs.geom) AS y1,
               ST_X(vt.geom) AS x2, ST_Y(vt.geom) AS y2
        FROM ({cost_sql}) dc
        JOIN roads_vertices_pgr vs ON vs.id = dc.source
        JOIN roads_vertices_pgr vt ON vt.id = dc.target
    """
    cur.execute(f"""
        SELECT ast.seq, r.road_name,
               ST_AsGeoJSON(r.geom) AS gj,
               r.length_m
        FROM pgr_aStar(
            $astar${astar_inner}$astar$,
            %s, %s, directed:=false
        ) ast
        LEFT JOIN roads r ON r.road_id = ast.edge
        ORDER BY ast.seq
    """, (sn, dn))
    return cur.fetchall()

# ─── /api/route-compare ───────────────────────────────────────────────────────
@app.route('/api/route-compare', methods=['POST'])
def compare_routes():
    """
    Chạy đồng thời Dijkstra và A*, so sánh kết quả.
    Trả về:
      same: true  → chỉ trả 1 route (dijkstra)
      same: false → trả cả hai để frontend cho người dùng chọn
    """
    body     = request.get_json(silent=True) or {}
    fp       = body.get('from', {})
    tp       = body.get('to',   {})
    vehicle  = body.get('vehicle',  'motorbike')
    criteria = body.get('criteria', 'shortest')
    hour     = int(body.get('hour', 8))

    if not fp.get('lat') or not tp.get('lat'):
        return jsonify({'error': 'Thiếu tọa độ'}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()
        sn = nearest_node(cur, fp['lat'], fp['lng'])
        dn = nearest_node(cur, tp['lat'], tp['lng'])
        if not sn or not dn:
            conn.close()
            return jsonify({'error': 'Không tìm thấy node'}), 404

        slot = time_slot(hour)

        # ── Dijkstra ──────────────────────────────────────────────────────────
        dijk_rows  = _run_dijkstra(cur, criteria, slot, sn, dn)
        dijk_route = _build_route_result(cur, dijk_rows, vehicle)

        # ── A* ────────────────────────────────────────────────────────────────
        astar_route = None
        astar_error = None
        try:
            astar_rows  = _run_astar(cur, criteria, slot, sn, dn)
            astar_route = _build_route_result(cur, astar_rows, vehicle)
        except Exception as e:
            astar_error = str(e)
            print(f"[A*] {e}")

        conn.commit(); cur.close(); conn.close()

        if not dijk_route:
            return jsonify({'error': 'Dijkstra không tìm thấy đường'}), 404

        # ── So sánh ───────────────────────────────────────────────────────────
        # Nếu A* lỗi → trả kết quả Dijkstra bình thường
        if astar_route is None:
            return jsonify({
                'same':    True,
                'reason':  f'A* không khả dụng: {astar_error}',
                'route':   {**dijk_route, 'source': 'dijkstra', 'criteria': criteria, 'vehicle': vehicle},
                'astarAvailable': False,
            })

        # So sánh khoảng cách: nếu chênh ≤ 2% → coi là giống nhau
        diff_pct = abs(dijk_route['distanceM'] - astar_route['distanceM']) / max(dijk_route['distanceM'], 1) * 100
        # So sánh tập đường: tính số đường giống nhau
        dijk_roads = set(dijk_route['roadNames'])
        astar_roads = set(astar_route['roadNames'])
        road_overlap = len(dijk_roads & astar_roads) / max(len(dijk_roads | astar_roads), 1) * 100

        same = diff_pct <= 2.0 and road_overlap >= 80.0

        if same:
            # Dùng Dijkstra (chuẩn hơn với bảng cost đã tính)
            return jsonify({
                'same':    True,
                'diffPct': round(diff_pct, 2),
                'reason':  f'Hai thuật toán cho cùng kết quả (chênh {diff_pct:.1f}%)',
                'route':   {**dijk_route, 'source': 'dijkstra', 'criteria': criteria, 'vehicle': vehicle},
                'astarAvailable': True,
            })
        else:
            return jsonify({
                'same':        False,
                'diffPct':     round(diff_pct, 2),
                'roadOverlap': round(road_overlap, 1),
                'dijkstra':    {**dijk_route, 'source': 'dijkstra', 'criteria': criteria, 'vehicle': vehicle},
                'astar':       {**astar_route, 'source': 'astar',    'criteria': criteria, 'vehicle': vehicle},
                'astarAvailable': True,
            })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'Lỗi: {e}'}), 500

# ─── /api/road-info ───────────────────────────────────────────────────────────
@app.route('/api/road-info', methods=['POST'])
def road_info():
    """
    Click điểm (lat,lng) → tìm tuyến đường gần nhất → JOIN đủ bảng → convert số→chữ.

    Schema thực tế:
      roads          → thông tin cơ bản: lane_count, direction, terrain, road_condition,
                        lighting, flooding_level, main_vehicle, road_width, length_m
      accidents      → accident_frequency, accident_type, severity, time_window
      traffic_conditions → traffic_time_window, congestion_level, speed_min, speed_max
      road_features  → potholes, many_intersections, near_intersection, surface_condition
      traffic_signs  → sign_type, applicable_vehicle
      wards          → ward_name
    """
    body   = request.get_json(silent=True) or {}
    lat    = body.get('lat')
    lng    = body.get('lng')
    radius = float(body.get('radius', 100))

    if lat is None or lng is None:
        return jsonify({'error':'Thiếu lat/lng'}), 400

    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # ── Bước 1: Tìm đoạn đường gần nhất ──────────────────────────────────
        nearest = None
        for r in [radius, radius*2, radius*5, 1000, 2000]:
            cur.execute("""
                SELECT road_id, road_name,
                       ST_Distance(
                           geom::geography,
                           ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography
                       ) AS dist_m
                FROM roads
                WHERE geom IS NOT NULL
                  AND ST_DWithin(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,
                        %s
                      )
                ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s,%s),4326)
                LIMIT 1
            """, (lng,lat, lng,lat, r, lng,lat))
            nearest = cur.fetchone()
            if nearest: break

        if not nearest:
            cur.close(); conn.close()
            return jsonify({'found':False,
                            'message':'Không có dữ liệu tuyến đường trong khu vực này'})

        road_name = nearest['road_name']
        road_id   = nearest['road_id']

        # ── Bước 2: Lấy thông tin cơ bản từ bảng roads (JOIN wards) ──────────
        cur.execute("""
            SELECT r.road_id, r.road_name, r.length_m, r.road_width,
                   r.lane_count, r.direction, r.terrain, r.road_condition,
                   r.lighting, r.flooding_level, r.main_vehicle,
                   w.ward_name
            FROM roads r
            LEFT JOIN wards w ON w.ward_id = r.ward_id
            WHERE r.road_name = %s OR r.road_id = %s
            ORDER BY r.road_id
            LIMIT 20
        """, (road_name, road_id))
        road_rows = cur.fetchall()

        if not road_rows:
            cur.close(); conn.close()
            return jsonify({'found':False,'message':'Không tìm thấy thông tin tuyến đường'})

        # Merge nhiều đoạn → 1 dict đại diện
        merged_road = dict(road_rows[0])
        for row in road_rows[1:]:
            for k,v in row.items():
                if merged_road.get(k) is None and v is not None:
                    merged_road[k] = v

        ward_name = merged_road.get('ward_name','')

        # ── Bước 3: Lấy thông tin tai nạn (accidents JOIN theo road_id) ───────
        # Dùng road_id từ đoạn gần nhất + tất cả road_id cùng tên
        all_road_ids = [r['road_id'] for r in road_rows]
        ids_placeholder = ','.join(['%s']*len(all_road_ids))

        acc_data = {}
        try:
            cur.execute(f"""
                SELECT accident_frequency, accident_type, severity, time_window
                FROM accidents
                WHERE road_id IN ({ids_placeholder})
                ORDER BY accident_frequency DESC NULLS LAST
                LIMIT 1
            """, all_road_ids)
            acc_row = cur.fetchone()
            if acc_row:
                acc_data = dict(acc_row)
        except Exception as e:
            print(f"[road-info accidents] {e}")

        # ── Bước 4: Lấy thông tin giao thông (traffic_conditions) ─────────────
        tc_data = {}
        try:
            cur.execute(f"""
                SELECT traffic_time_window, congestion_level, speed_min, speed_max
                FROM traffic_conditions
                WHERE road_id IN ({ids_placeholder})
                LIMIT 1
            """, all_road_ids)
            tc_row = cur.fetchone()
            if tc_row:
                tc_data = dict(tc_row)
        except Exception as e:
            print(f"[road-info traffic] {e}")

        # ── Bước 5: Lấy đặc điểm đường (road_features) ───────────────────────
        rf_data = {}
        try:
            cur.execute(f"""
                SELECT potholes, many_intersections, near_intersection, surface_condition
                FROM road_features
                WHERE road_id IN ({ids_placeholder})
                LIMIT 1
            """, all_road_ids)
            rf_row = cur.fetchone()
            if rf_row:
                rf_data = dict(rf_row)
        except Exception as e:
            print(f"[road-info road_features] {e}")

        # ── Bước 6: Lấy biển báo (traffic_signs) ─────────────────────────────
        ts_data = {}
        try:
            cur.execute(f"""
                SELECT sign_type, applicable_vehicle
                FROM traffic_signs
                WHERE road_id IN ({ids_placeholder})
                LIMIT 1
            """, all_road_ids)
            ts_row = cur.fetchone()
            if ts_row:
                ts_data = dict(ts_row)
        except Exception as e:
            print(f"[road-info traffic_signs] {e}")

        cur.close(); conn.close()

        # ── Bước 7: Gộp tất cả dữ liệu ───────────────────────────────────────
        combined = {
            # Từ roads
            'road_name':      merged_road.get('road_name'),
            'ward_name':      ward_name,
            'length_m':       merged_road.get('length_m'),
            'road_width':     merged_road.get('road_width'),
            'lane_count':     merged_road.get('lane_count'),
            'direction':      merged_road.get('direction'),
            'terrain':        merged_road.get('terrain'),
            'road_condition': merged_road.get('road_condition'),
            'lighting':       merged_road.get('lighting'),
            'flooding_level': merged_road.get('flooding_level'),
            'main_vehicle':   merged_road.get('main_vehicle'),
            # Từ accidents
            'accident_frequency': acc_data.get('accident_frequency'),
            'accident_type':      acc_data.get('accident_type'),
            'severity':           acc_data.get('severity'),
            'time_window':        acc_data.get('time_window'),
            # Từ traffic_conditions
            'traffic_time_window': tc_data.get('traffic_time_window'),
            'congestion_level':    tc_data.get('congestion_level'),
            'speed_min':           tc_data.get('speed_min'),
            'speed_max':           tc_data.get('speed_max'),
            # Từ road_features
            'potholes':           rf_data.get('potholes'),
            'many_intersections': rf_data.get('many_intersections'),
            'near_intersection':  rf_data.get('near_intersection'),
            'surface_condition':  rf_data.get('surface_condition'),
            # Từ traffic_signs
            'sign_type':          ts_data.get('sign_type'),
            'applicable_vehicle': ts_data.get('applicable_vehicle'),
        }

        # ── Bước 8: Convert số → chữ ──────────────────────────────────────────
        display = convert_display(combined)

        # ── Bước 9: Raw (chỉ giữ giá trị không None) ──────────────────────────
        raw = {k:v for k,v in combined.items() if v is not None}

        return jsonify({
            'found':        True,
            'road_name':    road_name or 'Không rõ tên đường',
            'ward':         ward_name or '',
            'dist_m':       round(float(nearest['dist_m']), 1),
            'all_segments': len(road_rows),
            'display':      display,
            'raw':          raw,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'Lỗi server: {e}'}), 500

# ─── /api/accidents ───────────────────────────────────────────────────────────
@app.route('/api/accidents')
def get_accidents():
    freq_map = {None:'0 – 1 vụ', 0:'0 – 1 vụ', 1:'0 – 1 vụ', 2:'2 – 3 vụ', 3:'Trên 3 vụ'}
    sev_map  = {1:'Nhẹ', 2:'Trung bình', 3:'Nặng'}
    type_map = {1:'Xe máy - Xe máy', 2:'Xe máy - Ô tô', 3:'Ô tô - Ô tô'}
    tw_map   = {1:'Buổi sáng', 2:'Buổi trưa', 3:'Buổi chiều', 4:'Buổi tối'}
    sev_cls  = {1:'low', 2:'medium', 3:'high'}
    # Không giới hạn số lượng — lấy TẤT CẢ điểm tai nạn trong DB
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT a.accident_id,
                   ST_Y(a.geom)  AS lat,
                   ST_X(a.geom)  AS lng,
                   a.accident_frequency,
                   a.severity,
                   a.accident_type,
                   a.time_window,
                   r.road_name
            FROM accidents a
            LEFT JOIN roads r ON r.road_id = a.road_id
            WHERE a.geom IS NOT NULL
            ORDER BY a.severity DESC NULLS LAST, a.accident_frequency DESC NULLS LAST
        """)
        # Không có LIMIT — lấy tất cả
        result = []
        for row in cur.fetchall():
            types = row['accident_type'] or []
            tws   = row['time_window']   or []
            type_str = ', '.join(type_map.get(t, str(t)) for t in types) if types else 'Không rõ'
            tw_str   = ', '.join(tw_map.get(t, str(t)) for t in tws)    if tws   else 'Không rõ'
            freq_val = row['accident_frequency']
            sev_val  = row['severity']
            result.append({
                'id':     f"A{row['accident_id']:03d}",
                'coords': [float(row['lat']), float(row['lng'])],
                'severity_class': sev_cls.get(sev_val, 'low'),
                # Thông tin hiển thị popup
                'info': {
                    'Mã tai nạn':           f"A{row['accident_id']:03d}",
                    'Tên đường':            row['road_name'] or 'Không rõ',
                    'Tần suất tai nạn':     freq_map.get(freq_val, str(freq_val)),
                    'Loại tai nạn':         type_str,
                    'Mức độ nghiêm trọng':  sev_map.get(sev_val, 'Không rõ'),
                    'Khung giờ xảy ra':     tw_str,
                },
            })
        cur.close(); conn.close()
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'DB error: {e}', 'db_connected': False}), 503

# ─── /api/traffic_signs ───────────────────────────────────────────────────────
@app.route('/api/traffic_signs')
def get_traffic_signs():
    sign_map = {1:'Biển tốc độ', 2:'Biển báo nguy hiểm', 3:'Biển cấm',
                4:'Biển hiệu lệnh', 5:'Biển chỉ dẫn', 6:'Biển phụ', 7:'Biển 1 chiều'}
    veh_map  = {1:'Xe máy', 2:'Moto', 3:'Ô tô', 4:'Xe tải'}
    # Không giới hạn — lấy TẤT CẢ biển báo trong DB
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT ts.sign_id,
                   ST_Y(ts.geom)  AS lat,
                   ST_X(ts.geom)  AS lng,
                   ts.sign_type,
                   ts.applicable_vehicle,
                   r.road_name
            FROM traffic_signs ts
            LEFT JOIN roads r ON r.road_id = ts.road_id
            WHERE ts.geom IS NOT NULL
            ORDER BY ts.sign_id
        """)
        result = []
        for row in cur.fetchall():
            signs = row['sign_type']          or []
            vehs  = row['applicable_vehicle'] or []
            sign_str = ', '.join(sign_map.get(s, str(s)) for s in signs) if signs else 'Không rõ'
            veh_str  = ', '.join(veh_map.get(v, str(v)) for v in vehs)  if vehs  else 'Tất cả'
            result.append({
                'id':     f"S{row['sign_id']:03d}",
                'coords': [float(row['lat']), float(row['lng'])],
                'info': {
                    'Mã biển báo':      f"S{row['sign_id']:03d}",
                    'Tên đường':        row['road_name'] or 'Không rõ',
                    'Loại biển báo':    sign_str,
                    'Phương tiện áp dụng': veh_str,
                },
            })
        cur.close(); conn.close()
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'DB error: {e}', 'db_connected': False}), 503

# ─── /api/traffic ─────────────────────────────────────────────────────────────
@app.route('/api/traffic')
def get_traffic():
    hour = int(request.args.get('hour', datetime.datetime.now().hour))
    slot = time_slot(hour)
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # congestion_level là array integer[], thường có 2-5 phần tử
        # Dùng LEAST(slot+1, array_length) để không vượt quá độ dài array
        # Nếu slot vượt quá → lấy phần tử cuối cùng (giờ cao điểm gần nhất)
        cur.execute(f"""
            SELECT tc.traffic_id,
                   ST_Y(ST_Centroid(r.geom)) AS lat,
                   ST_X(ST_Centroid(r.geom)) AS lng,
                   ST_AsGeoJSON(r.geom)       AS geojson,
                   r.road_name,
                   tc.congestion_level[
                       LEAST({slot+1}, array_length(tc.congestion_level, 1))
                   ] AS density,
                   tc.speed_min
            FROM traffic_conditions tc
            JOIN roads r ON r.road_id = tc.road_id
            WHERE r.geom IS NOT NULL
              AND tc.congestion_level IS NOT NULL
              AND array_length(tc.congestion_level, 1) >= 1
        """)
        result = []
        for r in cur.fetchall():
            d = r['density']
            if d is None or int(d) < 1:
                continue
            result.append({
                'id':       f"T{r['traffic_id']}",
                'coords':   [float(r['lat']), float(r['lng'])],
                'geojson':  r['geojson'],
                'road_name': r['road_name'] or '',
                'density':  int(d),
                'speed':    int(r['speed_min'] or 20),
            })
        cur.close(); conn.close()
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        # KHÔNG trả data giả — trả lỗi thật để frontend biết DB chưa kết nối
        return jsonify({'error': f'DB error: {e}', 'db_connected': False}), 503



# ─── /api/db-status ─────────────────────────────────────────────────────────
@app.route('/api/db-status')
def db_status():
    """Kiểm tra kết nối DB và trả về số lượng records thực tế."""
    try:
        conn = get_db()
        cur  = conn.cursor()
        
        counts = {}
        for tbl in ['roads','accidents','traffic_signs','traffic_conditions','wards']:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                counts[tbl] = cur.fetchone()[0]
            except:
                counts[tbl] = -1
        
        # Kiểm tra geometry
        geom_counts = {}
        for tbl, col in [('accidents','geom'),('traffic_signs','geom'),('roads','geom')]:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE {col} IS NOT NULL")
                geom_counts[tbl] = cur.fetchone()[0]
            except:
                geom_counts[tbl] = -1
        
        cur.close(); conn.close()
        return jsonify({
            'connected': True,
            'database': DB_CONFIG['dbname'],
            'host': DB_CONFIG['host'],
            'counts': counts,
            'geom_counts': geom_counts,
            'message': 'Kết nối database thành công'
        })
    except Exception as e:
        return jsonify({
            'connected': False,
            'error': str(e),
            'message': 'Không kết nối được database. Kiểm tra PostgreSQL đang chạy và database nckh_hcm tồn tại.'
        }), 503

# ─── /api/roads ───────────────────────────────────────────────────────────────
@app.route('/api/roads')
def get_roads():
    """Trả về TẤT CẢ đoạn đường có geom để vẽ lên bản đồ + click xem info."""
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT r.road_id,
                   r.road_name,
                   ST_AsGeoJSON(r.geom) AS geojson,
                   r.length_m,
                   r.road_width,
                   r.lane_count,
                   r.direction,
                   r.terrain,
                   r.road_condition,
                   r.lighting,
                   r.flooding_level,
                   r.main_vehicle,
                   w.ward_name
            FROM roads r
            LEFT JOIN wards w ON w.ward_id = r.ward_id
            WHERE r.geom IS NOT NULL
            ORDER BY r.road_id
        """)
        dir_map  = {1:'1 chiều', 2:'2 chiều'}
        terr_map = {1:'Đường phẳng',2:'Đường dốc nhẹ',3:'Đường phố đi bộ',
                    4:'Đường kênh rạch',5:'Đường cao tốc',6:'Đường khu chợ/TTTM',
                    7:'Đường ngập lụt',8:'Đường công trình',9:'Đang tái thiết'}
        cond_map = {1:'Bình thường', 2:'Khó đi'}
        lght_map = {1:'Có đèn đường', 2:'Không có đèn'}
        fld_map  = {1:'Không ngập', 2:'Ngập thấp', 3:'Ngập TB', 4:'Ngập cao'}
        veh_map  = {1:'Xe máy', 2:'Ô tô', 3:'Xe buýt'}

        result = []
        for row in cur.fetchall():
            mv = row['main_vehicle'] or []
            mv_str = ', '.join(veh_map.get(v, str(v)) for v in mv) if mv else 'Không rõ'
            result.append({
                'road_id':  row['road_id'],
                'geojson':  row['geojson'],
                'info': {
                    'Tên đường':           row['road_name'] or 'Không tên',
                    'Phường / Xã':         row['ward_name'] or '',
                    'Chiều dài (m)':       row['length_m'],
                    'Chiều rộng (m)':      row['road_width'],
                    'Số làn xe':           row['lane_count'],
                    'Chiều lưu thông':     dir_map.get(row['direction'], ''),
                    'Địa hình':            terr_map.get(row['terrain'], ''),
                    'Điều kiện đường':     cond_map.get(row['road_condition'], ''),
                    'Ánh sáng':            lght_map.get(row['lighting'], ''),
                    'Mức độ ngập':         fld_map.get(row['flooding_level'], ''),
                    'Phương tiện chủ yếu': mv_str,
                }
            })
        cur.close(); conn.close()
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'DB error: {e}', 'db_connected': False}), 503

# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("  WebGIS HCM — Flask Backend  v3.0")
    print(f"  DB host : {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"  DB name : {DB_CONFIG['dbname']}")
    print(f"  DB user : {DB_CONFIG['user']} / {DB_CONFIG['password']}")
    print("  API     : http://localhost:5000")
    print()
    print("  Schema đúng từ data.backup:")
    print("    roads, accidents, traffic_conditions,")
    print("    road_features, traffic_signs, routing_weights, wards")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)