import { useEffect, useState } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { OrganizationRecord, OrganizationRosterMemberRecord, ProjectRecord, StationRecord } from '../types';

const ROLES = ['ADMIN', 'MANAGER', 'EDITOR', 'REVIEWER', 'PUBLISHER', 'VIEWER'] as const;

export function OrganizationPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationRecord | null>(null);
  const [people, setPeople] = useState<OrganizationRosterMemberRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [role, setRole] = useState('VIEWER');
  const [newPerson, setNewPerson] = useState({ name: '', email: '', password: '' });
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [projectChoice, setProjectChoice] = useState<Record<string, string>>({});
  const [stationChoice, setStationChoice] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    try {
      const [org, roster, projectData, stationData] = await Promise.all([
        apiFetch<OrganizationRecord[]>('/organizations'),
        apiFetch<OrganizationRosterMemberRecord[]>(`/organizations/${user.organization_id}/roster`),
        apiFetch<ProjectRecord[]>('/projects'),
        apiFetch<StationRecord[]>('/stations'),
      ]);
      setOrganization(org[0] || null);
      setPeople(roster);
      setProjects(projectData);
      setStations(stationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load organization.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id]);

  const run = async (action: () => Promise<void>, success: string) => {
    try { setError(''); await action(); setMessage(success); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Permission denied or request failed.'); }
  };

  if (loading) return <CozySkeleton rows={5} />;

  return <div className="space-y-7"><header className="border-b border-black/10 pb-6 dark:border-white/10"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Administration</p><h1 className="mt-2 text-3xl font-bold">{organization?.name || 'Organization'}</h1><p className="mt-2 text-sm text-text/65 dark:text-textDark/65">People, roles, projects, and assigned workspaces.</p></header>{error ? <p className="rounded-xl bg-statusError/10 p-3 text-sm text-statusError">{error}</p> : null}{message ? <p className="rounded-xl bg-statusSuccess/10 p-3 text-sm text-statusSuccess">{message}</p> : null}<People people={people} projects={projects} stations={stations} currentUserId={user?.id} role={role} onRoleChange={setRole} newPerson={newPerson} onPersonChange={setNewPerson} onAdd={() => user && void run(() => apiFetch('/auth/register', { method: 'POST', body: { email: newPerson.email, display_name: newPerson.name, password: newPerson.password, role, organization_id: user.organization_id } }).then(() => undefined), 'Person created.')} projectChoice={projectChoice} stationChoice={stationChoice} setProjectChoice={(id, value) => setProjectChoice({ ...projectChoice, [id]: value })} setStationChoice={(id, value) => setStationChoice({ ...stationChoice, [id]: value })} assignProject={(id) => void run(() => apiFetch(`/projects/${projectChoice[id]}/members`, { method: 'POST', body: { user_id: id } }).then(() => undefined), 'Project assigned.')} assignStation={(id) => void run(() => apiFetch(`/stations/${stationChoice[id]}/members`, { method: 'POST', body: { user_id: id } }).then(() => undefined), 'Station assigned.')} updateRole={(id, value) => user && void run(() => apiFetch(`/organizations/${user.organization_id}/members/${id}/role`, { method: 'PUT', body: { role_name: value } }).then(() => undefined), 'Role updated.')} /><Projects projects={projects} stations={stations} newProject={newProject} setNewProject={setNewProject} create={() => user && void run(() => apiFetch('/projects', { method: 'POST', body: { organization_id: user.organization_id, ...newProject } }).then(() => undefined), 'Project created.')} archive={(id) => void run(() => apiFetch(`/projects/${id}`, { method: 'DELETE' }).then(() => undefined), 'Project archived.')} /></div>;
}

function People(props: { people: OrganizationRosterMemberRecord[]; projects: ProjectRecord[]; stations: StationRecord[]; currentUserId?: string; role: string; onRoleChange: (value: string) => void; newPerson: { name: string; email: string; password: string }; onPersonChange: (value: { name: string; email: string; password: string }) => void; onAdd: () => void; projectChoice: Record<string, string>; stationChoice: Record<string, string>; setProjectChoice: (id: string, value: string) => void; setStationChoice: (id: string, value: string) => void; assignProject: (id: string) => void; assignStation: (id: string) => void; updateRole: (id: string, value: string) => void }) {
  return <section className="rounded-2xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/70"><h2 className="text-lg font-bold">People</h2><div className="my-4 grid gap-2 md:grid-cols-4"><input placeholder="Name" value={props.newPerson.name} onChange={(e) => props.onPersonChange({ ...props.newPerson, name: e.target.value })} className="field" /><input placeholder="Email" value={props.newPerson.email} onChange={(e) => props.onPersonChange({ ...props.newPerson, email: e.target.value })} className="field" /><input placeholder="Temporary password" type="password" value={props.newPerson.password} onChange={(e) => props.onPersonChange({ ...props.newPerson, password: e.target.value })} className="field" /><button type="button" onClick={props.onAdd} className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark">Add person</button></div>{props.people.length === 0 ? <CozyEmptyState icon="◎" title="No people" message="No organization members are available." /> : <div className="space-y-3">{props.people.map((person) => { const assignedProjectIds = props.projects.filter((project) => person.project_names.includes(project.title)).map((project) => project.id); const allowedStations = props.stations.filter((station) => assignedProjectIds.includes(station.project_id)); return <div key={person.user.id} className="rounded-xl border border-black/5 bg-background/40 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/50"><div className="grid gap-3 lg:grid-cols-4"><div><b>{person.user.display_name}</b><p className="text-xs text-text/60">{person.user.email}</p></div><select value={person.role} disabled={person.user.id === props.currentUserId} onChange={(e) => props.updateRole(person.user.id, e.target.value)} className="field">{ROLES.map((item) => <option key={item}>{item}</option>)}</select><Assignment label="Projects" values={person.project_names} options={props.projects.map((item) => [item.id, item.title])} value={props.projectChoice[person.user.id] || ''} onChange={(value) => props.setProjectChoice(person.user.id, value)} onAssign={() => props.assignProject(person.user.id)} /><Assignment label="Stations" values={person.station_names} options={allowedStations.map((item) => [item.id, item.name])} value={props.stationChoice[person.user.id] || ''} onChange={(value) => props.setStationChoice(person.user.id, value)} onAssign={() => props.assignStation(person.user.id)} /></div></div>; })}</div>}</section>;
}

function Assignment(props: { label: string; values: string[]; options: string[][]; value: string; onChange: (value: string) => void; onAssign: () => void }) {
  return <div><p className="text-[10px] font-bold uppercase text-text/50">{props.label}</p><p className="text-xs">{props.values.join(', ') || 'None assigned'}</p><div className="mt-1 flex gap-1"><select value={props.value} onChange={(e) => props.onChange(e.target.value)} className="field min-w-0 flex-1"><option value="">Assign...</option>{props.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button type="button" onClick={props.onAssign} className="rounded-lg bg-accent/20 px-2 text-xs font-bold text-accent">Add</button></div></div>;
}

function Projects(props: { projects: ProjectRecord[]; stations: StationRecord[]; newProject: { title: string; description: string }; setNewProject: (value: { title: string; description: string }) => void; create: () => void; archive: (id: string) => void }) {
  return <section className="rounded-2xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/70"><h2 className="text-lg font-bold">Projects</h2><p className="mt-1 text-xs text-text/60">Projects automatically receive the four fixed stations.</p><div className="my-4 grid gap-2 md:grid-cols-3"><input placeholder="Project name" value={props.newProject.title} onChange={(e) => props.setNewProject({ ...props.newProject, title: e.target.value })} className="field" /><input placeholder="Description" value={props.newProject.description} onChange={(e) => props.setNewProject({ ...props.newProject, description: e.target.value })} className="field" /><button type="button" onClick={props.create} className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark">Create project</button></div>{props.projects.map((project) => <div key={project.id} className="mb-3 rounded-xl border border-black/5 p-4 dark:border-white/10"><div className="flex justify-between"><b>{project.title}</b><button type="button" onClick={() => props.archive(project.id)} className="text-xs font-bold text-statusError">Archive</button></div><p className="mt-2 text-xs text-text/60">{project.description}</p><div className="mt-3 flex flex-wrap gap-2">{props.stations.filter((station) => station.project_id === project.id).map((station) => <span key={station.id} className="rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">{station.name}</span>)}</div></div>)}</section>;
}
