const paths = {
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon: <path d="M20.7 13.3A8.8 8.8 0 0 1 10.7 3.2a9 9 0 1 0 10 10.1Z"/>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2"/></>,
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  pause: <path d="M7 4h3v16H7zm7 0h3v16h-3z"/>,
  restart: <path d="M4 10a8 8 0 1 1 1.6 7M4 4v6h6"/>,
  home: <><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/></>,
  sound: <><path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  mute: <><path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="m16 9 6 6m0-6-6 6"/></>,
  left: <path d="M20 12H4m6-6-6 6 6 6"/>,
  right: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  up: <path d="M12 20V4m-6 6 6-6 6 6"/>,
  down: <path d="M12 4v16m-6-6 6 6 6-6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  check: <path d="m5 12 4 4L20 5"/>,
  anchor: <><circle cx="12" cy="5" r="3"/><path d="M12 8v13M8 11h8M3 14c0 9 18 9 18 0M1 16l2-2 2 2m14 0 2-2 2 2"/></>,
  wind: <path d="M3 8h12c5 0 5-6 1-6-2 0-3 1-3 3M2 12h17c4 0 4 6 0 6-2 0-3-1-3-2M5 16h4c4 0 4 6 0 6"/>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
}
const aliases = { 'arrow-right': 'right', 'arrow-left': 'left', 'arrow-up': 'up', 'arrow-down': 'down', volume: 'sound', reset: 'restart', throttle: 'up', brake: 'down', sail: 'anchor' }
export default function Icon({ name, size = 20, className = '', ...props }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[aliases[name] || name] || paths.compass}</svg>
}
