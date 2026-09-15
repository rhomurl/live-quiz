import { useState } from 'react';
export default function FullscreenButton() {
  const [active, setActive] = useState(Boolean(document.fullscreenElement));
  const toggle = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen?.(); setActive(Boolean(document.fullscreenElement)); } catch {} };
  return <button type="button" className="quiet-button" onClick={toggle}>{active ? 'Exit fullscreen' : 'Fullscreen'}</button>;
}
