const paths = {
  leaf: <path d="m12 2 2 6 4-3-.5 6L22 9l-3 6 3 1-8 4-2-2-2 2-8-4 3-1-3-6 4.5 2L6 5l4 3Zm0 16v5"/>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  pause: <path d="M8 5v14m8-14v14"/>,
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon: <path d="M20.7 13.3A8.8 8.8 0 0 1 10.7 3.2a9 9 0 1 0 10 10.1Z"/>,
  wind: <path d="M3 8h12c5 0 5-6 1-6-2 0-3 1-3 3M2 12h17c4 0 4 6 0 6-2 0-3-1-3-2M5 16h4c4 0 4 6 0 6"/>,
  sliders: <><path d="M3 7h18M3 17h18"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
}
export default function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
}
