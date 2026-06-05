import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, isAuthenticated } from './api.js';
import Header from './components/Header.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Campaign from './pages/Campaign.jsx';
import './styles.css';

function ProtectedLayout() {
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated()) {
      api('/api/auth/me').then(setUser).catch(() => {});
    }
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="app-layout">
      <Header user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/campaigns/:id" element={<Campaign />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
