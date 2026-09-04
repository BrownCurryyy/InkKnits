import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { stations, projects } = useWorkspace();
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('inkknits-theme');
    return stored ? stored === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('inkknits-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    setExpandedProjects((current) => {
      const next = { ...current };
      projects.forEach((project) => {
        if (next[project.id] === undefined) next[project.id] = false;
      });
      return next;
    });
  }, [projects]);

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
    {
      label: 'Main',
      items: [
        { label: 'Home', path: '/', icon: 'H' },
        { label: 'Projects', path: '/projects', icon: 'P' },
      ],
    },
    {
      label: 'Organization',
      items: canManageOrganization ? [{ label: 'Organization', path: '/organization', icon: 'O' }] : [],
    },
    {
      label: 'Workflow',
      items: [
        ...(canReview ? [{ label: 'Approvals', path: '/approvals', icon: 'A' }] : []),
        { label: 'AI Queue', path: '/ai', icon: 'Q' },
        { label: 'Activity', path: '/activity', icon: 'T' },
        { label: 'Version Tracking', path: '/version-tracking', icon: 'V' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-200 dark:bg-backgroundDark dark:text-textDark">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-[#D9D6CF] bg-[#F5F3EE] p-5 shadow-[0_0_0_1px_rgba(13,13,13,0.02)] dark:border-[#292929] dark:bg-[#151515] lg:block">
        <button type="button" onClick={() => navigate('/')} className="mb-8 flex w-full items-center gap-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-[#F5F3EE] shadow-[0_10px_22px_rgba(229,57,53,0.22)]">
            I
          </div>
          <div>
            <div className="text-xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">InkKnits</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-text/50 dark:text-textDark/60">Production studio</div>
          </div>
        </button>

        <nav className="space-y-5" aria-label="Primary navigation">
          {sidebarSections.map((section) => section.items.length > 0 ? (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/55">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left text-sm font-medium transition ${isActive ? 'border-[#FCE9E8] bg-[#FCE9E8] text-text shadow-[0_0_0_1px_rgba(229,57,53,0.06)] dark:border-[#E53935]/40 dark:bg-[#1F1717] dark:text-textDark' : 'border-transparent text-text/70 hover:border-[#D9D6CF] hover:bg-[#F5F3EE] dark:text-textDark/75 dark:hover:bg-white/5'}`}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ${isActive ? 'bg-accent text-[#F5F3EE]' : 'bg-[#F5F3EE] text-text/65 dark:bg-[#1E1E1E] dark:text-textDark/70'}`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {section.label === 'Main' ? (
                <div className="mt-3 space-y-2 border-l border-[#D9D6CF] pl-3 dark:border-[#292929]">
                  {projectGroups.map(({ project, stations: projectStations }) => {
                    const expanded = expandedProjects[project.id] ?? false;
                    return (
                      <div key={project.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedProjects((current) => ({ ...current, [project.id]: !expanded }))}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-text/80 hover:bg-[#F5F3EE] dark:text-textDark/80 dark:hover:bg-white/5"
                        >
                          <span className="truncate">{project.title}</span>
                          <span aria-hidden="true" className="ml-2 text-text/45 dark:text-textDark/50">{expanded ? '−' : '+'}</span>
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
                                  className={`w-full rounded-lg px-2.5 py-2 text-left text-[11px] transition ${isActive ? 'bg-[#FCE9E8] font-semibold text-text dark:bg-[#1E1A1A] dark:text-textDark' : 'text-text/60 hover:bg-[#F5F3EE] dark:text-textDark/70 dark:hover:bg-white/5'}`}
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

      <header className="border-b border-[#D9D6CF] bg-[#F5F3EE]/90 backdrop-blur-sm dark:border-[#292929] dark:bg-[#151515]/90 lg:ml-72">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div
              onClick={() => navigate('/')}
              className="flex cursor-pointer items-center gap-3 transition hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-[#F5F3EE] shadow-[0_8px_18px_rgba(229,57,53,0.2)]">
                I
              </div>
              <div>
                <div className="text-base font-semibold tracking-[-0.03em] text-text dark:text-textDark">InkKnits</div>
                <div className="text-[11px] text-text/65 dark:text-textDark/70">
                  {user?.organization_id ? `Org ${user.organization_id.slice(0, 8)}` : 'Studio Workspace'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsDark((current) => !current)}
                className="hidden rounded-lg border border-[#D9D6CF] bg-[#F5F3EE] px-2.5 py-2 text-[11px] font-medium text-text transition hover:bg-[#FCE9E8] dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark dark:hover:bg-[#232323] sm:inline-flex"
              >
                {isDark ? 'Light' : 'Dark'}
              </button>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent dark:text-textDark">
                {highestRole}
              </span>
              <div className="hidden items-center gap-3 rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-2.5 py-1.5 dark:border-[#292929] dark:bg-[#1A1A1A] sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-backgroundDark text-[11px] font-bold text-textDark dark:bg-background dark:text-text">
                  {(user?.display_name ?? 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-[11px] font-semibold text-text dark:text-textDark">{user?.display_name ?? 'User'}</div>
                  <div className="text-[10px] text-text/60 dark:text-textDark/65">{user?.email ?? ''}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg bg-backgroundDark px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-textDark transition hover:opacity-90 dark:bg-background dark:text-text"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-64px)] max-w-[1440px] px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
