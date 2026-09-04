import { useEffect, useState } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { OrganizationRecord, OrganizationRosterMemberRecord, ProjectRecord, StationRecord } from '../types';

const ROLES = ['ADMIN', 'MANAGER', 'EDITOR', 'REVIEWER', 'PUBLISHER', 'VIEWER'] as const;
const STATION_ORDER: StationRecord['station_type'][] = ['WRITING', 'VIEWING', 'GENERATION', 'IMAGE'];
const STATION_LABELS: Record<StationRecord['station_type'], string> = {
  WRITING: 'Writing',
  VIEWING: 'Viewing',
  GENERATION: 'Generation',
  IMAGE: 'Image',
};

function getProjectIdsForMember(member: OrganizationRosterMemberRecord, stations: StationRecord[]) {
  const projectIds = new Set(member.project_ids ?? []);
  const stationIds = new Set(member.station_ids ?? []);
  stations.filter((station) => stationIds.has(station.id)).forEach((station) => projectIds.add(station.project_id));
  return projectIds;
}

function getStationNamesForMember(member: OrganizationRosterMemberRecord) {
  return new Set(member.station_names.map((name) => name.toLowerCase()));
}

export function OrganizationPage() {
  const { user } = useAuth();
  const { projects, stations, addProject, removeProject, refreshStations } = useWorkspace();
  const [organization, setOrganization] = useState<OrganizationRecord | null>(null);
  const [people, setPeople] = useState<OrganizationRosterMemberRecord[]>([]);
  const [role, setRole] = useState('VIEWER');
  const [newPerson, setNewPerson] = useState({ name: '', email: '', password: '' });
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    try {
      const [org, roster] = await Promise.all([
        apiFetch<OrganizationRecord[]>('/organizations'),
        apiFetch<OrganizationRosterMemberRecord[]>(`/organizations/${user.organization_id}/roster`),
      ]);

      setOrganization(org[0] || null);
      setPeople(roster);
      if (!selectedPersonId && roster.length > 0) setSelectedPersonId(roster[0].user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load organization.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      setError('');
      setMessage('');
      setBusyId('action');
      await action();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission denied or request failed.');
    } finally {
      setBusyId(null);
    }
  };

  const selectedPerson = people.find((person) => person.user.id === selectedPersonId) ?? null;

  const handleCreatePerson = () => {
    if (!user) return;
    void run(
      () => apiFetch('/auth/register', {
        method: 'POST',
        body: {
          email: newPerson.email,
          display_name: newPerson.name,
          password: newPerson.password,
          role,
          organization_id: user.organization_id,
        },
      }).then(() => undefined),
      'Person created.',
    );
  };

  const handleCreateProject = () => {
    if (!user || !newProject.title.trim()) return;
    void run(
      () => apiFetch<ProjectRecord>('/projects', {
        method: 'POST',
        body: {
          organization_id: user.organization_id,
          title: newProject.title.trim(),
          description: newProject.description.trim(),
          status: 'ACTIVE',
        },
      }).then(async (created) => {
        addProject(created);
        await refreshStations();
      }),
      'Project created.',
    );
    setNewProject({ title: '', description: '' });
  };

  const handleProjectAssign = async (memberId: string, projectId: string) => {
    if (!memberId || !projectId) return;
    await run(
      () => apiFetch(`/projects/${projectId}/members`, { method: 'POST', body: { user_id: memberId } }).then(() => undefined),
      'Project assigned.',
    );
  };

  const handleStationToggle = async (memberId: string, stationId: string, enabled: boolean) => {
    if (!user || !memberId || !stationId) return;
    await run(
      () => enabled
        ? apiFetch(`/stations/${stationId}/members/${memberId}`, { method: 'DELETE' }).then(() => undefined)
        : apiFetch(`/stations/${stationId}/members`, { method: 'POST', body: { user_id: memberId } }).then(() => undefined),
      enabled ? 'Station access disabled.' : 'Station access enabled.',
    );
  };

  const handleRemovePerson = (memberId: string, name: string) => {
    if (!user || memberId === user.id || !window.confirm(`Remove ${name} from this organization?`)) return;
    void run(
      () => apiFetch(`/organizations/${user.organization_id}/members/${memberId}`, { method: 'DELETE' }).then(() => undefined),
      'Person removed.',
    );
  };

  const handleDeleteProject = (projectId: string, title: string) => {
    if (!window.confirm(`Delete ${title}?`)) return;
    void run(
      () => apiFetch(`/projects/${projectId}`, { method: 'DELETE' }).then(() => removeProject(projectId)),
      'Project deleted.',
    );
  };

  if (loading) return <CozySkeleton rows={5} />;

  return (
    <div className="space-y-7">
      <header className="border-b border-black/10 pb-6 dark:border-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Organisation</p>
        <h1 className="mt-2 text-3xl font-bold">{organization?.name || 'Organization'}</h1>
        <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">People, project access, and station assignment.</p>
      </header>

      {error ? <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-3 text-sm text-statusError">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-statusSuccess/60 bg-statusSuccess/10 p-3 text-sm text-statusSuccess">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="People" value={String(people.length)} detail="Active members" />
        <SummaryCard label="Projects" value={String(projects.length)} detail="Current project list" />
        <SummaryCard label="Access" value={String(people.reduce((total, person) => total + person.project_names.length, 0))} detail="Project assignments" />
      </div>

      <section className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">People</h2>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">{people.length} members</span>
        </div>

        <div className="my-4 grid gap-2 lg:grid-cols-[1.2fr_1.2fr_1.3fr_0.8fr]">
          <input
            placeholder="Full name"
            value={newPerson.name}
            onChange={(event) => setNewPerson((current) => ({ ...current, name: event.target.value }))}
            className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-accent/60 dark:border-[#292929] dark:bg-[#1A1A1A]"
          />
          <input
            placeholder="Email"
            value={newPerson.email}
            onChange={(event) => setNewPerson((current) => ({ ...current, email: event.target.value }))}
            className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-accent/60 dark:border-[#292929] dark:bg-[#1A1A1A]"
          />
          <input
            type="password"
            placeholder="Temporary password"
            value={newPerson.password}
            onChange={(event) => setNewPerson((current) => ({ ...current, password: event.target.value }))}
            className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-accent/60 dark:border-[#292929] dark:bg-[#1A1A1A]"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-accent/60 dark:border-[#292929] dark:bg-[#1A1A1A]"
          >
            {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button
            type="button"
            onClick={handleCreatePerson}
            className="rounded-xl bg-accent px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-backgroundDark lg:col-span-4"
          >
            Add person
          </button>
        </div>

        {people.length === 0 ? (
          <CozyEmptyState icon="•" title="No people yet" message="Add the first member to this organization." />
        ) : (
          <div className="space-y-3">
            {people.map((person) => {
              const projectCount = person.project_names.length;
              const stationCount = person.station_names.length;
              const isSelected = selectedPersonId === person.user.id;
              return (
                <article
                  key={person.user.id}
                  className={[
                    'rounded-2xl border p-4 transition-colors',
                    isSelected
                      ? 'border-accent/60 bg-accent/10'
                      : 'border-[#D9D6CF] bg-[#F5F3EE]/80 dark:border-[#292929] dark:bg-[#1A1A1A]/80',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-text dark:text-textDark">{person.user.display_name}</h3>
                        <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">{person.role}</span>
                      </div>
                      <p className="mt-1 text-sm text-text/60 dark:text-textDark/60">{person.user.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-text/60 dark:text-textDark/60">
                      <span>{projectCount} project{projectCount === 1 ? '' : 's'}</span>
                      <span>·</span>
                      <span>{stationCount} station assignment{stationCount === 1 ? '' : 's'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPersonId(person.user.id)}
                        className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-xs font-bold text-text dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark"
                      >
                        {isSelected ? 'Selected' : 'Manage Access'}
                      </button>
                      <button type="button" disabled={person.user.id === user?.id || busyId === 'action'} onClick={() => handleRemovePerson(person.user.id, person.user.display_name)} className="rounded-xl px-3 py-2 text-xs font-bold text-statusError disabled:opacity-40">Remove</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Projects</h2>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Each project includes the four fixed workspace stations.</p>
          </div>
        </div>

        <div className="my-4 grid gap-2 lg:grid-cols-[1.5fr_1.5fr_0.7fr]">
          <input
            placeholder="Project name"
            value={newProject.title}
            onChange={(event) => setNewProject((current) => ({ ...current, title: event.target.value }))}
            className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-accent/60 dark:border-[#292929] dark:bg-[#1A1A1A]"
          />
          <input
            placeholder="Description"
            value={newProject.description}
            onChange={(event) => setNewProject((current) => ({ ...current, description: event.target.value }))}
            className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm outline-none focus:border-accent/60 dark:border-[#292929] dark:bg-[#1A1A1A]"
          />
          <button
            type="button"
            onClick={handleCreateProject}
            className="rounded-xl bg-accent px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-backgroundDark"
          >
            Create project
          </button>
        </div>

        {projects.length === 0 ? (
          <CozyEmptyState icon="•" title="No projects yet" message="Create your first project to begin assigning access." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {projects.map((project) => {
              const projectStations = stations.filter((station) => station.project_id === project.id).sort((left, right) => STATION_ORDER.indexOf(left.station_type) - STATION_ORDER.indexOf(right.station_type));
              const projectStationSummary = projectStations.map((station) => station.name).join(' · ') || 'No stations';
              return (
                <article key={project.id} className="rounded-2xl border border-black/10 bg-background/30 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-text dark:text-textDark">{project.title}</h3>
                      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{project.description || 'Project access workspace'}</p>
                    </div>
                    <div className="flex items-center gap-3"><span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">{projectStations.length} stations</span><button type="button" disabled={busyId === 'action'} onClick={() => handleDeleteProject(project.id, project.title)} className="text-xs font-bold text-statusError disabled:opacity-40">Delete</button></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {projectStations.map((station) => (
                      <span key={station.id} className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">{station.name}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-text/55 dark:text-textDark/55">{projectStationSummary}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedPerson ? (
        <section className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 dark:border-[#292929] dark:bg-[#151515]/90">
          <div className="flex flex-col gap-2 border-b border-black/10 pb-4 dark:border-white/10 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Manage Access</p>
              <h2 className="mt-1 text-2xl font-bold">{selectedPerson.user.display_name}</h2>
            </div>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">{selectedPerson.role}</span>
          </div>

          <div className="mt-5 space-y-4">
            {projects.map((project) => {
              const projectStations = stations
                .filter((station) => station.project_id === project.id)
                .sort((left, right) => STATION_ORDER.indexOf(left.station_type) - STATION_ORDER.indexOf(right.station_type));
              const memberProjectIds = getProjectIdsForMember(selectedPerson, stations);
              const assigned = memberProjectIds.has(project.id);
              const stationNames = getStationNamesForMember(selectedPerson);
              const assignedCount = projectStations.filter((station) => stationNames.has(station.name.toLowerCase())).length;

              return (
                <article key={project.id} className="rounded-2xl border border-black/10 bg-background/30 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/40">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{project.title}</h3>
                      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{project.description || 'Project access workspace'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !assigned && void handleProjectAssign(selectedPerson.user.id, project.id)}
                      disabled={assigned || busyId !== null}
                      className={[
                        'rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors',
                        assigned
                          ? 'bg-statusSuccess/15 text-statusSuccess'
                          : 'bg-accent text-backgroundDark',
                      ].join(' ')}
                    >
                      {assigned ? 'Project assigned' : 'Assign project'}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-text/55 dark:text-textDark/55">
                    <span>Stations</span>
                    <span>{assignedCount} / {projectStations.length}</span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {projectStations.map((station) => {
                      const isSelected = (selectedPerson.station_ids ?? []).includes(station.id);
                      return (
                        <button
                          key={station.id}
                          type="button"
                          disabled={!assigned || busyId !== null}
                          onClick={() => void handleStationToggle(selectedPerson.user.id, station.id, isSelected)}
                          className={[
                            'rounded-2xl border p-3 text-left transition-colors',
                            isSelected
                              ? 'border-accent/70 bg-accent/10 text-text shadow-[inset_0_0_0_1px_rgba(120,96,72,0.12)] dark:text-textDark'
                              : 'border-black/10 bg-white/60 text-text/70 hover:border-accent/50 hover:bg-accent/5 dark:border-white/10 dark:bg-[#352d2d] dark:text-textDark/80',
                            !assigned ? 'cursor-not-allowed opacity-45' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{STATION_LABELS[station.station_type]}</span>
                            {isSelected ? <span className="text-[10px] font-bold text-statusSuccess">ON</span> : <span className="text-[10px] font-bold text-text/45 dark:text-textDark/50">OFF</span>}
                          </div>
                          <div className="mt-4 text-xs text-text/60 dark:text-textDark/60">{isSelected ? 'Access enabled' : 'Not assigned'}</div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-4 dark:border-[#292929] dark:bg-[#151515]/90">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{label}</p>
      <div className="mt-2 text-2xl font-bold text-text dark:text-textDark">{value}</div>
      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{detail}</p>
    </div>
  );
}
