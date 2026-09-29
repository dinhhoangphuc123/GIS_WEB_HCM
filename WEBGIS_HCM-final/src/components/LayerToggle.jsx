// components/LayerToggle.jsx
// Bốn nút bật/tắt lớp: Tuyến đường, Kẹt xe, Tai nạn (chấm đen), Biển báo (chấm vàng).

import React from 'react';

function LayerBtn({ active, color, bgColor, borderColor, dotColor, dotShadow, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 80,
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 10px',
        border: `1.5px solid ${active ? borderColor : 'var(--gray-200)'}`,
        borderRadius: 'var(--r-sm)',
        background: active ? bgColor : '#fff',
        cursor: 'pointer',
        transition: 'all var(--ease)',
      }}
    >
      <div style={{
        width: icon ? 12 : 10, height: icon ? 12 : 10,
        borderRadius: '50%',
        background: dotColor, flexShrink: 0,
        boxShadow: dotShadow || 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: 'white', fontWeight: 700,
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 11.5, fontWeight: 600,
        color: active ? color : 'var(--gray-500)',
      }}>
        {label}
      </span>
    </button>
  );
}

export default function LayerToggle({ layers, onToggle }) {
  return (
    <div>
      <div className="section-label">Lớp bản đồ</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>

        {/* Tuyến đường — đường xanh */}
        <LayerBtn
          active={layers.roads}
          color="#1d4ed8"
          bgColor="#eff6ff"
          borderColor="#1d4ed8"
          dotColor="#1d4ed8"
          dotShadow="0 0 0 2px rgba(29,78,216,0.2)"
          label="Tuyến đường"
          onClick={() => onToggle('roads')}
        />

        {/* Kẹt xe — cam/đỏ */}
        <LayerBtn
          active={layers.traffic}
          color="var(--red)"
          bgColor="var(--red-bg)"
          borderColor="var(--red)"
          dotColor="var(--red)"
          dotShadow="0 0 0 2px rgba(220,38,38,0.2)"
          label="Kẹt xe"
          onClick={() => onToggle('traffic')}
        />

        {/* Tai nạn — chấm ĐEN */}
        <LayerBtn
          active={layers.accident}
          color="#111111"
          bgColor="#f3f4f6"
          borderColor="#374151"
          dotColor="#111111"
          dotShadow="0 0 0 2px rgba(17,17,17,0.2)"
          label="Tai nạn"
          onClick={() => onToggle('accident')}
        />

        {/* Biển báo — chấm vàng */}
        <LayerBtn
          active={layers.signs}
          color="#ca8a04"
          bgColor="#fefce8"
          borderColor="#ca8a04"
          dotColor="#eab308"
          dotShadow="0 0 0 2px rgba(234,179,8,0.2)"
          label="Biển báo"
          onClick={() => onToggle('signs')}
        />

      </div>
    </div>
  );
}
