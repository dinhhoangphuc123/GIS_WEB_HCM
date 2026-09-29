// services/roadInfoService.js
// Gọi API /api/road-info để lấy thông tin tuyến đường theo tọa độ click.

import { API_URL } from '../config.js';

/**
 * fetchRoadInfo(lat, lng, radius?)
 * Gọi POST /api/road-info → trả về thông tin tuyến đường gần nhất.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius - bán kính tìm kiếm (mét), default 100
 * @returns {Promise<object>} - { found, road_name, display, ... }
 */
export async function fetchRoadInfo(lat, lng, radius = 100) {
  const resp = await fetch(`${API_URL}/api/road-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, radius }),
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${resp.status}`);
  }

  return await resp.json();
}