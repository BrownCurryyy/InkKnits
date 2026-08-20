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

  const normalizedRoles = roles.map((role) => role.toUpperCase());
  const canManageOrganization = normalizedRoles.some((role) => ['ADMIN', 'MANAGER'].includes(role));
  const canReview = normalizedRoles.some((role) => ['ADMIN', 'MANAGER', 'REVIEWER'].includes(role));
  const sidebarSections = [
    { label: 'Home', items: [{ label: 'Home', path: '/' }] },
    { label: 'Projects', items: [{ label: 'My Projects', path: '/projects' }] },
    {
      label: 'Organization',
      items: canManageOrganization ? [{ label: 'Organization', path: '/organization' }] : [],
    },
    {
      label: 'Stations',
      items: stations.map((station) => ({ label: station.name, path: `/stations/${station.id}` })),
    },
    {
      label: 'Workflow',
      items: [
        ...(canReview ? [{ label: 'Approvals', path: '/approvals' }] : []),
        { label: 'AI Queue', path: '/ai' },
        { label: 'Activity', path: '/activity' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-200 dark:bg-backgroundDark dark:text-textDark">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-black/5 bg-[#fff8dc] p-6 dark:border-white/10 dark:bg-[#392f2f] lg:block">
        <button type="button" onClick={() => navigate('/')} className="mb-10 flex w-full items-center gap-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-bold text-backgroundDark shadow-sm">I</div>
          <div>
            <div className="text-xl font-bold text-text dark:text-textDark">InkKnits</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-text/50 dark:text-textDark/50">Production studio</div>
          </div>
        </button>
        <nav className="space-y-6" aria-label="Primary navigation">
          {sidebarSections.map((section) => section.items.length > 0 ? (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-wider text-text/40 dark:text-textDark/40">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={`w-full rounded-xl border-l-2 px-3.5 py-2.5 text-left text-sm font-semibold transition ${isActive ? 'border-accent bg-accent/20 text-text dark:bg-accent dark:text-backgroundDark' : 'border-transparent text-text/65 hover:border-accent/50 hover:bg-black/5 dark:text-textDark/70 dark:hover:bg-white/5'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null)}
        </nav>
      </aside>

      <header className="border-b border-black/5 bg-[#fff8dc]/80 backdrop-blur-sm dark:border-white/10 dark:bg-[#423838]/80 lg:ml-72">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="flex items-center justify-between py-3">
            {/* Logo */}
            <div
              onClick={() => navigate('/')}
              className="flex cursor-pointer items-center gap-3 transition hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-bold text-backgroundDark shadow-sm">
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
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsDark((current) => !current)}
                className="rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-xs font-semibold text-text shadow-sm transition hover:opacity-90 dark:border-white/10 dark:bg-[#4f3d3d] dark:text-textDark"
              >
                {isDark ? '☀️ Light' : '🌙 Dark'}
              </button>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent dark:text-textDark">
                {roles.join(', ') || 'VIEWER'}
              </span>
              <div className="hidden items-center gap-3 rounded-xl bg-white/70 px-3 py-1.5 shadow-sm dark:bg-[#4f3d3d] sm:flex">
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
                className="rounded-xl bg-backgroundDark px-3.5 py-2 text-xs font-bold text-textDark transition hover:opacity-90 dark:bg-background dark:text-text"
              >
                Logout
              </button>
            </div>
          </div>

        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-65px)] max-w-[1440px] p-5 lg:ml-72 lg:p-10">{children}</main>
    </div>
  );
}
