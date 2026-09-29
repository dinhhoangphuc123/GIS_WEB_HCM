/**
 * graphSearch.js
 * Triển khai Dijkstra và A* thuần JavaScript trên tập toạ độ (lat/lng).
 *
 * Input: mảng coords [[lat,lng], ...] từ OSRM hoặc backend.
 * Graph: mỗi điểm kết nối với các điểm lân cận trong bán kính kết nối.
 * Output: { path, distanceM, durationS, coordinates }
 *
 * Lưu ý: Đây là demo so sánh thuật toán trên cùng tập node —
 * Dijkstra bảo đảm optimal; A* dùng heuristic euclid nên có thể chọn
 * đường khác khi đồ thị có nhiều nhánh tương đương.
 */

import { VEHICLE_SPEEDS } from './routeMock.js';

// ── Haversine distance (metres) ───────────────────────────────────────────────
export function haversine(a, b) {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aa = sinLat * sinLat +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

// ── Xây đồ thị từ mảng coords ─────────────────────────────────────────────────
// Mỗi node kết nối với node liền kề (index ±1) và các node trong bán kính gần
function buildGraph(coords, connectRadius = 150) {
  const n = coords.length;
  const adj = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    // Kết nối tuần tự (đường chính)
    if (i + 1 < n) {
      const d = haversine(coords[i], coords[i + 1]);
      adj[i].push({ to: i + 1, cost: d });
      adj[i + 1].push({ to: i, cost: d });
    }
    // Kết nối cross nếu gần nhau (nhánh phụ / shortcut)
    for (let j = i + 2; j < n; j++) {
      const d = haversine(coords[i], coords[j]);
      if (d < connectRadius) {
        adj[i].push({ to: j, cost: d });
        adj[j].push({ to: i, cost: d });
      }
    }
  }
  return adj;
}

// ── Min-Heap (Priority Queue) ─────────────────────────────────────────────────
class MinHeap {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].f <= this.heap[i].f) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].f < this.heap[min].f) min = l;
      if (r < n && this.heap[r].f < this.heap[min].f) min = r;
      if (min === i) break;
      [this.heap[min], this.heap[i]] = [this.heap[i], this.heap[min]];
      i = min;
    }
  }
}

// ── Dijkstra ──────────────────────────────────────────────────────────────────
export function dijkstra(adj, src, dst) {
  const n = adj.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  dist[src] = 0;

  const pq = new MinHeap();
  pq.push({ f: 0, node: src });

  while (pq.size > 0) {
    const { f, node } = pq.pop();
    if (f > dist[node]) continue;
    if (node === dst) break;

    for (const { to, cost } of adj[node]) {
      const nd = dist[node] + cost;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = node;
        pq.push({ f: nd, node: to });
      }
    }
  }

  if (dist[dst] === Infinity) return null;
  // Truy vết đường
  const path = [];
  for (let cur = dst; cur !== -1; cur = prev[cur]) path.unshift(cur);
  return { path, totalCost: dist[dst] };
}

// ── A* ────────────────────────────────────────────────────────────────────────
export function aStar(adj, coords, src, dst) {
  const n = adj.length;
  const g = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  g[src] = 0;

  const h = (i) => haversine(coords[i], coords[dst]);

  const pq = new MinHeap();
  pq.push({ f: h(src), node: src });

  while (pq.size > 0) {
    const { node } = pq.pop();
    if (node === dst) break;

    for (const { to, cost } of adj[node]) {
      const ng = g[node] + cost;
      if (ng < g[to]) {
        g[to] = ng;
        prev[to] = node;
        pq.push({ f: ng + h(to), node: to });
      }
    }
  }

  if (g[dst] === Infinity) return null;
  const path = [];
  for (let cur = dst; cur !== -1; cur = prev[cur]) path.unshift(cur);
  return { path, totalCost: g[dst] };
}

// ── Tính tổng khoảng cách của path ───────────────────────────────────────────
function pathDistance(path, coords) {
  let d = 0;
  for (let i = 0; i < path.length - 1; i++) {
    d += haversine(coords[path[i]], coords[path[i + 1]]);
  }
  return d;
}

// ── Tạo steps đơn giản từ path ────────────────────────────────────────────────
function buildSteps(pathCoords, from, to) {
  const steps = [];
  const dirs   = ['straight', 'turnRight', 'turnLeft', 'slightRight', 'slightLeft'];
  const labels = ['Đi thẳng',  'Rẽ phải',   'Rẽ trái',  'Nghiêng phải', 'Nghiêng trái'];

  steps.push({ dir: 'start', label: 'Xuất phát', name: from?.label || 'Điểm xuất phát', dist: 0 });

  const segCount = Math.min(4, Math.max(1, Math.floor(pathCoords.length / 3)));
  const totalDist = pathDistance(Array.from({ length: pathCoords.length }, (_, i) => i), pathCoords);
  const segDist = Math.round(totalDist / (segCount + 1));

  for (let i = 1; i <= segCount; i++) {
    const pick = i % dirs.length;
    steps.push({ dir: dirs[pick], label: labels[pick], name: '', dist: segDist });
  }

  steps.push({ dir: 'dest', label: 'Đến nơi', name: to?.label || 'Điểm đến', dist: 0 });
  return steps;
}

// ── API chính: so sánh Dijkstra vs A* trên tập coords ────────────────────────
/**
 * compareOnCoords(coords, from, to, vehicle)
 *   coords: [[lat,lng], ...]  — tuyến đường gốc từ OSRM/backend
 *   Trả về { same, diffPct, dijkstra?, astar?, route? }
 */
export function compareOnCoords(coords, from, to, vehicle) {
  if (!coords || coords.length < 3) return null;

  // Giảm độ phân giải để đồ thị không quá lớn (tối đa 200 node)
  const MAX_NODES = 200;
  let pts = coords;
  if (pts.length > MAX_NODES) {
    const step = Math.ceil(pts.length / MAX_NODES);
    pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  }

  const adj = buildGraph(pts, 200);
  const src = 0, dst = pts.length - 1;

  const dResult = dijkstra(adj, src, dst);
  const aResult = aStar(adj, pts, src, dst);

  if (!dResult || !aResult) return null;

  const spd = VEHICLE_SPEEDS[vehicle] || VEHICLE_SPEEDS.motorbike;

  const dCoords = dResult.path.map(i => pts[i]);
  const aCoords = aResult.path.map(i => pts[i]);

  const dDist = pathDistance(dResult.path, pts);
  const aDist = pathDistance(aResult.path, pts);

  const diffPct = Math.abs(dDist - aDist) / Math.max(dDist, 1) * 100;

  // So sánh path overlap (% node dùng chung / tổng unique)
  const dSet = new Set(dResult.path);
  const aSet = new Set(aResult.path);
  const inter = [...dSet].filter(x => aSet.has(x)).length;
  const union = new Set([...dSet, ...aSet]).size;
  const overlapPct = (inter / union) * 100;

  const same = diffPct <= 1.5 && overlapPct >= 85;

  const mkRoute = (pathCoords, dist, algoName) => ({
    distanceM:   Math.round(dist),
    durationS:   Math.round((dist / 1000) / spd.avg * 3600),
    speedKmh:    spd.avg,
    coordinates: pathCoords,
    steps:       buildSteps(pathCoords, from, to),
    roadNames:   [],
    isMock:      false,
    source:      algoName,
    distM:       Math.round(dist),
    timeS:       Math.round((dist / 1000) / spd.avg * 3600),
  });

  if (same) {
    return {
      same: true,
      diffPct: +diffPct.toFixed(2),
      overlapPct: +overlapPct.toFixed(1),
      route: mkRoute(dCoords, dDist, 'dijkstra'),
    };
  }

  return {
    same: false,
    diffPct: +diffPct.toFixed(2),
    roadOverlap: +overlapPct.toFixed(1),
    dijkstra: mkRoute(dCoords, dDist, 'dijkstra'),
    astar:    mkRoute(aCoords, aDist, 'astar'),
  };
}
