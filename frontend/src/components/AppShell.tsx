import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ProjectRecord, StationRecord } from '../types';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [stations, setStations] = useState<StationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('inkknits-theme');
    return stored ? stored === 'dark' : false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('inkknits-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (!user) return;
    const fetchWorkspace = async () => {
      try {
        const [projectData, stationData] = await Promise.all([
          apiFetch<ProjectRecord[]>('/projects'),
          apiFetch<StationRecord[]>('/stations'),
        ]);
        setProjects(projectData);
        setStations(stationData);
        setExpandedProjects((current) => {
          const next = { ...current };
          projectData.forEach((project) => {
            if (next[project.id] === undefined) next[project.id] = false;
          });
          return next;
        });
      } catch {
        setProjects([]);
        setStations([]);
      }
    };
    void fetchWorkspace();
  }, [user]);

  const normalizedRoles = roles.map((role) => role.toUpperCase());
  const canManageOrganization = normalizedRoles.some((role) => ['ADMIN', 'MANAGER'].includes(role));
  const canReview = normalizedRoles.some((role) => ['ADMIN', 'MANAGER', 'REVIEWER'].includes(role));
  const rolePriority = ['ADMIN', 'MANAGER', 'EDITOR', 'REVIEWER', 'PUBLISHER', 'VIEWER'];
  const highestRole = rolePriority.find((role) => normalizedRoles.includes(role)) ?? 'VIEWER';
  const projectGroups = useMemo(
    () => projects.map((project) => ({
      project,
      stations: stations.filter((station) => station.project_id === project.id),
    })),
    [projects, stations],
  );

  const sidebarSections = [
    { label: 'Home', items: [{ label: 'Home', path: '/' }] },
    { label: 'Projects', items: [{ label: 'Projects', path: '/projects' }] },
    {
      label: 'Organization',
      items: canManageOrganization ? [{ label: 'Organization', path: '/organization' }] : [],
    },
    {
      label: 'Workflow',
      items: [
        ...(canReview ? [{ label: 'Approvals', path: '/approvals' }] : []),
        { label: 'AI Queue', path: '/ai' },
        { label: 'Activity', path: '/activity' },
        { label: 'Version Tracking', path: '/version-tracking' },
      ],
    },
  ];

  return (
    <div className="min-h-screen text-text transition-colors duration-200 dark:text-textDark">
      {/* Sidebar — lime accent strip */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r-4 border-accent bg-white/90 p-6 backdrop-blur-md dark:border-accent dark:bg-backgroundDark/95 lg:block">
        <button type="button" onClick={() => navigate('/')} className="mb-10 flex w-full items-center gap-3 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent font-display text-xl font-bold text-text shadow-bold">I</div>
          <div>
            <div className="font-display text-2xl font-bold lowercase text-text dark:text-textDark">inkknits</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accentSecondary">production studio</div>
          </div>
        </button>

        <nav className="space-y-6" aria-label="Primary navigation">
          {sidebarSections.map((section) => section.items.length > 0 ? (
            <div key={section.label}>
              <p className="section-label mb-2 px-3">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={`w-full rounded-xl border-l-4 px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                        isActive
                          ? 'nav-active'
                          : 'border-transparent text-text/60 hover:border-accentSecondary/50 hover:bg-accentSecondary/10 dark:text-textDark/70'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {section.label === 'Projects' ? (
                <div className="mt-3 space-y-2 border-l-2 border-accentSecondary/30 pl-3">
                  {projectGroups.map(({ project, stations: projectStations }) => {
                    const expanded = expandedProjects[project.id] ?? false;
                    return (
                      <div key={project.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedProjects((current) => ({ ...current, [project.id]: !expanded }))}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-bold text-text/75 hover:bg-accentSecondary/10 dark:text-textDark/75"
                        >
                          <span className="truncate">{project.title}</span>
                          <span aria-hidden="true" className="ml-2 text-accentSecondary">{expanded ? '−' : '+'}</span>
                        </button>
                        {expanded ? (
                          <div className="mt-1 space-y-0.5 pl-2">
                            {projectStations.map((station) => {
                              const path = `/stations/${station.id}`;
                              const isActive = location.pathname.startsWith(path);
                              return (
                                <button
                                  key={station.id}
                                  type="button"
                                  onClick={() => navigate(path)}
                                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                                    isActive
                                      ? 'bg-accentSecondary/25 font-bold text-text dark:bg-accentSecondary dark:text-white'
                                      : 'text-text/55 hover:bg-accentSecondary/10 dark:text-textDark/60'
                                  }`}
                                >
                                  {station.name}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null)}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 border-b border-accentSecondary/20 bg-white/80 backdrop-blur-md dark:border-accentSecondary/10 dark:bg-backgroundDark/90 lg:ml-72">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="flex items-center justify-between py-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-3 transition hover:opacity-90 lg:hidden"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-display font-bold text-text">I</div>
              <span className="font-display text-lg font-bold lowercase">inkknits</span>
            </button>

            <div className="hidden text-xs text-text/50 dark:text-textDark/50 lg:block">
              {user?.organization_id ? `Org ${user.organization_id.slice(0, 8)}` : 'Studio Workspace'}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsDark((current) => !current)}
                className="btn-secondary px-3 py-2 text-xs"
              >
                {isDark ? '☀ Light' : '☾ Dark'}
              </button>
              <span className="hidden rounded-full bg-accentSecondary/25 px-3 py-1 text-xs font-bold text-accentSecondary sm:inline dark:text-accentSecondary">
                {highestRole}
              </span>
              <div className="hidden items-center gap-3 rounded-xl bg-accentSecondary/10 px-3 py-1.5 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-text">
                  {(user?.display_name ?? 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-xs">
                  <div className="font-bold">{user?.display_name ?? 'User'}</div>
                  <div className="text-[10px] text-text/50 dark:text-textDark/60">{user?.email ?? ''}</div>
                </div>
              </div>
              <button type="button" onClick={() => void logout()} className="btn-primary px-3.5 py-2 text-xs">
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
