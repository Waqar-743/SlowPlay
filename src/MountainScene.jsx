const ART = `${import.meta.env.BASE_URL}hero/`

/** Independent photo layers: moving trees never displace the mountain or sky. */
export default function MountainScene({ canvasRef, onError }) {
  return <div className="landscape" aria-hidden="true">
    <div className="landscape-plane">
      <img className="landscape-image" src={`${ART}rose-landscape.webp`} alt="" fetchPriority="high" onError={onError} />
      <div className="tree-layer tree-left"><img className="landscape-image" src={`${ART}rose-trees.webp`} alt="" onError={onError} /></div>
      <div className="tree-layer tree-right"><img className="landscape-image" src={`${ART}rose-trees.webp`} alt="" onError={onError} /></div>
    </div>
    <div className="haze haze-back" /><div className="haze haze-front" />
    <svg className="wind-lines" viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none">
      <path className="wind-trail" d="M-180 580C80 510 200 650 420 598S740 510 1000 586 1300 650 1620 540" />
      <path className="wind-trail" d="M-220 738C70 650 230 770 520 692S960 665 1190 710 1420 720 1650 656" />
      <path className="wind-trail" d="M-160 400C110 330 280 460 540 404S880 356 1160 410 1450 430 1640 360" />
    </svg>
    <canvas ref={canvasRef} className="living-canvas" />
    <div className="scene-shade" />
  </div>
}
