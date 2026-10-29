const paths = {
  play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="7" y="5" width="3" height="14" rx=".6" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3" height="14" rx=".6" fill="currentColor" stroke="none"/></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  collapse: <path d="M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5" />,
  sliders: <><path d="M3 7h18M3 17h18"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
  volume: <><path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  mute: <><path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="m16 9 6 6m0-6-6 6"/></>,
  restart: <><path d="M3 8a9 9 0 1 1 0 8M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
  waterfall: <><path d="M4 5h16M7 5v10m5-10v12m5-12v10M3 19c3-3 6 3 9 0s6 3 9 0"/></>,
  rain: <><path d="M5 12a4 4 0 0 1 0-8 5 5 0 0 1 9-1 4 4 0 1 1 4 9H5Z"/><path d="m7 16-2 4m8-4-2 4m8-4-2 4"/></>,
  ocean: <><path d="M2 7c3-3 6 3 10 0s7 3 10 0M2 12c3-3 6 3 10 0s7 3 10 0M2 17c3-3 6 3 10 0s7 3 10 0"/></>,
  cave: <><path d="M12 3c-2 4-6 8-6 12a6 6 0 0 0 12 0c0-4-4-8-6-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/></>,
}

export default function Icon({ name, size = 20, className = '', ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>
}
