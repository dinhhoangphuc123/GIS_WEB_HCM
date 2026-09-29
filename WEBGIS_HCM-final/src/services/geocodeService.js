// services/geocodeService.js
// Tìm kiếm địa điểm — ưu tiên backend Flask (DB roads) → Nominatim → local mock

import { API_URL } from '../config.js';

// ── Normalize tiếng Việt (bỏ dấu, lowercase) ────────────────────────────────
// Giúp tìm "cho ben thanh" → "Chợ Bến Thành", "landmark" → "Landmark 81", v.v.
function normalizeVi(str) {
  if (!str) return '';
  return str
    .normalize('NFD')                         // tách base + combining marks
    .replace(/[\u0300-\u036f]/g, '')          // bỏ combining diacritical marks
    .replace(/[đĐ]/g, 'd')                   // đ / Đ → d
    .toLowerCase()
    .trim();
}

// Kiểm tra query có khớp với haystack không (hỗ trợ cả có dấu lẫn không dấu)
function viMatch(haystack, query) {
  if (!haystack || !query) return false;
  // Khớp không dấu
  if (normalizeVi(haystack).includes(normalizeVi(query))) return true;
  // Khớp nguyên bản (query có dấu)
  if (haystack.toLowerCase().includes(query.toLowerCase())) return true;
  return false;
}

// Dữ liệu local làm fallback cuối
const PLACES_LOCAL = [
  { id: 'p01', name: 'Chợ Bến Thành',          sub: 'Quận 1',       lat: 10.7722, lng: 106.6983 },
  { id: 'p02', name: 'Landmark 81',             sub: 'Bình Thạnh',   lat: 10.7951, lng: 106.7218 },
  { id: 'p03', name: 'Nhà thờ Đức Bà',         sub: 'Quận 1',       lat: 10.7797, lng: 106.6990 },
  { id: 'p04', name: 'Bitexco Tower',           sub: 'Quận 1',       lat: 10.7713, lng: 106.7040 },
  { id: 'p05', name: 'Sân bay Tân Sơn Nhất',   sub: 'Tân Bình',     lat: 10.8184, lng: 106.6520 },
  { id: 'p06', name: 'ĐH Bách Khoa TPHCM',     sub: 'Quận 10',      lat: 10.7720, lng: 106.6579 },
  { id: 'p07', name: 'Chợ Lớn',                sub: 'Quận 5',       lat: 10.7511, lng: 106.6632 },
  { id: 'p08', name: 'Phố đi bộ Nguyễn Huệ',  sub: 'Quận 1',       lat: 10.7743, lng: 106.7032 },
  { id: 'p09', name: 'Đầm Sen Water Park',     sub: 'Quận 11',      lat: 10.7557, lng: 106.6388 },
  { id: 'p10', name: 'Suối Tiên',              sub: 'TP. Thủ Đức',  lat: 10.8671, lng: 106.8241 },
  { id: 'p11', name: 'Vincom Center',          sub: 'Quận 1',       lat: 10.7783, lng: 106.7018 },
  { id: 'p12', name: 'Chợ Bình Tây',          sub: 'Quận 6',       lat: 10.7498, lng: 106.6455 },
  { id: 'p13', name: 'AEON Mall Tân Phú',     sub: 'Tân Phú',      lat: 10.7926, lng: 106.6281 },
  { id: 'p14', name: 'BV Chợ Rẫy',           sub: 'Quận 5',       lat: 10.7531, lng: 106.6594 },
  { id: 'p15', name: 'Hồ Con Rùa',            sub: 'Quận 3',       lat: 10.7814, lng: 106.6949 },
  { id: 'p16', name: 'Nhà hát Thành phố',    sub: 'Quận 1',       lat: 10.7769, lng: 106.7021 },
  { id: 'p17', name: 'Ga Sài Gòn',           sub: 'Quận 3',       lat: 10.7816, lng: 106.6808 },
  { id: 'p18', name: 'Công viên Tao Đàn',   sub: 'Quận 1',       lat: 10.7757, lng: 106.6886 },
  { id: 'p19', name: 'Dinh Độc Lập',        sub: 'Quận 1',       lat: 10.7772, lng: 106.6953 },
  { id: 'p20', name: 'ĐH Khoa học Tự nhiên',sub: 'Quận 5',       lat: 10.7627, lng: 106.6826 },
  { id: 'p21', name: 'ĐH Kinh tế TPHCM',    sub: 'Quận 3',       lat: 10.7780, lng: 106.6927 },
  { id: 'p22', name: 'ĐH Sư phạm TPHCM',    sub: 'Quận 5',       lat: 10.7629, lng: 106.6826 },
  { id: 'p23', name: 'Bệnh viện Bình Dân',  sub: 'Quận 3',       lat: 10.7787, lng: 106.6875 },
  { id: 'p24', name: 'Công viên 23/9',      sub: 'Quận 1',       lat: 10.7676, lng: 106.6920 },
  { id: 'p25', name: 'Bến xe Miền Đông',    sub: 'TP. Thủ Đức',  lat: 10.8144, lng: 106.7148 },
  { id: 'p26', name: 'Bến xe Miền Tây',     sub: 'Bình Tân',     lat: 10.7390, lng: 106.6285 },
  { id: 'p27', name: 'Chùa Ngọc Hoàng',     sub: 'Quận 3',       lat: 10.7887, lng: 106.6944 },
  { id: 'p28', name: 'Bảo tàng Lịch sử',   sub: 'Quận 5',       lat: 10.7631, lng: 106.6797 },
  { id: 'p29', name: 'Đường Đồng Khởi',    sub: 'Quận 1',       lat: 10.7757, lng: 106.7024 },
  { id: 'p30', name: 'Vinhomes Central Park',sub:'Bình Thạnh',    lat: 10.7950, lng: 106.7220 },
];

/**
 * searchPlaces(query) → Promise<Place[]>
 * Ưu tiên: Backend DB → Local fallback (có normalize tiếng Việt)
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 1) return [];

  // 1. Thử gọi backend (backend yêu cầu >= 2 ký tự)
  if (query.trim().length >= 2) {
    try {
      const resp = await fetch(
        `${API_URL}/api/search?q=${encodeURIComponent(query)}&limit=6`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.length > 0) return data;
      }
    } catch (_) {
      // Backend offline → dùng local
    }
  }

  // 2. Fallback local mock — tìm kiếm hỗ trợ dấu tiếng Việt
  await new Promise(r => setTimeout(r, 50));
  const q = query.trim();

  return PLACES_LOCAL
    .filter(p => viMatch(p.name, q) || viMatch(p.sub, q))
    .slice(0, 6);
}