import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ConnectionOverlay from './components/ConnectionOverlay.jsx';
import { useGameConnection } from './lib/gameHooks.jsx';
import Host from './pages/Host.jsx';
import Join from './pages/Join.jsx';
import Play from './pages/Play.jsx';

function AppRoutes() {
  const connected = useGameConnection();
  return <><ConnectionOverlay connected={connected} /><Routes><Route path="/" element={<Join />} /><Route path="/play" element={<Play />} /><Route path="/host" element={<Host />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></>;
}

export default function App() { return <BrowserRouter><AppRoutes /></BrowserRouter>; }
