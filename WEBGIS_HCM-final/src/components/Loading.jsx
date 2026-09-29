// components/Loading.jsx
// Overlay loading hiển thị khi đang tính route.

import React from 'react';

export default function Loading({ show }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(255,255,255,.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: show ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <div style={{
        background: '#fff',
        border: '1px solid var(--gray-200)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 36px',
        textAlign: 'center',
        boxShadow: 'var(--sh-lg)',
      }}>
        <div style={{
          width: 42, height: 42,
          border: '3px solid var(--pink-100)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin .75s linear infinite',
          margin: '0 auto 12px',
        }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Đang tính toán lộ trình…</div>
        <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>
          Phân tích dữ liệu giao thông
        </div>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 12 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: 'var(--gray-200)',
                animation: `ldot 1.4s infinite ${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ldot {
          0%,80%,100% { background: var(--gray-200); transform: scale(1); }
          40%          { background: var(--primary);  transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
