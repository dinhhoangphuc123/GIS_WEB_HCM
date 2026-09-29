// components/MapView.jsx
// Leaflet map với:
//  - Click bản đồ: chọn điểm đi/đến (click thường) HOẶC xem thông tin đường (mode "info")
//  - GPS watchPosition: auto-advance step, tính km/thời gian còn lại realtime
//  - Layer traffic / accident từ backend API

import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import trafficDataStatic  from '../data/traffic.json';
import accidentDataStatic from '../data/accidents.json';
import trafficSignsStatic from '../data/traffic_signs.json';
import { fetchCompareRoute, fetchBackendRoute, fetchOSRMRoute, applyCriteriaModifier, buildMockRoute } from '../services/routeService.js';
import { fetchRoadInfo } from '../services/roadInfoService.js';
import { VEHICLE_SPEEDS } from '../utils/routeMock.js';
import { compareOnCoords, haversine } from '../utils/graphSearch.js';
import { API_URL } from '../config.js';

async function fetchLayerData(endpoint, fallback) {
  // Thử kết nối backend với timeout 15s
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${API_URL}${endpoint}`, { signal: AbortSignal.timeout(15000) });
      
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) return data;
        if (Array.isArray(data) && data.length === 0) {
          // DB kết nối được nhưng bảng rỗng — không fallback
          return [];
        }
        if (!Array.isArray(data)) return data;
      }
      
      if (r.status === 503) {
        // Backend chạy nhưng DB lỗi — ném lỗi thật, không dùng fallback
        const err = await r.json().catch(() => ({}));
        throw new Error(`DB_ERROR: ${err.error || 'Database không kết nối được'}`);
      }
    } catch (e) {
      // Nếu là lỗi DB (503), ném tiếp để caller xử lý
      if (e.message && e.message.startsWith('DB_ERROR:')) throw e;
      // Nếu là lỗi mạng (server chưa chạy), retry rồi dùng fallback
      if (attempt === 0) await new Promise(res => setTimeout(res, 800));
    }
  }
  // Chỉ dùng fallback khi server HOÀN TOÀN offline (không có mạng)
  console.warn(`[WebGIS] Backend offline, dùng data tĩnh cho ${endpoint}`);
  return fallback;
}

// ── Haversine ────────────────────────────────────────────────────────────────


// ── Marker icons ─────────────────────────────────────────────────────────────
function createMarkerIcon(type) {
  const color = type === 'start' ? '#ec4899' : '#ef4444';
  const svg = type === 'start'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0"/><circle cx="12" cy="10" r="3"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/><circle cx="12" cy="8" r="2"/></svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,.25)"><div style="transform:rotate(45deg);width:18px;height:18px">${svg}</div></div>`,
    iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-36],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,.25)"></div>`,
    iconSize:[16,16], iconAnchor:[8,8],
  });
}

// Click indicator (bong bóng nhỏ xuất hiện khi click đường)
function createClickDotIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#ec4899;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(236,72,153,.5)"></div>`,
    iconSize:[14,14], iconAnchor:[7,7],
  });
}

// ── MapView component ─────────────────────────────────────────────────────────
export default function MapView({
  from, to,
  layers,
  vehicle, criteria,
  onMapClick,
  onRouteResult,
  onLoadingChange,
  triggerRoute,
  onRouteDone,
  showToast,
  // Road info callbacks
  onRoadInfoLoading,   // (bool) → App set loading state
  onRoadInfoData,      // (data) → App set road info data
  // GPS callbacks
  onStepAdvance,
  onLiveRemaining,
  // Mode: 'route' | 'info'
  mapMode,
  // Dual route selection: when user picks one algorithm
  selectedAlgorithmRoute,   // { coordinates, steps, ... } — the chosen route
}) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markerFrom    = useRef(null);
  const markerTo      = useRef(null);
  const markerUser    = useRef(null);
  const markerClick   = useRef(null);   // dot khi click đường
  const routeLines    = useRef([]);
  const layerGroups   = useRef({ traffic: null, accident: null, signs: null, roads: null });
  const watchId       = useRef(null);
  const routeDataRef  = useRef(null);
  const currentStepRef= useRef(0);
  const abortRef      = useRef(null);   // AbortController cho road-info fetch
  const accidentCacheRef = useRef(null); // Cache dữ liệu tai nạn để kiểm tra tuyến đường

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [10.7769, 106.7009],
      zoom: 13,
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(mapRef.current);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Preload dữ liệu tai nạn vào cache (để kiểm tra tuyến dù layer chưa bật)
    if (!accidentCacheRef.current) {
      fetchLayerData('/api/accidents', accidentDataStatic)
        .then(data => { accidentCacheRef.current = data; })
        .catch(() => { accidentCacheRef.current = accidentDataStatic; });
    }

    // Map click handler — xử lý theo mode
    mapRef.current.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      const mode = mapRef.current._webgisMode || 'route';

      if (mode === 'info') {
        // ── Mode INFO: click để xem thông tin đường ──
        // Xoá dot cũ
        if (markerClick.current) {
          mapRef.current.removeLayer(markerClick.current);
          markerClick.current = null;
        }
        // Vẽ dot mới
        markerClick.current = L.marker([lat, lng], { icon: createClickDotIcon(), zIndexOffset: 600 })
          .addTo(mapRef.current);

        // Huỷ request cũ nếu đang chạy
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        onRoadInfoLoading(true);
        onRoadInfoData(null);

        try {
          const data = await fetchRoadInfo(lat, lng, 150);
          onRoadInfoData(data);
        } catch (err) {
          if (err.name !== 'AbortError') {
            onRoadInfoData({ found: false, message: 'Không kết nối được server. Hãy kiểm tra backend.' });
          }
        } finally {
          onRoadInfoLoading(false);
        }
      } else {
        // ── Mode ROUTE: click để chọn điểm đi/đến ──
        onMapClick(e.latlng);
      }
    });
  }, []); // eslint-disable-line

  // Sync mode vào map instance (để click handler dùng được)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current._webgisMode = mapMode || 'route';
    }
  }, [mapMode]);

  // ── FROM marker ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (markerFrom.current) { map.removeLayer(markerFrom.current); markerFrom.current = null; }
    if (!from?.lat) return;
    markerFrom.current = L.marker([from.lat, from.lng], { icon: createMarkerIcon('start'), draggable: true })
      .addTo(map).bindPopup(`<b>Xuất phát</b><br>${from.label}`);
    markerFrom.current.on('dragend', e => {
      const p = e.target.getLatLng();
      onMapClick({ lat: p.lat, lng: p.lng }, 'from');
    });
  }, [from?.lat, from?.lng]); // eslint-disable-line

  // ── TO marker ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (markerTo.current) { map.removeLayer(markerTo.current); markerTo.current = null; }
    if (!to?.lat) return;
    markerTo.current = L.marker([to.lat, to.lng], { icon: createMarkerIcon('end'), draggable: true })
      .addTo(map).bindPopup(`<b>Điểm đến</b><br>${to.label}`);
    markerTo.current.on('dragend', e => {
      const p = e.target.getLatLng();
      onMapClick({ lat: p.lat, lng: p.lng }, 'to');
    });
    if (from?.lat) {
      map.fitBounds(L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]), { padding: [60, 60] });
    }
  }, [to?.lat, to?.lng]); // eslint-disable-line

  // ── Traffic layer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (layerGroups.current.traffic) { map.removeLayer(layerGroups.current.traffic); layerGroups.current.traffic = null; }
    if (!layers.traffic) return;
    const hour = new Date().getHours();
    fetchLayerData(`/api/traffic?hour=${hour}`, trafficDataStatic).then(data => {
      if (!layerGroups.current.traffic && layers.traffic) {
        const grp = L.layerGroup();

        // Schema thực tế: congestion_level = 1 (Nhẹ) / 2 (Trung bình) / 3 (Cao) / 4 (Rất cao)
        const CONGESTION_LABEL = { 1: 'Nhẹ', 2: 'Trung bình', 3: 'Cao', 4: 'Rất cao' };
        const CONGESTION_COLOR = {
          1: '#fbbf24',  // vàng — nhẹ
          2: '#f97316',  // cam  — trung bình
          3: '#ef4444',  // đỏ   — cao
          4: '#991b1b',  // đỏ đậm — rất cao
        };
        const CONGESTION_WEIGHT = { 1: 4, 2: 5, 3: 6, 4: 7 };

        data.forEach(seg => {
          const v = seg.density || 0;
          if (v < 1) return;
          const level      = Math.min(Math.max(Math.round(v), 1), 4);
          const color      = CONGESTION_COLOR[level] || CONGESTION_COLOR[3];
          const weight     = CONGESTION_WEIGHT[level] || 5;
          const label      = CONGESTION_LABEL[level]  || `Mức ${v}`;
          const accentClr  = level >= 3 ? '#ef4444' : level === 2 ? '#f97316' : '#eab308';
          const accentBg   = level >= 3 ? '#fef2f2' : level === 2 ? '#fff7ed' : '#fefce8';

          const popupHtml =
            `<div style="font-family:'Be Vietnam Pro',system-ui,sans-serif;min-width:210px;background:#fff;overflow:hidden">` +
              `<div style="padding:11px 14px 9px;border-bottom:1px solid #f1f1f4">` +
                `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">` +
                  `<div style="width:7px;height:7px;border-radius:50%;background:${accentClr};flex-shrink:0"></div>` +
                  `<span style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9898a6">Ùn tắc giao thông</span>` +
                `</div>` +
                `<div style="font-size:13.5px;font-weight:700;color:#141420;line-height:1.3">${seg.road_name || 'Tuyến đường'}</div>` +
              `</div>` +
              `<div style="padding:9px 14px 11px;display:flex;flex-direction:column;gap:6px">` +
                `<div style="display:flex;justify-content:space-between;align-items:center">` +
                  `<span style="font-size:11px;color:#9898a6">Mức độ</span>` +
                  `<span style="font-size:11px;font-weight:700;color:${accentClr};background:${accentBg};padding:2px 9px;border-radius:20px">${label}</span>` +
                `</div>` +
                `<div style="display:flex;justify-content:space-between;align-items:center">` +
                  `<span style="font-size:11px;color:#9898a6">Tốc độ</span>` +
                  `<span style="font-size:12px;font-weight:600;color:#141420">${seg.speed ?? '—'} <span style="font-weight:400;color:#9898a6">km/h</span></span>` +
                `</div>` +
              `</div>` +
            `</div>`;

          // Ưu tiên vẽ bằng geometry thực của đường (geojson từ DB)
          if (seg.geojson) {
            let geoObj;
            try { geoObj = typeof seg.geojson === 'string' ? JSON.parse(seg.geojson) : seg.geojson; } catch { geoObj = null; }
            if (geoObj) {
              const line = L.geoJSON(geoObj, {
                style: {
                  color,
                  weight,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                }
              });
              line.on('mouseover', function () { this.setStyle({ weight: weight + 2, opacity: 1 }); });
              line.on('mouseout',  function () { this.setStyle({ weight, opacity: 0.85 }); });
              line.bindPopup(popupHtml).addTo(grp);
              return;
            }
          }

          // Fallback: không có geojson (static data) → vẽ đoạn ngắn quanh coords
          const [lat, lng] = seg.coords;
          const delta = 0.003; // ~330m
          const fallbackLine = L.polyline(
            [[lat - delta, lng - delta], [lat, lng], [lat + delta, lng + delta]],
            { color, weight, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }
          );
          fallbackLine.on('mouseover', function () { this.setStyle({ weight: weight + 2, opacity: 1 }); });
          fallbackLine.on('mouseout',  function () { this.setStyle({ weight, opacity: 0.85 }); });
          fallbackLine.bindPopup(popupHtml).addTo(grp);
        });

        grp.addTo(map); layerGroups.current.traffic = grp;
      }
    }).catch(err => {
      if (showToast) showToast(` Lỗi DB kẹt xe: ${err.message.replace('DB_ERROR: ','')}`, 'error');
      console.error('[traffic layer]', err);
    });
  }, [layers.traffic]);

  // ── Accident layer — chấm đỏ, click hiện đầy đủ thuộc tính ─────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (layerGroups.current.accident) { map.removeLayer(layerGroups.current.accident); layerGroups.current.accident = null; }
    if (!layers.accident) return;
    if (showToast) showToast(' Đang tải điểm tai nạn từ PostgreSQL...', 'info');
    fetchLayerData('/api/accidents', accidentDataStatic).then(data => {
      accidentCacheRef.current = data; // Cache để kiểm tra tuyến đường
      if (showToast) showToast(` Tải ${data.length} điểm tai nạn từ DB thành công`, 'success');
      if (!layerGroups.current.accident && layers.accident) {
        const grp = L.layerGroup();
        data.forEach(item => {
          // Điểm tai nạn màu ĐEN — hỗ trợ cả format API (severity_class) lẫn format cũ (severity)
          const sevClass = item.severity_class || (item.severity === 'high' ? 'high' : item.severity === 'medium' ? 'medium' : 'low');
          const size = sevClass === 'high' ? 16 : sevClass === 'medium' ? 14 : 12;
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:${size}px;height:${size}px;background:#111111;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.7);cursor:pointer"></div>`,
            iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -10],
          });
          // Hỗ trợ format API mới {info: {...}} VÀ format cũ {count, type, severity}
          const info = item.info || {
            'Mã tai nạn': item.id,
            'Tần suất tai nạn': item.count != null ? `${item.count} vụ` : 'Không rõ',
            'Loại tai nạn': item.type || 'Không rõ',
            'Mức độ nghiêm trọng': item.severity === 'high' ? 'Nặng' : item.severity === 'medium' ? 'Trung bình' : 'Nhẹ',
          };
          const rows = Object.entries(info).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
              `<span style="font-size:11px;color:#9898a6;white-space:nowrap;flex-shrink:0">${k}</span>` +
              `<span style="font-size:11.5px;font-weight:600;color:#141420;text-align:right">${v}</span>` +
            `</div>`
          ).join('');
          const sevClr = sevClass === 'high' ? '#ef4444' : sevClass === 'medium' ? '#f97316' : '#10b981';
          const sevBg  = sevClass === 'high' ? '#fef2f2' : sevClass === 'medium' ? '#fff7ed' : '#f0fdf4';
          const sevLabel = sevClass === 'high' ? 'Nặng' : sevClass === 'medium' ? 'Trung bình' : 'Nhẹ';
          const popup =
            `<div style="font-family:'Be Vietnam Pro',system-ui,sans-serif;min-width:210px;background:#fff;overflow:hidden">` +
              `<div style="padding:11px 14px 9px;border-bottom:1px solid #f1f1f4;display:flex;align-items:center;justify-content:space-between">` +
                `<div>` +
                  `<div style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9898a6;margin-bottom:3px">Điểm tai nạn</div>` +
                  `<div style="font-size:13.5px;font-weight:700;color:#141420">${item.id}</div>` +
                `</div>` +
                `<span style="font-size:11px;font-weight:700;color:${sevClr};background:${sevBg};padding:3px 9px;border-radius:20px;flex-shrink:0">${sevLabel}</span>` +
              `</div>` +
              `<div style="padding:9px 14px 11px;display:flex;flex-direction:column;gap:6px">${rows}</div>` +
            `</div>`;
          L.marker(item.coords, { icon, zIndexOffset: 400 })
            .bindPopup(popup, { maxWidth: 300 })
            .addTo(grp);
        });
        grp.addTo(map); layerGroups.current.accident = grp;
      }
    }).catch(err => {
      if (showToast) showToast(` Lỗi DB tai nạn: ${err.message.replace('DB_ERROR: ','')}`, 'error');
      console.error('[accidents layer]', err);
    });
  }, [layers.accident]);

  // ── Traffic signs layer — chấm vàng, click hiện đầy đủ thuộc tính ──────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (layerGroups.current.signs) { map.removeLayer(layerGroups.current.signs); layerGroups.current.signs = null; }
    if (!layers.signs) return;
    if (showToast) showToast(' Đang tải dữ liệu biển báo...', 'info');
    fetchLayerData('/api/traffic_signs', trafficSignsStatic).then(data => {
      if (showToast) showToast(` Đã tải ${data.length} biển báo`, 'success');
      if (!layerGroups.current.signs && layers.signs) {
        const grp = L.layerGroup();
        data.forEach(item => {
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;background:#eab308;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(234,179,8,0.7);cursor:pointer"></div>`,
            iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -8],
          });
          const info = item.info || {};
          const rows = Object.entries(info).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
              `<span style="font-size:11px;color:#9898a6;white-space:nowrap;flex-shrink:0">${k}</span>` +
              `<span style="font-size:11.5px;font-weight:600;color:#141420;text-align:right">${v}</span>` +
            `</div>`
          ).join('');
          const popup =
            `<div style="font-family:'Be Vietnam Pro',system-ui,sans-serif;min-width:210px;background:#fff;overflow:hidden">` +
              `<div style="padding:11px 14px 9px;border-bottom:1px solid #f1f1f4">` +
                `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">` +
                  `<div style="width:7px;height:7px;border-radius:50%;background:#eab308;flex-shrink:0"></div>` +
                  `<span style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9898a6">Biển báo</span>` +
                `</div>` +
                `<div style="font-size:13.5px;font-weight:700;color:#141420">${item.id}</div>` +
              `</div>` +
              `<div style="padding:9px 14px 11px;display:flex;flex-direction:column;gap:6px">${rows || '<span style="font-size:11px;color:#9898a6">Không có dữ liệu bổ sung</span>'}</div>` +
            `</div>`;
          L.marker(item.coords, { icon, zIndexOffset: 400 })
            .bindPopup(popup, { maxWidth: 300 })
            .addTo(grp);
        });
        grp.addTo(map); layerGroups.current.signs = grp;
      }
    }).catch(err => {
      if (showToast) showToast(` Lỗi DB biển báo: ${err.message.replace('DB_ERROR: ','')}`, 'error');
      console.error('[signs layer]', err);
    });
  }, [layers.signs]);


  // ── Roads layer — load tất cả đường từ DB, click bất kỳ điểm nào hiện info ──
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (layerGroups.current.roads) {
      map.removeLayer(layerGroups.current.roads);
      layerGroups.current.roads = null;
    }
    if (!layers.roads) return;

    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/roads`, { signal: AbortSignal.timeout(20000) });
        if (!r.ok) return;
        const data = await r.json();
        if (!data.length) return;

        const grp = L.layerGroup();
        data.forEach(item => {
          if (!item.geojson) return;
          let geoObj;
          try { geoObj = JSON.parse(item.geojson); } catch { return; }

          // Vẽ đường màu xanh đậm, highlight khi hover
          const line = L.geoJSON(geoObj, {
            style: {
              color: '#1d4ed8',
              weight: 4,
              opacity: 0.75,
              lineCap: 'round',
              lineJoin: 'round',
            }
          });

          // Hover effect
          line.on('mouseover', function () {
            this.setStyle({ color: '#f97316', weight: 6, opacity: 1 });
          });
          line.on('mouseout', function () {
            this.setStyle({ color: '#1d4ed8', weight: 4, opacity: 0.75 });
          });

          // Click → hiện popup với đầy đủ thông tin bảng roads
          const info = item.info || {};
          const rows = Object.entries(info)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) =>
              `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px">` +
                `<span style="font-size:11px;color:#9898a6;white-space:nowrap;flex-shrink:0">${k}</span>` +
                `<span style="font-size:11.5px;font-weight:600;color:#141420;text-align:right">${v}</span>` +
              `</div>`
            ).join('');
          const roadName = info['Tên đường'] || 'Tuyến đường';
          const popupHtml =
            `<div style="font-family:'Be Vietnam Pro',system-ui,sans-serif;min-width:230px;max-width:300px;background:#fff;overflow:hidden">` +
              `<div style="padding:11px 14px 9px;border-bottom:1px solid #f1f1f4">` +
                `<div style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9898a6;margin-bottom:3px">Tuyến đường</div>` +
                `<div style="font-size:14px;font-weight:700;color:#141420;line-height:1.3">${roadName}</div>` +
              `</div>` +
              `<div style="padding:9px 14px 11px;display:flex;flex-direction:column;gap:6px">${rows}</div>` +
            `</div>`;
          line.bindPopup(popupHtml, { maxWidth: 320 });

          line.addTo(grp);
        });

        if (layers.roads) {
          grp.addTo(map);
          layerGroups.current.roads = grp;
        }
      } catch (e) {
        console.warn('[roads layer]', e);
      }
    })();
  }, [layers.roads]);

  // ── GPS watch ────────────────────────────────────────────────────────────────
  const startGPSWatch = useCallback((destLat, destLng, vehicleKey) => {
    if (!navigator.geolocation) return;
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    const spd = VEHICLE_SPEEDS[vehicleKey] || VEHICLE_SPEEDS.motorbike;
    watchId.current = navigator.geolocation.watchPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const map = mapRef.current; if (!map) return;
      if (!markerUser.current) {
        markerUser.current = L.marker([lat, lng], { icon: createUserIcon(), zIndexOffset: 500 }).addTo(map);
      } else {
        markerUser.current.setLatLng([lat, lng]);
      }
      const remDist = haversine(lat, lng, destLat, destLng);
      const remTime = (remDist / 1000) / spd.avg * 3600;
      onLiveRemaining({ distM: remDist, timeS: remTime });
      const rd = routeDataRef.current;
      if (rd && rd.stepCoords) {
        const nextIdx = currentStepRef.current + 1;
        if (nextIdx < rd.stepCoords.length) {
          const [sLat, sLng] = rd.stepCoords[nextIdx];
          if (haversine(lat, lng, sLat, sLng) < 40) {
            currentStepRef.current = nextIdx;
            onStepAdvance(nextIdx);
          }
        }
      }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
  }, [onLiveRemaining, onStepAdvance]);

  // ── Route calculation ─────────────────────────────────────────────────────────
  const doRouting = useCallback(async () => {
    const map = mapRef.current; if (!map || !from?.lat || !to?.lat) return;
    onLoadingChange(true);
    routeLines.current.forEach(l => map.removeLayer(l));
    routeLines.current = [];
    currentStepRef.current = 0;
    let result = null;

    // Priority 1: Backend Flask — Dijkstra + A* so sánh
    try {
      const cmp = await fetchCompareRoute(from, to, vehicle, criteria);

      if (cmp.same) {
        // Hai thuật toán giống nhau → dùng kết quả duy nhất
        result = cmp.route;
        const stepCoords = (result.steps || []).map((_, i) => {
          const idx = Math.floor((i / Math.max(result.steps.length, 1)) * result.coordinates.length);
          return result.coordinates[idx] || result.coordinates[0];
        });
        routeDataRef.current = { steps: result.steps, stepCoords, vehicle };
        drawRoute(map, result.coordinates, false, '#ec4899');
        onRouteResult({ ...result, distM: result.distanceM, timeS: result.durationS, criteria, isMock: false });
        const astarMsg = cmp.astarAvailable
          ? ` Dijkstra & A* cho kết quả giống nhau (chênh ${cmp.diffPct ?? 0}%)`
          : ' Tìm đường Dijkstra (A* không khả dụng trên DB này)';
        showToast(astarMsg, 'success');
      } else {
        // Hai thuật toán khác nhau → vẽ cả hai, gửi cả hai lên App để chọn
        const dijk = cmp.dijkstra;
        const ast  = cmp.astar;

        // Vẽ cả 2 tuyến lên bản đồ (khác màu)
        drawRoute(map, dijk.coordinates, false, '#3b82f6');  // blue = Dijkstra
        drawRoute(map, ast.coordinates,  false, '#f59e0b');  // amber = A*

        // Fit bounds bao phủ cả hai
        const allCoords = [...dijk.coordinates, ...ast.coordinates];
        map.fitBounds(allCoords, { padding: [60, 60] });

        // Gửi kết quả dual lên App
        onRouteResult({
          isDualResult: true,
          dijkstra: { ...dijk, distM: dijk.distanceM, timeS: dijk.durationS, criteria, isMock: false },
          astar:    { ...ast,  distM: ast.distanceM,  timeS: ast.durationS,  criteria, isMock: false },
          diffPct:  cmp.diffPct,
          roadOverlap: cmp.roadOverlap,
          criteria, vehicle,
        });
        showToast(
          ` Dijkstra & A* cho kết quả khác nhau (chênh ${cmp.diffPct}%) — Hãy chọn tuyến!`,
          'warning'
        );
      }
      startGPSWatch(to.lat, to.lng, vehicle);
      onLoadingChange(false); onRouteDone(); return;
    } catch (err) { console.warn('[Backend offline]', err.message); }

    // Priority 2: OSRM + JS Dijkstra/A* so sánh
    try {
      const raw = await fetchOSRMRoute(from, to, vehicle);
      // Áp dụng modifier criteria cho raw OSRM
      const osrmRoute = applyCriteriaModifier(raw, criteria, vehicle);

      // Chạy Dijkstra vs A* trên tập node OSRM
      const cmp = compareOnCoords(raw.coordinates, from, to, vehicle);

      if (cmp && !cmp.same) {
        // Hai thuật toán khác nhau → vẽ cả hai
        const dijk = { ...cmp.dijkstra, criteria, isMock: false };
        const ast  = { ...cmp.astar,    criteria, isMock: false };

        drawRoute(map, dijk.coordinates, false, '#3b82f6');
        drawRoute(map, ast.coordinates,  false, '#f59e0b');
        const allCoords = [...dijk.coordinates, ...ast.coordinates];
        map.fitBounds(allCoords, { padding: [60, 60] });

        onRouteResult({
          isDualResult: true,
          dijkstra: dijk,
          astar:    ast,
          diffPct:  cmp.diffPct,
          roadOverlap: cmp.roadOverlap,
          criteria, vehicle,
          sourceLabel: 'OSRM + JS Graph',
        });
        showToast(
          ` Dijkstra vs A* trên đồ thị OSRM — chênh ${cmp.diffPct}% — Hãy chọn tuyến!`,
          'warning'
        );
      } else {
        // Giống nhau hoặc không tính được → dùng OSRM thông thường
        const stepCoords = (osrmRoute.steps || []).map((_, i) => {
          const idx = Math.floor((i / Math.max(osrmRoute.steps.length, 1)) * raw.coordinates.length);
          return raw.coordinates[idx] || raw.coordinates[0];
        });
        routeDataRef.current = { steps: osrmRoute.steps, stepCoords, vehicle };
        drawRoute(map, raw.coordinates, false, '#ec4899');
        onRouteResult({ ...osrmRoute, distM: osrmRoute.distM ?? raw.distanceM, timeS: osrmRoute.timeS ?? raw.durationS, criteria, isMock: false, source: 'dijkstra' });
        const msg = cmp
          ? ` Dijkstra & A* cho kết quả giống nhau (chênh ${cmp.diffPct}%)`
          : ' Tìm đường OSRM';
        showToast(msg, 'success');
      }
      startGPSWatch(to.lat, to.lng, vehicle);
      onLoadingChange(false); onRouteDone(); return;
    } catch (err) { console.warn('[OSRM offline]', err.message); }

    // Fallback: Mock + JS Dijkstra/A*
    const mockRaw = buildMockRoute(from, to, criteria, vehicle);
    const cmpMock = compareOnCoords(mockRaw.coordinates, from, to, vehicle);

    if (cmpMock && !cmpMock.same) {
      const dijk = { ...cmpMock.dijkstra, criteria, isMock: true };
      const ast  = { ...cmpMock.astar,    criteria, isMock: true };
      drawRoute(map, dijk.coordinates, true, '#3b82f6');
      drawRoute(map, ast.coordinates,  true, '#f59e0b');
      const allC = [...dijk.coordinates, ...ast.coordinates];
      map.fitBounds(allC, { padding: [60, 60] });
      onRouteResult({
        isDualResult: true,
        dijkstra: dijk, astar: ast,
        diffPct: cmpMock.diffPct, roadOverlap: cmpMock.roadOverlap,
        criteria, vehicle, sourceLabel: 'Ước tính',
      });
      showToast(` Ước tính: Dijkstra vs A* chênh ${cmpMock.diffPct}% — Chọn tuyến!`, 'warning');
    } else {
      routeDataRef.current = { steps: mockRaw.steps, stepCoords: mockRaw.coordinates, vehicle };
      drawRoute(map, mockRaw.coordinates, true, '#ec4899');
      onRouteResult({ ...mockRaw, criteria, isMock: true, source: 'dijkstra' });
      showToast(' Dùng dữ liệu ước tính (offline)', 'warning');
    }
    startGPSWatch(to.lat, to.lng, vehicle);
    onLoadingChange(false); onRouteDone();
  }, [from, to, vehicle, criteria, onLoadingChange, onRouteResult, onRouteDone, showToast, startGPSWatch]);

  useEffect(() => { if (triggerRoute) doRouting(); }, [triggerRoute]); // eslint-disable-line

  // When user picks one algorithm from dual results → redraw only that route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAlgorithmRoute) return;
    routeLines.current.forEach(l => map.removeLayer(l));
    routeLines.current = [];
    drawRoute(map, selectedAlgorithmRoute.coordinates, false, '#ec4899');
    const stepCoords = (selectedAlgorithmRoute.steps || []).map((_, i) => {
      const idx = Math.floor((i / Math.max(selectedAlgorithmRoute.steps.length, 1)) * selectedAlgorithmRoute.coordinates.length);
      return selectedAlgorithmRoute.coordinates[idx] || selectedAlgorithmRoute.coordinates[0];
    });
    routeDataRef.current = { steps: selectedAlgorithmRoute.steps, stepCoords, vehicle };
    map.fitBounds(selectedAlgorithmRoute.coordinates, { padding: [60, 60] });
  }, [selectedAlgorithmRoute]); // eslint-disable-line

  useEffect(() => () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // ── Kiểm tra tuyến đường có đi qua điểm tai nạn không ───────────────────────
  function checkRouteNearAccidents(coords) {
    const THRESHOLD_M = 1000;
    const accidentData = accidentCacheRef.current;
    if (!accidentData || accidentData.length === 0) return;

    const hit = [];
    accidentData.forEach(item => {
      if (!item.coords) return;
      const [aLat, aLng] = item.coords;
      for (let i = 0; i < coords.length; i++) {
        const [rLat, rLng] = Array.isArray(coords[i]) ? coords[i] : [coords[i].lat, coords[i].lng];
        const dist = haversine(rLat, rLng, aLat, aLng);
        if (dist <= THRESHOLD_M) {
          const sevClass = item.severity_class || (item.severity === 'high' ? 'high' : item.severity === 'medium' ? 'medium' : 'low');
          hit.push({ item, sevClass, dist: Math.round(dist) });
          break;
        }
      }
    });

    if (hit.length === 0) return;

    hit.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.sevClass] ?? 2) - (order[b.sevClass] ?? 2);
    });

    const highCount  = hit.filter(h => h.sevClass === 'high').length;
    const medCount   = hit.filter(h => h.sevClass === 'medium').length;
    const totalCount = hit.length;
    const parts = [];
    if (highCount > 0) parts.push(`${highCount} điểm nặng`);
    if (medCount  > 0) parts.push(`${medCount} điểm trung bình`);
    const rest = totalCount - highCount - medCount;
    if (rest      > 0) parts.push(`${rest} điểm nhẹ`);

    if (showToast) {
      showToast(
        `⚠️ Tuyến đường đi qua ${totalCount} điểm tai nạn (${parts.join(', ')}) — Hãy thận trọng!`,
        'warning'
      );
    }

    const map = mapRef.current;
    if (!map) return;
    hit.forEach(({ item, sevClass }) => {
      const [aLat, aLng] = item.coords;
      const color = sevClass === 'high' ? '#ef4444' : sevClass === 'medium' ? '#f97316' : '#eab308';
      const pulseIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:32px;height:32px">
            <div style="
              position:absolute;inset:0;border-radius:50%;
              border:3px solid ${color};
              animation:accidentPulse 1.4s ease-out infinite;
              opacity:.8
            "></div>
            <div style="
              position:absolute;inset:6px;border-radius:50%;
              background:${color};border:2px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,.4)
            "></div>
          </div>
          <style>
            @keyframes accidentPulse {
              0%   { transform:scale(1);   opacity:.8 }
              70%  { transform:scale(2.2); opacity:0  }
              100% { transform:scale(2.2); opacity:0  }
            }
          </style>`,
        iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
      });
      const sevLabel  = sevClass === 'high' ? '🔴 Nghiêm trọng' : sevClass === 'medium' ? '🟠 Trung bình' : '🟡 Nhẹ';
      const info      = item.info || {};
      const extraRows = Object.entries(info).map(([k, v]) =>
        `<div style="display:flex;justify-content:space-between;gap:10px;font-size:11.5px">
           <span style="color:#9898a6">${k}</span>
           <span style="font-weight:600;color:#141420">${v}</span>
         </div>`
      ).join('');
      const popupHtml =
        `<div style="font-family:'Be Vietnam Pro',system-ui,sans-serif;min-width:220px">
           <div style="padding:10px 14px 8px;border-bottom:1px solid #f1f1f4">
             <div style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ef4444;margin-bottom:4px">⚠️ ĐIỂM TAI NẠN TRÊN TUYẾN</div>
             <div style="font-size:13px;font-weight:700;color:#141420">${item.id ?? 'Không rõ'}</div>
             <div style="margin-top:4px;font-size:11.5px;font-weight:700;color:${color}">${sevLabel}</div>
           </div>
           <div style="padding:8px 14px 12px;display:flex;flex-direction:column;gap:6px">
             ${extraRows || `<div style="font-size:12px;color:#666">Không có thông tin chi tiết</div>`}
             <div style="margin-top:4px;font-size:11px;color:#9898a6;font-style:italic">Tuyến đường của bạn đi qua khu vực này</div>
           </div>
         </div>`;
      L.marker([aLat, aLng], { icon: pulseIcon, zIndexOffset: 800 })
        .bindPopup(popupHtml, { maxWidth: 300 })
        .addTo(map);
    });
  }

  function drawRoute(map, coords, isMock, color = '#ec4899') {
    const outline = L.polyline(coords, { color:'white', weight:10, opacity:.35, lineJoin:'round' }).addTo(map);
    const line    = L.polyline(coords, {
      color, weight:5, opacity:.92, lineJoin:'round',
      ...(isMock ? { dashArray:'10 6' } : {})
    }).addTo(map);
    routeLines.current.push(outline, line);
    map.fitBounds(line.getBounds(), { padding:[60,60] });
    // Kiểm tra tuyến có đi qua điểm tai nạn không
    checkRouteNearAccidents(coords);
  }

  return <div ref={containerRef} style={{ width:'100%', height:'100%' }}/>;
}