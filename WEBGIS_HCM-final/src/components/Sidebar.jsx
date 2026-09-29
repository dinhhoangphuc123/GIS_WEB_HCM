// components/Sidebar.jsx
// Panel trái: form nhập điểm đi/đến, autocomplete, chọn xe, tiêu chí, layer toggle, nút tìm đường.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CRITERIA_LIST } from '../utils/routeMock.js';
import { searchPlaces }  from '../services/geocodeService.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import LayerToggle from './LayerToggle.jsx';

import {
  IconMotorbike, IconCar, IconWalk, IconBus,
  IconMapPinPlus, IconMapPinned,
  IconNavigation, IconSearch,
  IconMenu, IconChevronRight,
} from '../utils/icons.jsx';

const VEHICLES = [
  { key: 'motorbike', Icon: IconMotorbike, label: 'Xe máy'  },
  { key: 'car',       Icon: IconCar,       label: 'Ô tô'    },
  { key: 'walk',      Icon: IconWalk,      label: 'Đi bộ'   },
  { key: 'bus',       Icon: IconBus,       label: 'Xe buýt' },
];

function AcDropdown({ results, onSelect, isEnd }) {
  if (!results.length) return null;
  return (
    <div style={{
      position:'absolute', top:'calc(100% + 4px)', left:-36, right:-38,
      background:'#fff', border:'1px solid var(--gray-200)',
      borderRadius:'var(--r-md)', boxShadow:'var(--sh-lg)', zIndex:9999, overflow:'hidden',
    }}>
      {results.map(p => (
        <div key={p.id} onMouseDown={() => onSelect(p)}
          style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'9px 12px', cursor:'pointer',
            borderBottom:'1px solid var(--gray-100)', transition:'background var(--ease)',
          }}
          onMouseEnter={e => e.currentTarget.style.background='var(--pink-50)'}
          onMouseLeave={e => e.currentTarget.style.background='#fff'}
        >
          <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
            background: isEnd ? 'var(--red)' : 'var(--primary)' }}/>
          <div>
            <div style={{ fontSize:12.5, fontWeight:500, color:'var(--gray-900)' }}>{p.name}</div>
            <div style={{ fontSize:11, color:'var(--gray-400)' }}>{p.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LocationRow({ id, value, placeholder, isEnd, onChange, onKeyDown, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', position:'relative' }}>
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', width:20 }}>
        {isEnd
          ? <IconMapPinned  size={18} color="var(--red)"     />
          : <IconMapPinPlus size={18} color="var(--primary)" />
        }
      </div>
      <div style={{ flex:1, position:'relative', minWidth:0 }}>
        <input
          id={id} value={value} onChange={onChange} onKeyDown={onKeyDown}
          placeholder={placeholder} autoComplete="off"
          style={{ width:'100%', border:'none', background:'transparent',
            fontSize:13, color:'var(--gray-900)', outline:'none', fontFamily:'var(--font)' }}
        />
        {children}
      </div>
    </div>
  );
}

// Icon Info đường
const IconInfoRoad = ({ size=16, color='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l3-10 3 5 3-7 3 7 3-5 3 10"/><line x1="3" y1="17" x2="21" y2="17"/>
  </svg>
);

export default function Sidebar({
  from, to, onFromChange, onToChange,
  vehicle, onVehicleChange,
  criteria, onCriteriaChange,
  layers, onLayerToggle,
  onFindRoute, loading,
  collapsed, onToggleCollapse,
  mapMode, onToggleMode,
}) {
  const { getCurrentPosition, loading: gpsLoading } = useGeolocation();
  const [fromResults, setFromResults] = useState([]);
  const [toResults,   setToResults]   = useState([]);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen,   setToOpen]   = useState(false);
  const fromTimerRef = useRef(null);
  const toTimerRef   = useRef(null);
  const fromWrapRef  = useRef(null);
  const toWrapRef    = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (fromWrapRef.current && !fromWrapRef.current.contains(e.target)) setFromOpen(false);
      if (toWrapRef.current   && !toWrapRef.current.contains(e.target))   setToOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFromInput = useCallback(e => {
    const val = e.target.value;
    onFromChange({ label:val, lat:null, lng:null });
    clearTimeout(fromTimerRef.current);
    if (!val.trim()) { setFromOpen(false); return; }
    fromTimerRef.current = setTimeout(async () => {
      const res = await searchPlaces(val);
      setFromResults(res); setFromOpen(res.length > 0);
    }, 130);
  }, [onFromChange]);

  const handleToInput = useCallback(e => {
    const val = e.target.value;
    onToChange({ label:val, lat:null, lng:null });
    clearTimeout(toTimerRef.current);
    if (!val.trim()) { setToOpen(false); return; }
    toTimerRef.current = setTimeout(async () => {
      const res = await searchPlaces(val);
      setToResults(res); setToOpen(res.length > 0);
    }, 130);
  }, [onToChange]);

  const selectFrom = p => { onFromChange({ label:p.name, lat:p.lat, lng:p.lng }); setFromOpen(false); };
  const selectTo   = p => { onToChange({ label:p.name, lat:p.lat, lng:p.lng });   setToOpen(false);   };

  const handleGps = async () => {
    const pos = await getCurrentPosition();
    onFromChange({ label:pos.label, lat:pos.lat, lng:pos.lng }); setFromOpen(false);
  };

  const handleSwap = () => {
    const tmp = { ...from }; onFromChange({ ...to }); onToChange({ ...tmp });
  };

  const handleKeyDown = e => { if (e.key === 'Enter') onFindRoute(); };
  const canFind = from?.lat && to?.lat;
  const isInfoMode = mapMode === 'info';

  const S = {
    sidebar: {
      width: collapsed ? 0 : 'var(--sidebar-w)',
      minWidth: collapsed ? 0 : 'var(--sidebar-w)',
      height:'100vh', background:'#fff',
      borderRight: collapsed ? 'none' : '1px solid var(--gray-200)',
      display:'flex', flexDirection:'column', zIndex:900,
      boxShadow: collapsed ? 'none' : 'var(--sh-md)',
      overflow:'hidden',
      transition:'width .3s ease, min-width .3s ease, box-shadow .3s ease',
    },
    header:{
      padding:'16px 16px 14px', borderBottom:'1px solid var(--gray-100)',
      display:'flex', alignItems:'center', gap:10, flexShrink:0,
    },
    logoIcon:{
      width:36, height:36, borderRadius:10,
      background:'linear-gradient(135deg,var(--pink-500),var(--pink-700))',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    },
    body:{
      flex:1, overflowY:'auto', overflowX:'hidden',
      padding:14, display:'flex', flexDirection:'column', gap:12,
    },
    locStack:{
      background:'var(--gray-50)', border:'1.5px solid var(--gray-200)',
      borderRadius:'var(--r-md)', overflow:'visible', position:'relative',
    },
    vehicleGrid:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 },
    findBtn:{
      margin:'0 14px 14px', width:'calc(100% - 28px)', padding:12,
      border:'none', borderRadius:'var(--r-md)',
      background: canFind && !loading && !isInfoMode
        ? 'linear-gradient(135deg,var(--pink-500),var(--pink-700))'
        : 'var(--gray-200)',
      color: canFind && !loading && !isInfoMode ? '#fff' : 'var(--gray-400)',
      fontFamily:'var(--font-d)', fontSize:13.5, fontWeight:600,
      cursor: canFind && !loading && !isInfoMode ? 'pointer' : 'not-allowed',
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      boxShadow: canFind && !loading && !isInfoMode ? 'var(--sh-pink)' : 'none',
      transition:'all var(--ease)', flexShrink:0,
    },
    infoModeBtn:{
      margin:'0 14px 8px', width:'calc(100% - 28px)', padding:10,
      border:'2px solid',
      borderColor: isInfoMode ? '#7c3aed' : 'var(--gray-200)',
      borderRadius:'var(--r-md)',
      background: isInfoMode ? '#f5f3ff' : '#fff',
      color: isInfoMode ? '#7c3aed' : 'var(--gray-500)',
      fontFamily:'var(--font-d)', fontSize:12.5, fontWeight:600,
      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
      transition:'all var(--ease)', flexShrink:0,
    },
  };

  return (
    <aside style={S.sidebar}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoIcon}><IconMapPinned size={18} color="white"/></div>
        <div style={{ overflow:'hidden', flex:1 }}>
          <div style={{ fontFamily:'var(--font-d)', fontSize:17, fontWeight:700, letterSpacing:'-.3px', lineHeight:1 }}>
            Route<span style={{ color:'var(--primary)' }}>IQ</span>
          </div>
          <div style={{ fontSize:10.5, color:'var(--gray-400)', marginTop:2 }}>
            Bản đồ thông minh · TPHCM
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>

        {/* MODE SWITCH banner */}
        <div style={{
          background: isInfoMode ? '#f5f3ff' : 'var(--pink-50)',
          border:`1.5px solid ${isInfoMode ? '#ddd6fe' : 'var(--pink-200)'}`,
          borderRadius:'var(--r-sm)', padding:'8px 10px',
          display:'flex', alignItems:'center', gap:8,
        }}>
          <div style={{ fontSize:18 }}>{isInfoMode ? '🗺️' : '🧭'}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11.5, fontWeight:700,
              color: isInfoMode ? '#7c3aed' : 'var(--primary)' }}>
              {isInfoMode ? 'Chế độ: Thông tin đường' : 'Chế độ: Tìm đường'}
            </div>
            <div style={{ fontSize:10.5, color:'var(--gray-400)', marginTop:1 }}>
              {isInfoMode ? 'Click bất kỳ đâu trên bản đồ' : 'Nhập địa chỉ hoặc click bản đồ'}
            </div>
          </div>
        </div>

        {/* LOCATION */}
        <div>
          <div className="section-label">Hành trình</div>
          <div style={{ ...S.locStack, opacity: isInfoMode ? 0.5 : 1, pointerEvents: isInfoMode ? 'none' : 'auto' }}>
            <div ref={fromWrapRef}>
              <LocationRow id="inp-from" value={from?.label || ''} placeholder="Điểm xuất phát"
                isEnd={false} onChange={handleFromInput} onKeyDown={handleKeyDown}>
                {fromOpen && <AcDropdown results={fromResults} onSelect={selectFrom} isEnd={false}/>}
              </LocationRow>
            </div>
            <div style={{ position:'relative', height:0, zIndex:1 }}>
              <button onClick={handleSwap} title="Đảo chiều"
                style={{
                  position:'absolute', right:10, top:-13, width:26, height:26,
                  borderRadius:'50%', border:'1.5px solid var(--gray-200)',
                  background:'#fff', color:'var(--gray-400)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, boxShadow:'var(--sh-xs)', transition:'all var(--ease)', zIndex:10,
                }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--pink-50)';e.currentTarget.style.color='var(--primary)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='var(--gray-400)'}}
              >⇅</button>
            </div>
            <div ref={toWrapRef} style={{ borderTop:'1px solid var(--gray-200)', marginTop:1 }}>
              <LocationRow id="inp-to" value={to?.label || ''} placeholder="Điểm đến"
                isEnd={true} onChange={handleToInput} onKeyDown={handleKeyDown}>
                {toOpen && <AcDropdown results={toResults} onSelect={selectTo} isEnd={true}/>}
              </LocationRow>
            </div>
            <div style={{ padding:'6px 12px', borderTop:'1px solid var(--gray-100)' }}>
              <button onClick={handleGps} disabled={gpsLoading}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  border:'none', background:'transparent',
                  color: gpsLoading ? 'var(--gray-300)' : 'var(--primary)',
                  cursor: gpsLoading ? 'not-allowed' : 'pointer',
                  fontSize:11.5, fontWeight:600, padding:0, fontFamily:'var(--font)',
                }}>
                <IconNavigation size={13} color={gpsLoading ? 'var(--gray-300)' : 'var(--primary)'}/>
                {gpsLoading ? 'Đang lấy vị trí…' : 'Dùng vị trí hiện tại'}
              </button>
            </div>
          </div>
        </div>

        <div className="divider"/>

        {/* VEHICLE */}
        <div style={{ opacity: isInfoMode ? 0.4 : 1, pointerEvents: isInfoMode ? 'none' : 'auto' }}>
          <div className="section-label">Phương tiện</div>
          <div style={S.vehicleGrid}>
            {VEHICLES.map(({ key, Icon, label }) => {
              const active = vehicle === key;
              return (
                <button key={key} onClick={() => onVehicleChange(key)}
                  style={{
                    border:`1.5px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`,
                    borderRadius:'var(--r-sm)', background: active ? 'var(--pink-50)' : '#fff',
                    padding:'9px 4px 7px', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                    boxShadow: active ? '0 0 0 3px rgba(236,72,153,.1)' : 'none',
                    transition:'all var(--ease)',
                  }}>
                  <Icon size={22} color={active ? 'var(--primary)' : 'var(--gray-400)'}/>
                  <span style={{ fontSize:10, fontWeight:600,
                    color: active ? 'var(--primary)' : 'var(--gray-500)' }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="divider"/>

        {/* CRITERIA */}
        <div style={{ opacity: isInfoMode ? 0.4 : 1, pointerEvents: isInfoMode ? 'none' : 'auto' }}>
          <div className="section-label">Tiêu chí tối ưu</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {CRITERIA_LIST.map(c => {
              const active = criteria === c.key;
              return (
                <div key={c.key} onClick={() => onCriteriaChange(c.key)}
                  style={{
                    display:'flex', alignItems:'center', gap:9, padding:'8px 11px',
                    border:`1.5px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`,
                    borderRadius:'var(--r-sm)', background: active ? 'var(--pink-50)' : '#fff',
                    cursor:'pointer', transition:'all var(--ease)',
                  }}>
                  <div style={{
                    width:15, height:15, borderRadius:'50%',
                    border:`2px solid ${active ? 'var(--primary)' : 'var(--gray-300)'}`,
                    flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {active && <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--primary)' }}/>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12.5, fontWeight:600,
                      color: active ? 'var(--primary)' : 'var(--gray-700)' }}>{c.name}</div>
                    <div style={{ fontSize:10.5, color:'var(--gray-400)' }}>{c.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="divider"/>

        {/* LAYER TOGGLE */}
        <LayerToggle layers={layers} onToggle={onLayerToggle}/>

      </div>

      {/* Info mode toggle button */}
      <button style={S.infoModeBtn} onClick={onToggleMode}>
        <IconInfoRoad size={15} color={isInfoMode ? '#7c3aed' : 'var(--gray-500)'}/>
        {isInfoMode ? '← Quay lại tìm đường' : ' Xem thông tin tuyến đường'}
      </button>

      {/* Find route button */}
      <button style={S.findBtn}
        onClick={onFindRoute}
        disabled={!canFind || loading || isInfoMode}>
        <IconSearch size={16} color={canFind && !loading && !isInfoMode ? '#fff' : 'var(--gray-400)'}/>
        {loading ? 'Đang tính…' : 'Tìm đường tối ưu'}
      </button>
    </aside>
  );
}


