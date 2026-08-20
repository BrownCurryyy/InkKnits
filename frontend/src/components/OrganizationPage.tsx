import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type {
  OrganizationRecord,
  ProjectRecord,
  StationRecord,
  UserRecord,
  OrganizationRosterMemberRecord,
} from '../types';

function getPermissionMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('requires')
    ) {
      return "You don't have permission for this.";
    }
    return error.message;
  }
  return fallback;
}

export function OrganizationPage() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'people' | 'projects' | 'stations'>('overview');
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [members, setMembers] = useState<UserRecord[]>([]);
  const [roster, setRoster] = useState<OrganizationRosterMemberRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Modals state
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isStationModalOpen, setStationModalOpen] = useState(false);
  const [isMemberModalOpen, setMemberModalOpen] = useState(false);

  // Drafts
  const [projectDraft, setProjectDraft] = useState({ title: '', description: '', status: 'ACTIVE' });
  const [stationDraft, setStationDraft] = useState({ name: '', description: '', project_id: '', station_type: 'VIEWING' as StationRecord['station_type'] });
  const [memberDraft, setMemberDraft] = useState({ email: '', display_name: '', password: '', role: 'VIEWER' as 'ADMIN' | 'EDITOR' | 'REVIEWER' | 'VIEWER' });

  const isAdmin = roles.some((r) => r.toUpperCase() === 'ADMIN');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const orgs = await apiFetch<OrganizationRecord[]>('/organizations');
      setOrganizations(orgs);

      const targetOrgId = selectedOrgId || user?.organization_id || orgs[0]?.id || '';
      setSelectedOrgId(targetOrgId);

      if (targetOrgId) {
        const [mems, rosterData, projs, stas] = await Promise.all([
          apiFetch<UserRecord[]>(`/organizations/${targetOrgId}/members`).catch(() => []),
          apiFetch<OrganizationRosterMemberRecord[]>(`/organizations/${targetOrgId}/roster`).catch(() => []),
          apiFetch<ProjectRecord[]>('/projects').catch(() => []),
          apiFetch<StationRecord[]>('/stations').catch(() => []),
        ]);

        setMembers(mems);
        setRoster(rosterData);
        setProjects(projs.filter((p) => p.organization_id === targetOrgId));
        setStations(stas);
      }
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load organization details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedOrgId]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!selectedOrgId) return;
    try {
      await apiFetch(`/organizations/${selectedOrgId}/members/${userId}/role`, {
        method: 'PUT',
        body: { role_name: newRole },
      });
      showToast(`Role updated to ${newRole}`);
      await loadData();
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to update user role'));
    }
  };

  const handleCreateProject = async () => {
    if (!selectedOrgId || !projectDraft.title.trim()) return;
    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: {
          organization_id: selectedOrgId,
          title: projectDraft.title,
          description: projectDraft.description,
          status: projectDraft.status,
        },
      });
      setProjectModalOpen(false);
      setProjectDraft({ title: '', description: '', status: 'ACTIVE' });
      showToast('Project created successfully.');
      await loadData();
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to create project.'));
    }
  };

  const handleCreateStation = async () => {
    if (!stationDraft.name.trim() || !stationDraft.project_id || !stationDraft.station_type) {
      showToast('Please specify station name, type, and project.');
      return;
    }
    try {
      await apiFetch('/stations', {
        method: 'POST',
        body: {
          project_id: stationDraft.project_id,
          name: stationDraft.name,
          station_type: stationDraft.station_type,
          description: stationDraft.description,
        },
      });
      setStationModalOpen(false);
      setStationDraft({ name: '', description: '', project_id: '', station_type: 'VIEWING' });
      showToast('Station created successfully.');
      await loadData();
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to create station.'));
    }
  };

  const handleCreateMember = async () => {
    if (!selectedOrgId || !memberDraft.email.trim() || !memberDraft.display_name.trim() || memberDraft.password.length < 8) {
      showToast('Enter an email, display name, and password of at least 8 characters.');
      return;
    }
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        skipAuth: false,
        body: { ...memberDraft, organization_id: selectedOrgId },
      });
      setMemberModalOpen(false);
      setMemberDraft({ email: '', display_name: '', password: '', role: 'VIEWER' });
      await loadData();
      showToast('Member created and added to the organization.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to create member.'));
    }
  };

  const currentOrg = organizations.find((o) => o.id === selectedOrgId) ?? null;
  const stationsByProject = useMemo(
    () => projects.map((project) => ({
      project,
      stations: stations.filter((station) => station.project_id === project.id),
    })),
    [projects, stations],
  );

  if (loading) {
    return <CozySkeleton rows={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-2xl font-bold text-accent">
              ORG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  ORGANIZATION
                </span>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  Studio Admin
                </span>
              </div>
              <h2 className="text-2xl font-bold text-text dark:text-textDark">
                {currentOrg?.name || 'Organization Workspace'}
              </h2>
            </div>
          </div>

          {organizations.length > 1 ? (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="rounded-2xl border border-black/10 bg-background/80 px-3.5 py-2 text-xs font-semibold text-text outline-none dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Sub-Nav Tabs */}
        <div className="mt-5 flex gap-2 border-t border-black/5 pt-4 dark:border-white/5">
          {(['overview', 'people', 'projects', 'stations'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold capitalize transition ${
                activeTab === tab
                  ? 'bg-accent text-backgroundDark shadow-sm'
                  : 'bg-background/80 text-text/70 hover:text-text dark:bg-[#554949] dark:text-textDark/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          {error}
        </div>
      ) : null}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
              Total Members
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent">{members.length}</p>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Active team accounts</p>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
              Active Projects
            </h3>
            <p className="mt-2 text-3xl font-bold text-statusSuccess">{projects.length}</p>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Production campaigns</p>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
              Total Stations
            </h3>
            <p className="mt-2 text-3xl font-bold text-statusPending">{stations.length}</p>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Production areas</p>
          </div>
        </div>
      ) : null}

      {/* PEOPLE TAB */}
      {activeTab === 'people' ? (
        <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
          <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold text-text dark:text-textDark">Organization Members</h3>
              <p className="text-xs text-text/60 dark:text-textDark/60">
                ROLE defines capabilities; STATION defines functional work areas.
              </p>
            </div>
            {isAdmin ? <button type="button" onClick={() => setMemberModalOpen(true)} className="mb-4 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark">Add Member</button> : null}
            <div className="rounded-2xl bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent">
              Direct user invitation is managed via the Auth/RBAC contract.
            </div>
          </div>

          <div className="space-y-3">
            {(roster.length ? roster : members.map((user) => ({ user, role: 'VIEWER' as const, station_names: [] }))).map((entry) => {
              const m = entry.user;
              return (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-[#4f3d3d]/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-sm font-bold text-accent">
                    {(m.display_name || m.email || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text dark:text-textDark">{m.display_name}</h4>
                    <p className="text-xs text-text/60 dark:text-textDark/60">{m.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
                      SYSTEM ROLE
                    </span>
                    <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent">{entry.role}</span>
                    <div className="mt-1 flex max-w-xs flex-wrap justify-end gap-1">{entry.station_names.map((stationName) => <span key={stationName} className="rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold dark:bg-[#554949]">{stationName}</span>)}</div>
                  </div>

                  {isAdmin ? (
                    <select
                      onChange={(e) => void handleUpdateRole(m.id, e.target.value)}
                      defaultValue={entry.role}
                      className="rounded-xl border border-black/10 bg-white px-2.5 py-1 text-xs font-bold text-text outline-none dark:border-white/10 dark:bg-[#4f3d3d] dark:text-textDark"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="EDITOR">EDITOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* PROJECTS TAB */}
      {activeTab === 'projects' ? (
        <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
          <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold text-text dark:text-textDark">Organization Projects</h3>
              <p className="text-xs text-text/60 dark:text-textDark/60">
                Production contexts housing stations and creative assets
              </p>
            </div>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => setProjectModalOpen(true)}
                className="rounded-2xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark shadow-sm hover:opacity-90 active:scale-95"
              >
                ➕ New Project
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="group cursor-pointer rounded-2xl border border-black/5 bg-background/40 p-5 transition hover:-translate-y-1 hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/70"
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-base font-bold text-text dark:text-textDark group-hover:text-accent">
                    {p.title}
                  </h4>
                  <span className="rounded-full bg-statusSuccess/20 px-2.5 py-0.5 text-[10px] font-bold text-statusSuccess uppercase">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text/70 dark:text-textDark/70">{p.description || 'No description'}</p>
                <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3 text-[11px] text-accent font-bold">
                  <span>View Project State →</span>
                  {isAdmin ? <button type="button" onClick={(event) => { event.stopPropagation(); if (window.confirm(`Delete ${p.title}?`)) void apiFetch(`/projects/${p.id}`, { method: 'DELETE' }).then(() => loadData()); }} className="text-statusError">Delete</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* STATIONS TAB */}
      {activeTab === 'stations' ? (
        <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
          <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold text-text dark:text-textDark">Production Stations</h3>
              <p className="text-xs text-text/60 dark:text-textDark/60">
                Functional work destinations across projects
              </p>
            </div>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => setStationModalOpen(true)}
                className="rounded-2xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark shadow-sm hover:opacity-90 active:scale-95"
              >
                ➕ New Station
              </button>
            ) : null}
          </div>

          <div className="space-y-5">
            {stationsByProject.map(({ project, stations: projectStations }) => (
              <section key={project.id} className="rounded-2xl border border-black/10 bg-background/25 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/30">
                <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-3 dark:border-white/10">
                  <div><h4 className="font-bold">{project.title}</h4><p className="text-xs text-text/55 dark:text-textDark/55">{projectStations.length} production stations</p></div>
                  <button type="button" onClick={() => navigate(`/projects/${project.id}`)} className="text-xs font-bold text-accent">Open project</button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {projectStations.map((station) => (
                    <button key={station.id} type="button" onClick={() => navigate(`/stations/${station.id}`)} className="rounded-xl border border-black/10 bg-white/55 p-4 text-left transition hover:border-accent dark:border-white/10 dark:bg-[#423838]/55">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">{station.station_type}</span>
                      <h5 className="mt-1 font-bold">{station.name}</h5>
                      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{station.description || 'Production station'}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {/* New Project Modal */}
      {isProjectModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <h3 className="mb-4 text-xl font-bold">New Project</h3>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateProject();
              }}
            >
              <label className="block text-xs font-bold">
                <span className="mb-1 block">Title</span>
                <input
                  value={projectDraft.title}
                  onChange={(e) => setProjectDraft((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  required
                />
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1 block">Description</span>
                <textarea
                  value={projectDraft.description}
                  onChange={(e) => setProjectDraft((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-backgroundDark shadow-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* New Station Modal */}
      {isStationModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <h3 className="mb-4 text-xl font-bold">New Station</h3>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateStation();
              }}
            >
              <label className="block text-xs font-bold">
                <span className="mb-1 block">Project</span>
                <select
                  value={stationDraft.project_id}
                  onChange={(e) => setStationDraft((s) => ({ ...s, project_id: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  required
                >
                  <option value="">Select a Project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1 block">Station Name</span>
                <input
                  value={stationDraft.name}
                  onChange={(e) => setStationDraft((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  placeholder="e.g. Writing Station"
                  required
                />
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1 block">Description</span>
                <input
                  value={stationDraft.description}
                  onChange={(e) => setStationDraft((s) => ({ ...s, description: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStationModalOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-backgroundDark shadow-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isMemberModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark">
            <h3 className="mb-4 text-xl font-bold">Add Member</h3>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleCreateMember(); }}>
              <input type="email" required placeholder="Email" value={memberDraft.email} onChange={(event) => setMemberDraft((draft) => ({ ...draft, email: event.target.value }))} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-[#4f3d3d]" />
              <input required placeholder="Display name" value={memberDraft.display_name} onChange={(event) => setMemberDraft((draft) => ({ ...draft, display_name: event.target.value }))} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-[#4f3d3d]" />
              <input type="password" required minLength={8} placeholder="Temporary password" value={memberDraft.password} onChange={(event) => setMemberDraft((draft) => ({ ...draft, password: event.target.value }))} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-[#4f3d3d]" />
              <select value={memberDraft.role} onChange={(event) => setMemberDraft((draft) => ({ ...draft, role: event.target.value as typeof draft.role }))} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-[#4f3d3d]"><option>VIEWER</option><option>EDITOR</option><option>REVIEWER</option><option>ADMIN</option></select>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setMemberModalOpen(false)} className="rounded-xl bg-background px-4 py-2 text-xs font-bold dark:bg-[#554949]">Cancel</button><button type="submit" className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark">Create member</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#423838] px-5 py-3.5 text-sm font-medium text-[#FFF2C2] shadow-cozy border border-accent/20">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
