import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { StationRecord } from '../types';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [stations, setStations] = useState<StationRecord[]>([]);
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('inkknits-theme');
    return stored ? stored === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('inkknits-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (!user) return;
    const fetchStations = async () => {
      try {
        const data = await apiFetch<StationRecord[]>('/stations');
        setStations(data);
      } catch {
        setStations([]);
      }
    };
    void fetchStations();
  }, [user]);

  const mainNavItems = [
    { label: 'Overview', path: '/' },
    { label: 'My Projects', path: '/projects' },
  ];

  const orgNavItems = [{ label: 'Organization', path: '/organization' }];

  const workflowNavItems = [
    { label: 'Approvals', path: '/approvals' },
    { label: 'AI Queue', path: '/ai' },
    { label: 'Activity', path: '/activity' },
  ];

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-200 dark:bg-backgroundDark dark:text-textDark">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur-sm dark:border-white/10 dark:bg-[#3a2d2d]/80">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div
              onClick={() => navigate('/')}
              className="flex cursor-pointer items-center gap-3 transition hover:opacity-90"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent font-bold text-backgroundDark shadow-sm">
                I
              </div>
              <div>
                <div className="text-lg font-bold text-text dark:text-textDark">InkKnits</div>
                <div className="text-xs text-text/70 dark:text-textDark/70">
                  {user?.organization_id ? `Org: ${user.organization_id.slice(0, 8)}` : 'Studio Workspace'}
                </div>
              </div>
            </div>

            {/* User Controls */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsDark((current) => !current)}
                className="rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-text shadow-sm transition hover:opacity-90 dark:border-white/10 dark:bg-[#4f3d3d] dark:text-textDark"
              >
                {isDark ? '☀️ Light' : '🌙 Dark'}
              </button>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent dark:text-textDark">
                {roles.join(', ') || 'VIEWER'}
              </span>
              <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-1.5 shadow-sm dark:bg-[#4f3d3d]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-backgroundDark text-xs font-bold text-textDark dark:bg-background dark:text-text">
                  {(user?.display_name ?? 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-xs">
                  <div className="font-bold">{user?.display_name ?? 'User'}</div>
                  <div className="text-[10px] text-text/60 dark:text-textDark/70">{user?.email ?? ''}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl bg-backgroundDark px-3.5 py-1.5 text-xs font-bold text-textDark transition hover:opacity-90 dark:bg-background dark:text-text"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Primary Domain Navigation Hierarchy */}
          <nav className="flex flex-wrap items-center gap-5 border-t border-black/5 py-2.5 dark:border-white/5">
            {/* ORGANIZATION */}
            <div className="flex items-center gap-1">
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-text/40 dark:text-textDark/40">
                ORGANIZATION
              </span>
              {orgNavItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-accent text-backgroundDark shadow-sm'
                      : 'text-text/70 hover:bg-black/5 dark:text-textDark/70 dark:hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

            {/* MY WORK */}
            <div className="flex items-center gap-1">
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-text/40 dark:text-textDark/40">
                MY WORK
              </span>
              {mainNavItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    location.pathname === item.path || (item.path === '/projects' && location.pathname.startsWith('/projects'))
                      ? 'bg-accent text-backgroundDark shadow-sm'
                      : 'text-text/70 hover:bg-black/5 dark:text-textDark/70 dark:hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

            {/* STATIONS */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-text/40 dark:text-textDark/40">
                STATIONS
              </span>
              {stations.length > 0 ? (
                stations.map((st) => {
                  const path = `/stations/${st.id}`;
                  const isActive = location.pathname === path;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => navigate(path)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? 'bg-accent text-backgroundDark shadow-sm'
                          : 'text-text/70 hover:bg-black/5 dark:text-textDark/70 dark:hover:bg-white/5'
                      }`}
                    >
                      {st.icon || '✨'} {st.name}
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-text/40 dark:text-textDark/40">No stations loaded</span>
              )}
            </div>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

            {/* WORKFLOW */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-text/40 dark:text-textDark/40">
                WORKFLOW
              </span>
              {workflowNavItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    location.pathname === item.path
                      ? 'bg-accent text-backgroundDark shadow-sm'
                      : 'text-text/70 hover:bg-black/5 dark:text-textDark/70 dark:hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
