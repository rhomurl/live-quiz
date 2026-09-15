import { useEffect, useState } from 'react';
export default function ConnectionOverlay({ connected }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (connected) { setVisible(false); return undefined; } const timer = setTimeout(() => setVisible(true), 700); return () => clearTimeout(timer); }, [connected]);
  return visible ? <aside className="connection-overlay" role="status">Reconnecting to the quiz…</aside> : null;
}
