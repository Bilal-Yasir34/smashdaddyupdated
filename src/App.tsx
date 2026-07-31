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
import { ThemeProvider } from './context/ThemeContext';
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

  return (
    <ThemeProvider>
      {view === 'landing' && <Landing onAdmin={goAdmin} onOrder={() => setView('order')} />}
      {view === 'admin-login' && (
        <AdminLogin onSuccess={handleLoginSuccess} onBack={() => setView('landing')} />
      )}
      {view === 'order' && <OrderModule onBack={() => setView('landing')} />}
      {view === 'admin' && (
        <>
          {adminTab === 'menu' && (
            <MenuManagement onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
          )}
          {adminTab === 'inventory' && (
            <InventoryManagement
              onLogout={handleLogout}
              onNavigate={setAdminTab}
              activeTab={adminTab}
            />
          )}
          {adminTab === 'staff' && (
            <StaffManagement onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
          )}
          {adminTab === 'expenses' && (
            <Expenses onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
          )}
          {adminTab === 'analytics' && (
            <Analytics onLogout={handleLogout} onNavigate={setAdminTab} activeTab={adminTab} />
          )}
        </>
      )}
    </ThemeProvider>
  );
}


