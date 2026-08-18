import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('inkknits-theme');
    return stored ? stored === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('inkknits-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Approvals', path: '/approvals' },
    { label: 'AI Console', path: '/ai' },
  ];

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-200 dark:bg-backgroundDark dark:text-textDark">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur-sm dark:border-white/10 dark:bg-[#3a2d2d]/80">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-bold text-backgroundDark">I</div>
              <div>
                <div className="text-lg font-semibold">InkKnits</div>
                <div className="text-xs text-text/70 dark:text-textDark/70">{user?.organization_id ?? 'Organization'}</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsDark((current) => !current)}
                className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-text shadow-sm transition hover:opacity-90 dark:border-white/10 dark:bg-[#4f3d3d] dark:text-textDark"
              >
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent dark:text-textDark">
                {roles.join(', ') || 'VIEWER'}
              </span>
              <div className="flex items-center gap-3 rounded-cozy bg-white/80 px-3 py-2 shadow-cozy dark:bg-[#4f3d3d]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-backgroundDark text-sm font-semibold text-textDark dark:bg-background dark:text-text">
                  {(user?.display_name ?? 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-sm">
                  <div className="font-medium">{user?.display_name ?? 'User'}</div>
                  <div className="text-xs text-text/60 dark:text-textDark/70">{user?.email ?? ''}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl bg-backgroundDark px-4 py-2 text-sm font-medium text-textDark transition hover:opacity-90 dark:bg-background dark:text-text"
              >
                Logout
              </button>
            </div>
          </div>

          <nav className="flex gap-1 pb-0">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`px-3 py-3 text-sm font-medium transition ${
                  location.pathname === item.path
                    ? 'border-b-2 border-accent text-accent'
                    : 'border-b-2 border-transparent text-text/70 hover:text-text dark:text-textDark/70 dark:hover:text-textDark'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
