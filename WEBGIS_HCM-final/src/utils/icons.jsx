// utils/icons.jsx
// Tất cả icon Lucide dùng trong app — dạng React component
// Thêm icon mới ở đây, import ở nơi cần dùng

const props = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconMotorbike({ size = 22, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m18 14-1-3"/>
      <path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81"/>
      <path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5"/>
      <circle cx="19" cy="17" r="3"/>
      <circle cx="5" cy="17" r="3"/>
    </svg>
  );
}

export function IconCar({ size = 22, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
      <circle cx="7" cy="17" r="2"/>
      <path d="M9 17h6"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>
  );
}

export function IconWalk({ size = 22, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <circle cx="12" cy="5" r="1"/>
      <path d="m9 20 3-6 3 6"/>
      <path d="m6 8 6 2 6-2"/>
      <path d="M12 10v4"/>
    </svg>
  );
}

export function IconBus({ size = 22, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M4 6 2 7"/>
      <path d="M10 6h4"/>
      <path d="m22 7-2-1"/>
      <rect width="16" height="16" x="4" y="3" rx="2"/>
      <path d="M4 11h16"/>
      <path d="M8 15h.01"/>
      <path d="M16 15h.01"/>
      <path d="M6 19v2"/>
      <path d="M18 21v-2"/>
    </svg>
  );
}

export function IconMapPinPlus({ size = 18, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/>
      <circle cx="12" cy="10" r="3"/>
      <path d="M16 18h6"/>
      <path d="M19 15v6"/>
    </svg>
  );
}

export function IconMapPinned({ size = 18, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/>
      <circle cx="12" cy="8" r="2"/>
      <path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712"/>
    </svg>
  );
}

export function IconSearch({ size = 16, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m21 21-4.34-4.34"/>
      <circle cx="11" cy="11" r="8"/>
    </svg>
  );
}

export function IconNavigation({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  );
}

export function IconMenu({ size = 16, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

export function IconChevronRight({ size = 16, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

/* ── Turn-by-turn direction icons ── */
export function IconTurnLeft({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m3 9 4-4 4 4"/>
      <path d="M7 5v14"/>
      <path d="M20 5v8a4 4 0 0 1-4 4h-4"/>
    </svg>
  );
}

export function IconTurnRight({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m21 9-4-4-4 4"/>
      <path d="M17 5v14"/>
      <path d="M4 5v8a4 4 0 0 0 4 4h4"/>
    </svg>
  );
}

export function IconStraight({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M12 5v14"/>
      <path d="m9 8 3-3 3 3"/>
    </svg>
  );
}

export function IconSlightLeft({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m7 9-3-3 3-3"/>
      <path d="M4 6h8a4 4 0 0 1 4 4v9"/>
    </svg>
  );
}

export function IconSlightRight({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="m17 9 3-3-3-3"/>
      <path d="M20 6h-8a4 4 0 0 0-4 4v9"/>
    </svg>
  );
}

export function IconUTurn({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M9 14 4 9l5-5"/>
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
    </svg>
  );
}

export function IconDestination({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/>
      <circle cx="12" cy="8" r="2"/>
    </svg>
  );
}

export function IconStart({ size = 15, color = 'currentColor', style }) {
  return (
    <svg {...props} width={size} height={size} stroke={color} style={style}>
      <path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
