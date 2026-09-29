// components/RoadInfoPanel.jsx
// Panel hiển thị thông tin tuyến đường khi user click lên bản đồ.
// Dữ liệu từ API /api/road-info (backend Flask + PostGIS).

import React, { useState } from 'react';

// ── Icons nhỏ inline ──────────────────────────────────────────────────────────
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconRoad = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 17l3-10 3 5 3-7 3 7 3-5 3 10"/><line x1="3" y1="17" x2="21" y2="17"/>
  </svg>
);
const IconWarning = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconInfo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconTraffic = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="5" y="2" width="14" height="20" rx="2"/>
    <circle cx="12" cy="7" r="2" fill="#ef4444" stroke="none"/>
    <circle cx="12" cy="12" r="2" fill="#f59e0b" stroke="none"/>
    <circle cx="12" cy="17" r="2" fill="#22c55e" stroke="none"/>
  </svg>
);
const IconConstruct = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
const IconSign = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="12" rx="2"/>
    <line x1="12" y1="15" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>
  </svg>
);

// ── Nhóm hiển thị các trường ─────────────────────────────────────────────────
const GROUPS = [
  {
    key: 'accident',
    title: 'Tai nạn giao thông',
    icon: <IconWarning />,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    fields: ['Tần suất tai nạn','Loại tai nạn','Mức độ nghiêm trọng','Khung giờ xảy ra tai nạn'],
  },
  {
    key: 'traffic',
    title: 'Tình trạng giao thông',
    icon: <IconTraffic />,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    fields: ['Khung giờ kẹt xe','Mức độ ùn tắc','Phương tiện chủ yếu'],
  },
  {
    key: 'infra',
    title: 'Cơ sở hạ tầng',
    icon: <IconConstruct />,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    fields: ['Địa hình','Số làn đường','Chiều lưu thông','Chiều dài đoạn (m)','Chiều rộng (m)',
             'Tốc độ tối thiểu (km/h)','Tốc độ tối đa (km/h)','Điều kiện đường','Tình trạng mặt đường'],
  },
  {
    key: 'env',
    title: 'Môi trường đường',
    icon: <IconInfo />,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    fields: ['Ánh sáng','Mức độ ngập','Ổ gà','Số giao lộ','Gần ngã tư'],
  },
  {
    key: 'sign',
    title: 'Biển báo',
    icon: <IconSign />,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    fields: ['Loại biển báo','Phương tiện áp dụng'],
  },
];

// ── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ value }) {
  const map = {
    'Nặng':      { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
    'Trung bình':{ bg:'#fffbeb', color:'#d97706', border:'#fde68a' },
    'Nhẹ':       { bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
    'Ngập cao':  { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
    'Ngập trung bình':{ bg:'#fffbeb', color:'#d97706', border:'#fde68a' },
    'Ngập thấp': { bg:'#eff6ff', color:'#2563eb', border:'#bfdbfe' },
    'Không ngập':{ bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
    'Có ổ gà':   { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
    'Không có ổ gà':{ bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
    'Trên 3 vụ tai nạn':{ bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
    '2 – 3 vụ tai nạn':{ bg:'#fffbeb', color:'#d97706', border:'#fde68a' },
    '0 – 1 vụ tai nạn':{ bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
    // Điều kiện đường
    'Bình thường':        { bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
    'Không bình thường':  { bg:'#fff7ed', color:'#c2410c', border:'#fed7aa' },
    'Khó đi':             { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
    'Không bình thường / Khó đi': { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
    'Đang sửa chữa':      { bg:'#fffbeb', color:'#d97706', border:'#fde68a' },
    'Nguy hiểm':          { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
  };
  const style = map[value];
  if (!style) return <span style={{ fontSize:12.5, color:'#374151' }}>{value}</span>;
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600,
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
      borderRadius: 6, padding: '2px 8px',
    }}>{value}</span>
  );
}

// ── Row một thuộc tính ────────────────────────────────────────────────────────
function AttrRow({ label, value }) {
  const BADGE_FIELDS = [
    'Tần suất tai nạn','Mức độ nghiêm trọng','Mức độ ùn tắc',
    'Mức độ ngập','Ổ gà','Điều kiện đường',
  ];
  const useBadge = BADGE_FIELDS.includes(label);
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: 8, padding: '5px 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <span style={{ fontSize: 11.5, color: '#6b7280', flexShrink: 0, maxWidth: '48%' }}>
        {label}
      </span>
      <span style={{ textAlign: 'right' }}>
        {useBadge
          ? <SeverityBadge value={String(value)} />
          : <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827' }}>{String(value)}</span>
        }
      </span>
    </div>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────
function GroupSection({ group, display }) {
  const [open, setOpen] = useState(true);
  const entries = group.fields
    .map(f => ({ label: f, value: display[f] }))
    .filter(e => e.value !== undefined && e.value !== null);
  if (entries.length === 0) return null;
  return (
    <div style={{
      border: `1px solid ${group.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 12px',
          background: group.bg,
          border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ color: group.color }}>{group.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: group.color, flex: 1, textAlign: 'left' }}>
          {group.title}
        </span>
        <span style={{ fontSize: 11, color: group.color, opacity: 0.7 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 8px' }}>
          {entries.map(e => <AttrRow key={e.label} label={e.label} value={e.value} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function RoadInfoPanel({ data, loading, onClose }) {
  if (!loading && !data) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16, right: 16,
      width: 310,
      maxHeight: 'calc(100vh - 80px)',
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      border: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden',
      animation: 'slideInRight 0.2s ease',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(20px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'flex-start', gap: 8,
        background: 'linear-gradient(135deg,#ec4899,#be185d)',
        flexShrink: 0,
      }}>
        <div style={{ color: 'white', marginTop: 1 }}><IconRoad /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Đang tải thông tin…</div>
          ) : (
            <>
              <div style={{
                color: '#fff', fontWeight: 700, fontSize: 14,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {data?.road_name || 'Không rõ tên đường'}
              </div>
              {(data?.ward || data?.district) && (
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>
                  {[data.ward, data.district].filter(Boolean).join(' · ')}
                </div>
              )}
              {data?.dist_m !== undefined && (
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 1 }}>
                  Cách điểm click: {data.dist_m < 1000 ? `${data.dist_m} m` : `${(data.dist_m/1000).toFixed(2)} km`}
                  {data.all_segments > 1 && ` · ${data.all_segments} đoạn`}
                </div>
              )}
            </>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            flexShrink: 0, width: 24, height: 24,
            border: 'none', borderRadius: 6,
            background: 'rgba(255,255,255,0.2)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><IconClose /></button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 12px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: 10 }}>
            <div style={{
              width: 28, height: 28, border: '3px solid #f3f4f6',
              borderTop: '3px solid #ec4899', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}/>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Đang truy vấn cơ sở dữ liệu…</span>
          </div>
        )}

        {!loading && data?.found === false && (
          <div style={{
            textAlign: 'center', padding: '24px 16px',
            color: '#6b7280', fontSize: 13,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Không có dữ liệu</div>
            <div style={{ fontSize: 11.5, color: '#9ca3af' }}>
              {data.message || 'Khu vực này chưa có dữ liệu tuyến đường trong hệ thống.'}
            </div>
          </div>
        )}

        {!loading && data?.found && data?.display && (
          <>
            {GROUPS.map(g => (
              <GroupSection key={g.key} group={g} display={data.display} />
            ))}

            {/* Nếu có dữ liệu nào không nằm trong group nào */}
            {(() => {
              const allGroupFields = GROUPS.flatMap(g => g.fields);
              const extra = Object.entries(data.display).filter(([k]) =>
                !allGroupFields.includes(k) &&
                k !== 'Tên đường' && k !== 'Phường / Xã' && k !== 'Quận / Huyện'
              );
              if (extra.length === 0) return null;
              return (
                <div style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                  <div style={{ padding:'8px 12px', background:'#f9fafb', fontSize:12, fontWeight:700, color:'#374151' }}>
                    Thông tin khác
                  </div>
                  <div style={{ padding:'4px 12px 8px' }}>
                    {extra.map(([k,v]) => <AttrRow key={k} label={k} value={v} />)}
                  </div>
                </div>
              );
            })()}

            <div style={{ textAlign:'center', fontSize:10.5, color:'#d1d5db', marginTop:4 }}>
              Nguồn: Cơ sở dữ liệu WebGIS HCM
            </div>
          </>
        )}
      </div>
    </div>
  );
}
