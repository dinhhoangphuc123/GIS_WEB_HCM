// App.jsx — Global state, kết nối tất cả component

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar       from './components/Sidebar.jsx';
import MapView       from './components/MapView.jsx';
import RouteInfo     from './components/RouteInfo.jsx';
import RoadInfoPanel from './components/RoadInfoPanel.jsx';
import Loading       from './components/Loading.jsx';
import { IconMenu, IconChevronRight } from './utils/icons.jsx';
import { API_URL } from './config.js';

// ── Toast hook ────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'default') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);
  return { toasts, showToast };
}

export default function App() {
  // ── Route state ──────────────────────────────────────────────────────────────
  const [from, setFrom] = useState({ label: '', lat: null, lng: null });
  const [to,   setTo]   = useState({ label: '', lat: null, lng: null });
  const [vehicle,  setVehicle]  = useState('motorbike');
  const [criteria, setCriteria] = useState('shortest');
  const [layers,   setLayers]   = useState({ roads: false, traffic: false, accident: false, signs: false });

  const [loading,      setLoading]      = useState(false);
  const [routeResult,  setRouteResult]  = useState(null);
  const [triggerRoute, setTriggerRoute] = useState(false);
  const [collapsed,    setCollapsed]    = useState(false);

  const [currentStep,   setCurrentStep]   = useState(0);
  const [liveRemaining, setLiveRemaining] = useState(null);

  // ── Selected algorithm when dual results differ ───────────────────────────────
  const [selectedAlgorithmRoute, setSelectedAlgorithmRoute] = useState(null);

  // ── Map mode: 'route' | 'info' ───────────────────────────────────────────────
  const [mapMode, setMapMode] = useState('route');

  // ── Road info state ──────────────────────────────────────────────────────────
  const [roadInfoLoading, setRoadInfoLoading] = useState(false);
  const [roadInfoData,    setRoadInfoData]    = useState(null);

  const clickTargetRef = useRef('from');
  const { toasts, showToast } = useToast();

  // ── DB Status check khi khởi động ────────────────────────────────────────────
  const [dbStatus, setDbStatus] = useState(null); // null=checking, true=ok, false=error
  const [dbInfo,   setDbInfo]   = useState('');

  useEffect(() => {
    // Kiểm tra kết nối DB ngay khi app load
    fetch(`${API_URL}/api/db-status`, { signal: AbortSignal.timeout(6000) })
      .then(r => r.json())
      .then(data => {
        if (data.connected) {
          const { counts = {}, geom_counts = {} } = data;
          const summary = [
            counts.roads       != null ? `${counts.roads} đường`        : '',
            geom_counts.accidents  != null ? `${geom_counts.accidents} tai nạn` : '',
            geom_counts.traffic_signs != null ? `${geom_counts.traffic_signs} biển báo` : '',
          ].filter(Boolean).join(' · ');
          setDbStatus(true);
          setDbInfo(summary);
          showToast(` Database nckh_hcm: ${summary}`, 'success');
        } else {
          setDbStatus(false);
          setDbInfo(data.error || 'Không kết nối được');
          showToast(' Database chưa kết nối! Xem hướng dẫn bên dưới.', 'error');
        }
      })
      .catch(() => {
        setDbStatus(false);
        setDbInfo(`Backend chưa chạy (${API_URL})`);
        showToast(' Backend chưa chạy! Hãy chạy start_backend.bat', 'warning');
      });
  }, []); // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleMapClick = useCallback((latlng, forceField = null) => {
    const label = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    const field = forceField || clickTargetRef.current;
    const loc   = { label, lat: latlng.lat, lng: latlng.lng };
    if (field === 'from') { setFrom(loc); clickTargetRef.current = 'to'; }
    else                  { setTo(loc);   clickTargetRef.current = 'from'; }
  }, []);

  const handleFromChange = useCallback(val => {
    setFrom(val);
    if (val.lat) clickTargetRef.current = 'to';
  }, []);

  const handleToChange = useCallback(val => {
    setTo(val);
    if (val.lat) clickTargetRef.current = 'from';
  }, []);

  const handleLayerToggle = useCallback(type => {
    setLayers(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const handleFindRoute = useCallback(() => {
    if (!from?.lat || !to?.lat) {
      showToast('Vui lòng chọn điểm xuất phát và điểm đến', 'warning');
      return;
    }
    setRouteResult(null);
    setCurrentStep(0);
    setLiveRemaining(null);
    setSelectedAlgorithmRoute(null);  // reset khi tìm đường mới
    setTriggerRoute(true);
    // Tự động chuyển về route mode khi tìm đường
    setMapMode('route');
  }, [from, to, showToast]);

  // Người dùng chọn 1 trong 2 thuật toán khi kết quả khác nhau
  const handleSelectAlgorithm = useCallback((chosenRoute) => {
    // chosenRoute: { dijkstra|astar data normalised }
    setSelectedAlgorithmRoute(chosenRoute);
    setRouteResult({
      ...chosenRoute,
      isDualResult: false,
    });
  }, []);

  const handleRouteDone        = useCallback(() => setTriggerRoute(false), []);
  const handleCollapse         = useCallback(() => setCollapsed(v => !v), []);
  const handleStepAdvance      = useCallback(idx => setCurrentStep(idx), []);
  const handleLiveRemaining    = useCallback(val => setLiveRemaining(val), []);
  const handleStepChange       = useCallback(idx => setCurrentStep(idx), []);

  const handleCloseRoadInfo    = useCallback(() => { setRoadInfoData(null); setRoadInfoLoading(false); }, []);

  // Toggle mode route ↔ info
  const handleToggleMode = useCallback((forceTo) => {
    const next = forceTo || (mapMode === 'route' ? 'info' : 'route');
    if (next === mapMode) return; // đã đúng mode, không làm gì
    setMapMode(next);
    if (next === 'route') { setRoadInfoData(null); setRoadInfoLoading(false); }
    showToast(
      next === 'info'
        ? ' Chế độ xem thông tin đường — Click lên bản đồ'
        : ' Chế độ tìm đường — Click để chọn điểm đi/đến',
      'default'
    );
  }, [showToast, mapMode]);

  return (
    <div className="app-shell">

      {/* DB Status Banner — chỉ hiện khi DB lỗi */}
      {dbStatus === false && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#dc2626', color: 'white',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontSize: 18 }}>❌</span>
          <span>
            Database chưa kết nối: <code style={{ background:'rgba(0,0,0,0.2)', padding:'1px 6px', borderRadius:3 }}>{dbInfo}</code>
          </span>
          <span style={{ marginLeft: 'auto', opacity: 0.85, fontSize: 12, fontWeight: 400 }}>
             Chạy <strong>KIEM_TRA_DATABASE.bat</strong> để fix tự động
          </span>
        </div>
      )}

      {/* Padding khi có banner */}
      {dbStatus === false && <div style={{ height: 42 }} />}

      {/* Sidebar + toggle tab */}
      <div style={{ position:'relative', display:'flex', flexShrink:0 }}>
        <Sidebar
          from={from}           onFromChange={handleFromChange}
          to={to}               onToChange={handleToChange}
          vehicle={vehicle}     onVehicleChange={setVehicle}
          criteria={criteria}   onCriteriaChange={setCriteria}
          layers={layers}       onLayerToggle={handleLayerToggle}
          onFindRoute={handleFindRoute}
          loading={loading}
          collapsed={collapsed}
          onToggleCollapse={handleCollapse}
          mapMode={mapMode}
          onToggleMode={handleToggleMode}
        />

        {/* Tab mở/đóng sidebar */}
        <button
          onClick={handleCollapse}
          title={collapsed ? 'Mở sidebar' : 'Đóng sidebar'}
          style={{
            position:'absolute', top:20, right:-32, zIndex:1001,
            width:32, height:56,
            border:'1px solid var(--gray-200)', borderLeft:'none',
            borderRadius:'0 10px 10px 0',
            background:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'3px 0 10px rgba(0,0,0,.07)',
            transition:'background var(--ease)',
          }}
          onMouseEnter={e => e.currentTarget.style.background='var(--pink-50)'}
          onMouseLeave={e => e.currentTarget.style.background='#fff'}
        >
          {collapsed
            ? <IconChevronRight size={15} color="var(--primary)"/>
            : <IconMenu         size={15} color="var(--gray-500)"/>
          }
        </button>
      </div>

      {/* Map area */}
      <div className="map-container">
        {/* Badge trạng thái */}
        <div className="map-badge">
          <div className="map-badge-dot"/>
          OpenStreetMap · Live
        </div>

        {/* Badge mode hiện tại */}
        <div style={{
          position:'absolute', top:12, left:'50%', transform:'translateX(-50%)',
          zIndex:900, display:'flex', gap:0,
          background:'#fff', border:'1px solid #e5e7eb',
          borderRadius:10, overflow:'hidden',
          boxShadow:'0 2px 8px rgba(0,0,0,.1)',
        }}>
          {[
            { key:'route', label:' Tìm đường' },
            { key:'info',  label:' Thông tin đường' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                if (mapMode !== key) handleToggleMode(key);
              }}
              style={{
                border:'none', padding:'7px 14px',
                fontSize:12, fontWeight:600, cursor:'pointer',
                background: mapMode === key
                  ? 'linear-gradient(135deg,#ec4899,#be185d)'
                  : 'transparent',
                color: mapMode === key ? '#fff' : '#6b7280',
                transition:'all .2s',
              }}
            >{label}</button>
          ))}
        </div>

        <MapView
          from={from} to={to}
          layers={layers}
          vehicle={vehicle} criteria={criteria}
          onMapClick={handleMapClick}
          onRouteResult={setRouteResult}
          onLoadingChange={setLoading}
          triggerRoute={triggerRoute}
          onRouteDone={handleRouteDone}
          showToast={showToast}
          onStepAdvance={handleStepAdvance}
          onLiveRemaining={handleLiveRemaining}
          mapMode={mapMode}
          onRoadInfoLoading={setRoadInfoLoading}
          onRoadInfoData={setRoadInfoData}
          selectedAlgorithmRoute={selectedAlgorithmRoute}
        />

        <Loading show={loading}/>

        {/* Road Info Panel — hiện khi mode info */}
        {mapMode === 'info' && (roadInfoLoading || roadInfoData) && (
          <RoadInfoPanel
            data={roadInfoData}
            loading={roadInfoLoading}
            onClose={handleCloseRoadInfo}
          />
        )}

        {/* Route Info Panel — hiện khi có kết quả tìm đường */}
        {mapMode === 'route' && (
          <RouteInfo
            result={routeResult}
            onClose={() => { setRouteResult(null); setLiveRemaining(null); setSelectedAlgorithmRoute(null); }}
            currentStep={currentStep}
            onStepChange={handleStepChange}
            liveRemaining={liveRemaining}
            onSelectAlgorithm={handleSelectAlgorithm}
          />
        )}
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}