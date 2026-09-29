// components/RouteInfo.jsx
// Hiển thị từng bước rẽ một (như Google Maps):
//  - 1 bước lớn hiện tại + preview bước tiếp theo
//  - Km/thời gian còn lại cập nhật realtime theo GPS
//  - Nút ‹ › để chuyển bước thủ công

import React from 'react';
import { CRITERIA_LABELS, ROAD_TYPES } from '../utils/routeMock.js';
import {
  IconTurnLeft, IconTurnRight, IconStraight,
  IconSlightLeft, IconSlightRight, IconUTurn,
  IconDestination, IconStart, IconNavigation,
} from '../utils/icons.jsx';

const TURN_ICON = {
  start:       IconStart,
  dest:        IconDestination,
  straight:    IconStraight,
  turnLeft:    IconTurnLeft,
  turnRight:   IconTurnRight,
  slightLeft:  IconSlightLeft,
  slightRight: IconSlightRight,
  uTurn:       IconUTurn,
};

function fmtDist(m) {
  if (!m || m === 0) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function RouteInfo({
  result,
  onClose,
  currentStep,
  onStepChange,
  liveRemaining,
  onSelectAlgorithm,
}) {
  if (!result) return null;

  // ── Dual result: hai thuật toán cho kết quả khác nhau ────────────────────────
  if (result.isDualResult) {
    const { dijkstra, astar, diffPct, roadOverlap, sourceLabel } = result;
    return (
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        background:'#fff',
        borderTop:'1px solid var(--gray-200)',
        borderRadius:'20px 20px 0 0',
        boxShadow:'0 -4px 24px rgba(0,0,0,.09)',
        zIndex:900,
        padding:'16px 16px 20px',
      }}>
        {/* Drag handle */}
        <div style={{ display:'flex', justifyContent:'center', paddingBottom:10 }}>
          <div style={{ width:32, height:4, borderRadius:2, background:'var(--gray-200)' }}/>
        </div>

        {/* Close */}
        <button onClick={onClose} style={{
          position:'absolute', top:12, right:14,
          width:26, height:26, border:'none', borderRadius:6,
          background:'var(--gray-100)', cursor:'pointer', fontWeight:700, fontSize:15,
        }}>✕</button>

        {/* Header */}
        <div style={{ marginBottom:12, textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#dc2626', marginBottom:4 }}>
             Hai thuật toán cho kết quả khác nhau!
          </div>
          <div style={{ fontSize:12, color:'var(--gray-500)' }}>
            {sourceLabel ? <><strong>Nguồn:</strong> {sourceLabel} · </> : ''}
            Chênh lệch: <strong>{diffPct}%</strong>
            {roadOverlap !== undefined && ` · Đường trùng: ${roadOverlap}%`}
          </div>
          <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
             Dijkstra &nbsp;|&nbsp;  A* — đang vẽ trên bản đồ
          </div>
        </div>

        {/* Comparison cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {/* Dijkstra */}
          <div style={{
            border:'2px solid #3b82f6', borderRadius:12, padding:12,
            background:'#eff6ff',
          }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', marginBottom:8 }}>
               Dijkstra
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:'#1e293b' }}>
              {dijkstra.distM < 1000
                ? `${Math.round(dijkstra.distM)} m`
                : `${(dijkstra.distM/1000).toFixed(1)} km`}
            </div>
            <div style={{ fontSize:12, color:'var(--gray-500)', margin:'2px 0 8px' }}>
              ~{Math.round(dijkstra.timeS/60)} phút
            </div>
            <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:10, lineHeight:1.4 }}>
              {dijkstra.roadNames?.slice(0,3).join(' → ')}
              {dijkstra.roadNames?.length > 3 ? ` +${dijkstra.roadNames.length-3} đường` : ''}
            </div>
            <button
              onClick={() => onSelectAlgorithm && onSelectAlgorithm(dijkstra)}
              style={{
                width:'100%', padding:'8px 0', borderRadius:8, border:'none',
                background:'#3b82f6', color:'white', fontWeight:700, fontSize:13, cursor:'pointer',
              }}
            >Chọn tuyến này</button>
          </div>

          {/* A* */}
          <div style={{
            border:'2px solid #f59e0b', borderRadius:12, padding:12,
            background:'#fffbeb',
          }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#b45309', marginBottom:8 }}>
               A* (heuristic)
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:'#1e293b' }}>
              {astar.distM < 1000
                ? `${Math.round(astar.distM)} m`
                : `${(astar.distM/1000).toFixed(1)} km`}
            </div>
            <div style={{ fontSize:12, color:'var(--gray-500)', margin:'2px 0 8px' }}>
              ~{Math.round(astar.timeS/60)} phút
            </div>
            <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:10, lineHeight:1.4 }}>
              {astar.roadNames?.slice(0,3).join(' → ')}
              {astar.roadNames?.length > 3 ? ` +${astar.roadNames.length-3} đường` : ''}
            </div>
            <button
              onClick={() => onSelectAlgorithm && onSelectAlgorithm(astar)}
              style={{
                width:'100%', padding:'8px 0', borderRadius:8, border:'none',
                background:'#f59e0b', color:'white', fontWeight:700, fontSize:13, cursor:'pointer',
              }}
            >Chọn tuyến này</button>
          </div>
        </div>

        {/* Algorithm info */}
        <div style={{
          marginTop:12, padding:'8px 12px', borderRadius:8,
          background:'var(--gray-50)', fontSize:11, color:'var(--gray-500)', lineHeight:1.5,
        }}>
          <strong>Dijkstra</strong> — Đảm bảo tìm đường ngắn nhất tuyệt đối theo đồ thị.<br/>
          <strong>A*</strong> — Dùng heuristic khoảng cách thực tế, thường nhanh hơn nhưng có thể chọn đường khác.
        </div>
      </div>
    );
  }

  // ── Single result (normal) ───────────────────────────────────────────────────
  const { distM, timeS, speedKmh, criteria, isMock, steps = [] } = result;

  const step     = steps[currentStep]     ?? null;
  const nextStep = steps[currentStep + 1] ?? null;
  const isLast   = currentStep >= steps.length - 1;
  const isFirst  = currentStep === 0;

  const Icon     = step     ? (TURN_ICON[step.dir]     || IconStraight) : IconNavigation;
  const NextIcon = nextStep ? (TURN_ICON[nextStep.dir] || IconStraight) : null;

  // Ưu tiên GPS realtime, fallback tổng
  const remDist = liveRemaining ? liveRemaining.distM : distM;
  const remTime = liveRemaining ? liveRemaining.timeS : timeS;

  const distDisplay = remDist < 1000
    ? { val: Math.round(remDist), unit: 'm' }
    : { val: (remDist / 1000).toFixed(1), unit: 'km' };

  const minLeft = Math.round(remTime / 60);
  const timeDisplay = minLeft < 60
    ? { val: minLeft, unit: 'phút' }
    : { val: `${Math.floor(minLeft/60)}g${minLeft%60>0?minLeft%60+'p':''}`, unit: '' };

  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'#fff',
      borderTop:'1px solid var(--gray-200)',
      borderRadius:'20px 20px 0 0',
      boxShadow:'0 -4px 24px rgba(0,0,0,.09)',
      zIndex:900,
    }}>
      {/* Drag handle */}
      <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 0' }}>
        <div style={{ width:32, height:4, borderRadius:2, background:'var(--gray-200)' }}/>
      </div>

      {/* Close */}
      <button onClick={onClose} style={{
        position:'absolute', top:12, right:14,
        width:26, height:26, border:'none', borderRadius:6,
        background:'var(--gray-100)', color:'var(--gray-500)',
        cursor:'pointer', fontSize:13,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>✕</button>

      <div style={{ padding:'10px 16px 16px' }}>

        {/* ── Remaining stats ── */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr auto', gap:7,
          marginBottom:12,
        }}>
          {/* Dist + Time */}
          <div style={{
            background: liveRemaining ? 'var(--pink-50)' : 'var(--gray-50)',
            border:`1px solid ${liveRemaining ? 'var(--pink-200)' : 'var(--gray-100)'}`,
            borderRadius:'var(--r-sm)', padding:'10px 14px',
            display:'flex', alignItems:'center', gap:16,
          }}>
            <div>
              <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                <span style={{ fontFamily:'var(--font-d)', fontSize:22, fontWeight:700, color: liveRemaining ? 'var(--primary)' : 'var(--gray-900)' }}>
                  {distDisplay.val}
                </span>
                <span style={{ fontSize:12, color:'var(--gray-500)' }}>{distDisplay.unit}</span>
              </div>
              <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:1 }}>
                {liveRemaining ? '📡 còn lại' : 'quãng đường'}
              </div>
            </div>
            <div style={{ width:1, height:32, background:'var(--gray-200)' }}/>
            <div>
              <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                <span style={{ fontFamily:'var(--font-d)', fontSize:22, fontWeight:700, color: liveRemaining ? 'var(--primary)' : 'var(--gray-900)' }}>
                  {timeDisplay.val}
                </span>
                <span style={{ fontSize:12, color:'var(--gray-500)' }}>{timeDisplay.unit}</span>
              </div>
              <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:1 }}>
                {liveRemaining ? '⏱ còn lại' : 'dự tính'}
              </div>
            </div>
          </div>

          {/* Speed */}
          <div style={{
            background:'var(--gray-50)', border:'1px solid var(--gray-100)',
            borderRadius:'var(--r-sm)', padding:'10px 12px', textAlign:'center',
            minWidth:72,
          }}>
            <div style={{ fontFamily:'var(--font-d)', fontSize:20, fontWeight:700 }}>
              {Math.round(speedKmh)}
              <span style={{ fontSize:10, fontWeight:400, color:'var(--gray-500)' }}> km/h</span>
            </div>
            <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:1 }}>
              {ROAD_TYPES[criteria]}
            </div>
          </div>
        </div>

        {/* ── Current step ── */}
        {step && (
          <div style={{
            background: step.dir === 'dest' ? '#ecfdf5' : 'var(--gray-50)',
            border:`1.5px solid ${step.dir === 'dest' ? 'var(--green)' : 'var(--gray-200)'}`,
            borderRadius:'var(--r-md)',
            padding:'12px 14px',
            marginBottom: nextStep ? 6 : 10,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:48, height:48, borderRadius:12, flexShrink:0,
                background: step.dir === 'dest' ? 'var(--green)' : 'var(--primary)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Icon size={24} color="white"/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color: step.dir === 'dest' ? 'var(--green)' : 'var(--gray-900)' }}>
                  {step.label}
                </div>
                <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {step.name}
                </div>
              </div>
              {step.dist > 0 && (
                <div style={{
                  background:'#fff', border:'1px solid var(--gray-200)',
                  borderRadius:8, padding:'4px 8px',
                  fontSize:12, fontWeight:700, color:'var(--gray-700)',
                  flexShrink:0,
                }}>
                  {fmtDist(step.dist)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Next step preview ── */}
        {nextStep && (
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'7px 12px',
            background:'var(--gray-50)', border:'1px solid var(--gray-100)',
            borderRadius:'var(--r-sm)', marginBottom:10,
          }}>
            <span style={{ fontSize:10, color:'var(--gray-400)', flexShrink:0, fontWeight:600 }}>Tiếp</span>
            <div style={{
              width:22, height:22, borderRadius:6, background:'var(--gray-200)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              {NextIcon && <NextIcon size={12} color="var(--gray-600)"/>}
            </div>
            <span style={{ fontSize:12, fontWeight:500, color:'var(--gray-600)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {nextStep.label}
            </span>
            <span style={{ fontSize:11, color:'var(--gray-400)', flexShrink:0 }}>
              {nextStep.name}
            </span>
            {nextStep.dist > 0 && (
              <span style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', flexShrink:0 }}>
                · {fmtDist(nextStep.dist)}
              </span>
            )}
          </div>
        )}

        {/* ── Step navigation ── */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
            disabled={isFirst}
            style={{
              width:36, height:36,
              border:'1px solid var(--gray-200)',
              borderRadius:'var(--r-sm)',
              background: isFirst ? 'var(--gray-50)' : '#fff',
              color: isFirst ? 'var(--gray-300)' : 'var(--gray-600)',
              cursor: isFirst ? 'not-allowed' : 'pointer',
              fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}
          >‹</button>

          <div style={{ flex:1 }}>
            <div style={{ height:4, borderRadius:2, background:'var(--gray-200)', overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:2,
                background:'linear-gradient(90deg,var(--pink-500),var(--pink-600))',
                width: steps.length > 1 ? `${(currentStep / (steps.length - 1)) * 100}%` : '0%',
                transition:'width .4s ease',
              }}/>
            </div>
            <div style={{ textAlign:'center', fontSize:10.5, color:'var(--gray-400)', marginTop:4, fontWeight:600 }}>
              Bước {currentStep + 1} / {steps.length}
              {isMock && <span style={{ color:'var(--orange)', marginLeft:6 }}>· Ước tính</span>}
              {!isMock && result.source === 'dijkstra' && <span style={{ color:'#3b82f6', marginLeft:6 }}>🔵 Dijkstra</span>}
              {!isMock && result.source === 'astar'    && <span style={{ color:'#b45309', marginLeft:6 }}>🟡 A*</span>}
            </div>
          </div>

          <button
            onClick={() => onStepChange(Math.min(steps.length - 1, currentStep + 1))}
            disabled={isLast}
            style={{
              width:36, height:36,
              border:'none',
              borderRadius:'var(--r-sm)',
              background: isLast ? 'var(--gray-100)' : 'var(--primary)',
              color: isLast ? 'var(--gray-300)' : '#fff',
              cursor: isLast ? 'not-allowed' : 'pointer',
              fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}
          >›</button>
        </div>

      </div>
    </div>
  );
}
