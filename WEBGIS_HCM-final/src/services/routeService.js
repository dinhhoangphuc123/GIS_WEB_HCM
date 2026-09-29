// services/routeService.js
// Gọi Flask backend API để tính đường đi Dijkstra từ PostgreSQL.
// Fallback tự động về OSRM → Mock nếu backend offline.

import { VEHICLE_SPEEDS, CRITERIA_MODIFIERS, ROAD_NAMES } from '../utils/routeMock.js';
import { API_URL } from '../config.js';

/**
 * fetchBackendRoute(from, to, vehicle, criteria, hour)
 * Gọi API backend Flask → Dijkstra trên PostgreSQL.
 */
export async function fetchBackendRoute(from, to, vehicle, criteria, hour = null) {
  const currentHour = hour ?? new Date().getHours();

  const resp = await fetch(`${API_URL}/api/route`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     { lat: from.lat, lng: from.lng },
      to:       { lat: to.lat,   lng: to.lng   },
      vehicle,
      criteria,
      hour: currentHour,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${resp.status}`);
  }

  const data = await resp.json();
  return {
    distanceM:   data.distanceM,
    durationS:   data.durationS,
    speedKmh:    data.speedKmh,
    coordinates: data.coordinates,
    steps:       data.steps || [],
    roadNames:   data.roadNames || [],
    isMock:      false,
    source:      'dijkstra',
  };
}

/**
 * fetchCompareRoute(from, to, vehicle, criteria, hour)
 * Gọi API /api/route-compare → chạy Dijkstra + A* đồng thời.
 * Trả về { same, route?, dijkstra?, astar?, diffPct, reason? }
 */
export async function fetchCompareRoute(from, to, vehicle, criteria, hour = null) {
  const currentHour = hour ?? new Date().getHours();
  const resp = await fetch(`${API_URL}/api/route-compare`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     { lat: from.lat, lng: from.lng },
      to:       { lat: to.lat,   lng: to.lng   },
      vehicle, criteria,
      hour: currentHour,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${resp.status}`);
  }
  const data = await resp.json();
  // Normalise shape for MapView
  if (data.same) {
    return {
      same: true,
      diffPct: data.diffPct ?? 0,
      reason: data.reason,
      astarAvailable: data.astarAvailable,
      route: _normalise(data.route),
    };
  }
  return {
    same: false,
    diffPct: data.diffPct,
    roadOverlap: data.roadOverlap,
    astarAvailable: true,
    dijkstra: _normalise(data.dijkstra),
    astar:    _normalise(data.astar),
  };
}

function _normalise(r) {
  if (!r) return null;
  return {
    distanceM:   r.distanceM,
    durationS:   r.durationS,
    speedKmh:    r.speedKmh,
    coordinates: r.coordinates,
    steps:       r.steps || [],
    roadNames:   r.roadNames || [],
    isMock:      false,
    source:      r.source,
    criteria:    r.criteria,
    vehicle:     r.vehicle,
    distM:       r.distanceM,
    timeS:       r.durationS,
  };
}


export async function fetchOSRMRoute(from, to, vehicle) {
  const profile = vehicle === 'walk' ? 'foot' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error('OSRM request failed');
  const data = await resp.json();
  if (data.code !== 'Ok') throw new Error('OSRM: no route found');
  const route = data.routes[0];
  return {
    distanceM:   route.distance,
    durationS:   route.duration,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    steps:       parseOSRMSteps(route.legs),
  };
}

export function applyCriteriaModifier(raw, criteria, vehicle) {
  const mod = CRITERIA_MODIFIERS[criteria];
  const spd = VEHICLE_SPEEDS[vehicle];
  const distM    = raw.distanceM * (1 + (mod.tw - 1) * 0.05);
  const timeS    = raw.durationS * (1 + (mod.tw - 1) * 0.10);
  const speedKmh = Math.min(distM / 1000 / (timeS / 3600), spd.max);
  return { ...raw, distM, timeS, speedKmh };
}

export function parseOSRMSteps(legs) {
  if (!legs?.[0]?.steps) return [];
  return legs[0].steps.map(step => {
    const m = step.maneuver;
    const modifier = m.modifier || '';
    const name = step.name || 'Tiếp tục';
    const dist = step.distance;
    let dir = 'straight', label = 'Đi thẳng';
    if (m.type === 'depart')               { dir = 'start';       label = 'Xuất phát';       }
    else if (m.type === 'arrive')          { dir = 'dest';        label = 'Đến nơi';          }
    else if (modifier.includes('uturn'))   { dir = 'uTurn';       label = 'Quay đầu xe';      }
    else if (modifier === 'left')          { dir = 'turnLeft';    label = 'Rẽ trái';          }
    else if (modifier === 'right')         { dir = 'turnRight';   label = 'Rẽ phải';          }
    else if (modifier === 'slight left')   { dir = 'slightLeft';  label = 'Nghiêng trái nhẹ'; }
    else if (modifier === 'slight right')  { dir = 'slightRight'; label = 'Nghiêng phải nhẹ'; }
    else if (modifier === 'sharp left')    { dir = 'turnLeft';    label = 'Rẽ trái gấp';      }
    else if (modifier === 'sharp right')   { dir = 'turnRight';   label = 'Rẽ phải gấp';      }
    else if (m.type === 'roundabout')      { dir = 'turnRight';   label = 'Vào vòng xoay';    }
    return { dir, label, name, dist };
  });
}

export function buildMockRoute(from, to, criteria, vehicle) {
  const R = 6371000;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat   * Math.PI / 180;
  const dlat = (to.lat - from.lat) * Math.PI / 180;
  const dlng = (to.lng - from.lng) * Math.PI / 180;
  const a = Math.sin(dlat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlng/2)**2;
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const mod = CRITERIA_MODIFIERS[criteria];
  const spd = VEHICLE_SPEEDS[vehicle];
  const distM = straight * (1.3 + mod.tw * 0.12);
  const timeS = (distM / 1000) / spd.avg * 3600;
  const mid = {
    lat: (from.lat + to.lat) / 2 + (Math.random() - 0.5) * 0.008,
    lng: (from.lng + to.lng) / 2 + (Math.random() - 0.5) * 0.008,
  };
  return {
    distM, timeS, speedKmh: spd.avg,
    coordinates: [[from.lat,from.lng],[mid.lat,mid.lng],[to.lat,to.lng]],
    isMock: true,
    steps: buildMockSteps(distM, to.label),
  };
}

function buildMockSteps(distM, toLabel) {
  const segCount = Math.max(3, Math.min(8, Math.round(distM/1000/0.5)));
  const steps = [];
  const dirPool = [
    {dir:'straight',label:'Đi thẳng'},{dir:'turnLeft',label:'Rẽ trái'},
    {dir:'turnRight',label:'Rẽ phải'},{dir:'slightLeft',label:'Nghiêng trái nhẹ'},
    {dir:'slightRight',label:'Nghiêng phải nhẹ'},
  ];
  const used = new Set();
  const pick = () => {
    let n; do { n = ROAD_NAMES[Math.floor(Math.random()*ROAD_NAMES.length)]; } while(used.has(n));
    used.add(n); return n;
  };
  steps.push({dir:'start',label:'Xuất phát',name:pick(),dist:Math.round(distM*0.15)});
  let rem = distM * 0.80;
  for(let i=0;i<segCount-2;i++){
    const seg=rem/(segCount-1-i);
    const d=dirPool[Math.floor(Math.random()*dirPool.length)];
    steps.push({dir:d.dir,label:d.label,name:pick(),dist:Math.round(seg)});
    rem-=seg;
  }
  steps.push({dir:'dest',label:'Đến nơi',name:toLabel||'Điểm đến',dist:0});
  return steps;
}