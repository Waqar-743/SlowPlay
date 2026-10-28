import './pixel-backdrop.css'

// The poster is useful on its own: no extra canvas or graphics context is
// needed for the library's decorative motion.
export default function PixelBackdrop() {
  return <div className="pixel-backdrop" aria-hidden="true">
    <div className="pixel-forest" />
    <div className="pixel-fireflies">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
  </div>
}
