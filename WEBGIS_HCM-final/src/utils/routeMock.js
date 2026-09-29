// utils/routeMock.js
// Hằng số và tiện ích dùng chung trong toàn app.
// Khi tích hợp backend: giữ nguyên VEHICLE_SPEEDS & CRITERIA_MODIFIERS,
// chỉ cần thay thế hàm gọi API trong routeService.js.

export const VEHICLE_SPEEDS = {
  motorbike: { avg: 28, max: 60 },
  car:       { avg: 32, max: 80 },
  walk:      { avg: 5,  max: 8  },
  bus:       { avg: 18, max: 40 },
};

// Weight modifier theo từng tiêu chí tối ưu
// trafficW cao → tránh đường kẹt → dist tăng nhẹ, time giảm
export const CRITERIA_MODIFIERS = {
  shortest:       { tw: 0.1 },
  traffic:        { tw: 1.5 },
  infrastructure: { tw: 0.3 },
  safety:         { tw: 0.3 },
  fastest:        { tw: 1.2 },
};

export const CRITERIA_LABELS = {
  shortest:       'Ngắn nhất',
  traffic:        'Ít kẹt xe',
  infrastructure: 'Hạ tầng tốt',
  safety:         'An toàn',
  fastest:        'Nhanh nhất',
};

export const ROAD_TYPES = {
  shortest:       'Đường phố',
  traffic:        'Đại lộ',
  infrastructure: 'Quốc lộ',
  safety:         'Nội thị',
  fastest:        'Cao tốc/QL',
};

export const CRITERIA_LIST = [
  { key: 'shortest',       icon: '📏', name: 'Đường ngắn nhất',     desc: 'Tối thiểu khoảng cách' },
  { key: 'traffic',        icon: '🚦', name: 'Ít kẹt xe nhất',      desc: 'Tránh mật độ cao'      },
  { key: 'infrastructure', icon: '🏗️', name: 'Cơ sở hạ tầng',      desc: 'Đường chất lượng cao'  },
  { key: 'safety',         icon: '🛡️', name: 'Ít tai nạn nhất',     desc: 'Tránh điểm đen'        },
  { key: 'fastest',        icon: '⚡', name: 'Thời gian nhanh nhất', desc: 'Tối ưu tốc độ'        },
];

// Tên đường TPHCM cho mock turn-by-turn
export const ROAD_NAMES = [
  'Lê Duẩn', 'Nguyễn Huệ', 'Điện Biên Phủ', 'Lê Lợi',
  'Trần Hưng Đạo', 'Nguyễn Thị Minh Khai', 'Võ Thị Sáu',
  'Cách Mạng Tháng 8', 'Phan Đăng Lưu', 'Hoàng Văn Thụ',
  'Phạm Văn Đồng', 'Xa lộ Hà Nội', 'Nguyễn Văn Cừ', 'Lý Thường Kiệt',
];

// ── Format helpers ────────────────────────────────────

export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds) {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}g ${m}ph` : `${h} giờ`;
}

export function formatSpeed(kmh) {
  return `${Math.round(kmh)} km/h`;
}
