import { useEffect, useState } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { OrganizationRecord, OrganizationRosterMemberRecord, ProjectRecord, StationRecord } from '../types';

const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'EDITOR', 'REVIEWER', 'PUBLISHER', 'VIEWER'] as const;

type Draft = { title: string; description: string };

export function OrganizationPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationRecord | null>(null);
  const [roster, setRoster] = useState<OrganizationRosterMemberRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [newMember, setNewMember] = useState({ email: '', display_name: '', password: '', role: 'VIEWER' });
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [projectDrafts, setProjectDrafts] = useState<Record<string, Draft>>({});
  const [selectedProjectByUser, setSelectedProjectByUser] = useState<Record<string, string>>({});
  const [selectedStationByUser, setSelectedStationByUser] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!user) return;
    try {
      setError('');
      const [orgs, rosterData, projectData, stationData] = await Promise.all([
        apiFetch<OrganizationRecord[]>('/organizations'),
        apiFetch<OrganizationRosterMemberRecord[]>(`/organizations/${user.organization_id}/roster`),
        apiFetch<ProjectRecord[]>('/projects'),
        apiFetch<StationRecord[]>('/stations'),
      ]);
      setOrganization(orgs[0] ?? null);
      setRoster(rosterData);
      setProjects(projectData);
      setStations(stationData);
      setProjectDrafts(Object.fromEntries(projectData.map((project) => [project.id, { title: project.title, description: project.description || '' }])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load organization administration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id]);

  const createMember = async () => {
    if (!user || !newMember.email || !newMember.display_name || newMember.password.length < 8) return;
    try {
      await apiFetch('/auth/register', { method: 'POST', body: { ...newMember, organization_id: user.organization_id } });
      setNewMember({ email: '', display_name: '', password: '', role: 'VIEWER' });
      setNotice('Member created.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create member.'); }
  };

  const updateRole = async (memberId: string, role: string) => {
    if (!user) return;
    try {
      await apiFetch(`/organizations/${user.organization_id}/members/${memberId}/role`, { method: 'PUT', body: { role_name: role } });
      setNotice('Role updated.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update role.'); }
  };

  const assignProject = async (memberId: string) => {
    const projectId = selectedProjectByUser[memberId];
    if (!projectId) return;
    try {
      await apiFetch(`/projects/${projectId}/members`, { method: 'POST', body: { user_id: memberId } });
      setNotice('Project assignment saved.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to assign project.'); }
  };

  const assignStation = async (memberId: string) => {
    const stationId = selectedStationByUser[memberId];
    if (!stationId) return;
    try {
      await apiFetch(`/stations/${stationId}/members`, { method: 'POST', body: { user_id: memberId } });
      setNotice('Station assignment saved.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to assign station.'); }
  };

  const createProject = async () => {
    if (!user || !newProject.title.trim()) return;
    try {
      await apiFetch('/projects', { method: 'POST', body: { organization_id: user.organization_id, title: newProject.title.trim(), description: newProject.description } });
      setNewProject({ title: '', description: '' });
      setNotice('Project created with four fixed stations.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create project.'); }
  };

  const updateProject = async (projectId: string) => {
    const draft = projectDrafts[projectId];
    if (!draft) return;
    try {
      await apiFetch(`/projects/${projectId}`, { method: 'PUT', body: draft });
      setNotice('Project updated.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update project.'); }
  };

  const archiveProject = async (project: ProjectRecord) => {
    if (!window.confirm(`Archive ${project.title}?`)) return;
    try {
      await apiFetch(`/projects/${project.id}`, { method: 'DELETE' });
      setNotice('Project archived.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to archive project.'); }
  };

  if (loading) return <CozySkeleton rows={6} />;

  return (
    <div className="space-y-7">
      <header className="border-b border-black/10 pb-6 dark:border-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Administration</p>
        <h1 className="mt-2 text-3xl font-bold">{organization?.name || 'Organization'}</h1>
        <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">Manage people and assigned project participation.</p>
      </header>
      {error ? <div className="rounded-xl border border-statusError/40 bg-statusError/10 p-3 text-sm text-statusError">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-statusSuccess/40 bg-statusSuccess/10 p-3 text-sm text-statusSuccess">{notice}</div> : null}
      <PeopleSection
        roster={roster}
        projects={projects}
        stations={stations}
        newMember={newMember}
        selectedProjectByUser={selectedProjectByUser}
        selectedStationByUser={selectedStationByUser}
        currentUserId={user?.id}
        onMemberChange={setNewMember}
        onAddMember={() => void createMember()}
        onRoleChange={(id, role) => void updateRole(id, role)}
        onProjectChange={(id, value) => setSelectedProjectByUser({ ...selectedProjectByUser, [id]: value })}
        onStationChange={(id, value) => setSelectedStationByUser({ ...selectedStationByUser, [id]: value })}
        onAssignProject={(id) => void assignProject(id)}
        onAssignStation={(id) => void assignStation(id)}
      />
      <ProjectsSection projects={projects} stations={stations} drafts={projectDrafts} newProject={newProject} onNewProjectChange={setNewProject} onCreate={() => void createProject()} onDraftChange={(id, draft) => setProjectDrafts({ ...projectDrafts, [id]: draft })} onSave={(id) => void updateProject(id)} onArchive={archiveProject} />
    </div>
  );
}

function PeopleSection(props: { roster: OrganizationRosterMemberRecord[]; projects: ProjectRecord[]; stations: StationRecord[]; newMember: { email: string; display_name: string; password: string; role: string }; selectedProjectByUser: Record<string, string>; selectedStationByUser: Record<string, string>; currentUserId?: string; onMemberChange: (value: { email: string; display_name: string; password: string; role: string }) => void; onAddMember: () => void; onRoleChange: (id: string, role: string) => void; onProjectChange: (id: string, value: string) => void; onStationChange: (id: string, value: string) => void; onAssignProject: (id: string) => void; onAssignStation: (id: string) => void }) {
  return <section className="rounded-2xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/70"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">People</h2><p className="mt-1 text-xs text-text/60">Role and project/station participation are managed here.</p></div><span className="text-xs text-text/55">{props.roster.length} members</span></div><div className="mb-6 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"><input value={props.newMember.display_name} onChange={(event) => props.onMemberChange({ ...props.newMember, display_name: event.target.value })} placeholder="Name" className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]" /><input value={props.newMember.email} onChange={(event) => props.onMemberChange({ ...props.newMember, email: event.target.value })} placeholder="Email" className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]" /><input type="password" value={props.newMember.password} onChange={(event) => props.onMemberChange({ ...props.newMember, password: event.target.value })} placeholder="Temporary password" className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]" /><button type="button" onClick={props.onAddMember} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark">Add person</button></div>{props.roster.length === 0 ? <CozyEmptyState icon="◎" title="No people" message="Add an organization member to begin assigning work." /> : <div className="space-y-3">{props.roster.map((entry) => <div key={entry.user.id} className="rounded-xl border border-black/5 bg-background/40 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/50"><div className="grid gap-4 xl:grid-cols-[1.1fr_150px_1fr_1fr]"><div><p className="font-bold">{entry.user.display_name}</p><p className="text-xs text-text/60">{entry.user.email}</p></div><select value={entry.role} onChange={(event) => props.onRoleChange(entry.user.id, event.target.value)} disabled={entry.user.id === props.currentUserId} className="rounded-lg border border-black/10 bg-background px-2 py-2 text-xs dark:border-white/10 dark:bg-[#554949]">{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select><Assignment label="Projects" values={entry.project_names} options={props.projects.map((project) => ({ id: project.id, label: project.title }))} value={props.selectedProjectByUser[entry.user.id] || ''} onChange={(value) => props.onProjectChange(entry.user.id, value)} onAssign={() => props.onAssignProject(entry.user.id)} /><Assignment label="Stations" values={entry.station_names} options={props.stations.map((station) => ({ id: station.id, label: `${station.name} · ${station.project_id.slice(0, 8)}` }))} value={props.selectedStationByUser[entry.user.id] || ''} onChange={(value) => props.onStationChange(entry.user.id, value)} onAssign={() => props.onAssignStation(entry.user.id)} /></div></div>)}</div>}</section>;
}

function Assignment(props: { label: string; values: string[]; options: { id: string; label: string }[]; value: string; onChange: (value: string) => void; onAssign: () => void }) {
  return <div><p className="mb-1 text-[10px] font-bold uppercase text-text/50">{props.label}</p><p className="min-h-5 text-xs">{props.values.length ? props.values.join(', ') : 'None assigned'}</p><div className="mt-2 flex gap-1"><select value={props.value} onChange={(event) => props.onChange(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-black/10 bg-background px-2 py-1 text-[11px] dark:border-white/10 dark:bg-[#554949]"><option value="">Assign...</option>{props.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><button type="button" onClick={props.onAssign} className="rounded-lg bg-accent/20 px-2 text-[11px] font-bold text-accent">Add</button></div></div>;
}

function ProjectsSection(props: { projects: ProjectRecord[]; stations: StationRecord[]; drafts: Record<string, Draft>; newProject: Draft; onNewProjectChange: (value: Draft) => void; onCreate: () => void; onDraftChange: (id: string, value: Draft) => void; onSave: (id: string) => void; onArchive: (project: ProjectRecord) => void }) {
  return <section className="rounded-2xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/70"><div className="mb-4"><h2 className="text-lg font-bold">Projects</h2><p className="mt-1 text-xs text-text/60">Every project is provisioned with Writing, Viewing, Generation, and Image stations.</p></div><div className="mb-5 grid gap-2 md:grid-cols-[1fr_2fr_auto]"><input value={props.newProject.title} onChange={(event) => props.onNewProjectChange({ ...props.newProject, title: event.target.value })} placeholder="Project name" className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]" /><input value={props.newProject.description} onChange={(event) => props.onNewProjectChange({ ...props.newProject, description: event.target.value })} placeholder="Description" className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]" /><button type="button" onClick={props.onCreate} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark">Create project</button></div>{props.projects.length === 0 ? <CozyEmptyState icon="⌂" title="No projects" message="Create a project to provision its fixed stations." /> : <div className="space-y-3">{props.projects.map((project) => { const draft = props.drafts[project.id] || { title: project.title, description: project.description || '' }; return <div key={project.id} className="rounded-xl border border-black/5 bg-background/40 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/50"><div className="grid gap-3 md:grid-cols-[1fr_2fr_auto_auto]"><input value={draft.title} onChange={(event) => props.onDraftChange(project.id, { ...draft, title: event.target.value })} className="rounded-lg border border-black/10 bg-background px-2 py-2 text-sm dark:border-white/10 dark:bg-[#554949]" /><input value={draft.description} onChange={(event) => props.onDraftChange(project.id, { ...draft, description: event.target.value })} placeholder="Description" className="rounded-lg border border-black/10 bg-background px-2 py-2 text-sm dark:border-white/10 dark:bg-[#554949]" /><button type="button" onClick={() => props.onSave(project.id)} className="rounded-lg bg-accent/20 px-3 py-2 text-xs font-bold text-accent">Save</button><button type="button" onClick={() => props.onArchive(project)} className="rounded-lg bg-statusError/10 px-3 py-2 text-xs font-bold text-statusError">Archive</button></div><div className="mt-3 flex flex-wrap gap-2">{props.stations.filter((station) => station.project_id === project.id).map((station) => <span key={station.id} className="rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">{station.name} · {station.station_type}</span>)}</div></div>; })}</div>}</section>;
}
