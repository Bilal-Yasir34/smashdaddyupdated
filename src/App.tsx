import { useState } from 'react';
import Landing from './pages/Landing';
import AdminLogin from './pages/AdminLogin';
import MenuManagement from './pages/MenuManagement';
import InventoryManagement from './pages/InventoryManagement';
import StaffManagement from './pages/StaffManagement';
import Analytics from './pages/Analytics';
import Expenses from './pages/Expenses';
import OrderModule from './pages/OrderModule';
import { isAdminLoggedIn, logoutAdmin } from './lib/auth';
import type { AdminTab } from './types';

type View = 'landing' | 'admin-login' | 'admin' | 'order';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [adminTab, setAdminTab] = useState<AdminTab>('menu');
  const [authed, setAuthed] = useState(isAdminLoggedIn());

  function goAdmin() {
    if (authed) {
      setView('admin');
    } else {
      setView('admin-login');
    }
  }

  function handleLoginSuccess() {
    setAuthed(true);
    setView('admin');
    setAdminTab('menu');
  }

  function handleLogout() {
    logoutAdmin();
    setAuthed(false);
    setView('landing');
  }

  if (view === 'landing') {
    return <Landing onAdmin={goAdmin} onOrder={() => setView('order')} />;
  }

  if (view === 'admin-login') {
    return <AdminLogin onSuccess={handleLoginSuccess} onBack={() => setView('landing')} />;
  }

  if (view === 'order') {
    return <OrderModule onBack={() => setView('landing')} />;
  }

  if (view === 'admin') {
    if (adminTab === 'menu') {
      return (
        <MenuManagement onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
      );
    }
    if (adminTab === 'inventory') {
      return (
        <InventoryManagement
          onLogout={handleLogout}
          onNavigate={setAdminTab}
          activeTab={adminTab}
        />
      );
    }
    if (adminTab === 'staff') {
      return (
        <StaffManagement onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
      );
    }
    if (adminTab === 'expenses') {
      return (
        <Expenses onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
      );
    }
    return <Analytics onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />;
  }

  return null;
}

