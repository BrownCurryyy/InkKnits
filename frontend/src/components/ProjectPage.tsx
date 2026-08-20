import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type {
  ApprovalTaskRecord,
  AssetRecord,
  AssetVersionRecord,
  ProjectRecord,
  StationRecord,
  UserRecord,
  VersionBundleRecord,
} from '../types';
import { useAuth } from '../context/AuthContext';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AssetBundleItem {
  asset: AssetRecord;
  currentVersion?: AssetVersionRecord;
  versions: AssetVersionRecord[];
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [bundleItems, setBundleItems] = useState<AssetBundleItem[]>([]);
  const [members, setMembers] = useState<UserRecord[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberId, setMemberId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAllProjects = async () => {
    try {
      const allProjects = await apiFetch<ProjectRecord[]>('/projects');
      setProjects(allProjects);
      if (!selectedProjectId && allProjects[0]) {
        setSelectedProjectId(allProjects[0].id);
      }
    } catch {
      setError('Unable to load projects list');
    }
  };

  const loadProjectDetails = async (id: string) => {
    try {
      setLoading(true);
      setError('');

      // Fetch Project Details
      const proj = await apiFetch<ProjectRecord>(`/projects/${id}`);
      setProject(proj);

      // Fetch Org Members
      const mems = await apiFetch<UserRecord[]>(`/organizations/${proj.organization_id}/members`).catch(() => []);
      setMembers(mems);

      // Fetch Stations
      const allStations = await apiFetch<StationRecord[]>('/stations');
      const projStations = allStations.filter((s) => s.project_id === id);
      setStations(projStations);

      // Fetch the complete project asset set and its live production-state selection.
      const allAssets = await apiFetch<AssetRecord[]>('/assets');
      const stationIds = new Set(projStations.map((s) => s.id));
      const projAssets = allAssets.filter((a) => stationIds.has(a.station_id));
      setAssets(projAssets);

      const productionState = await apiFetch<{ assets: Array<{ asset: AssetRecord; current_version: AssetVersionRecord }> }>(`/projects/${id}/production-state`).catch(() => ({ assets: [] }));
      const bundleResponse = await apiFetch<VersionBundleRecord[]>(`/projects/${id}/bundles`).catch(() => []);
      const bundleItems = bundleResponse[0]?.items ?? [];
      const bundledVersions = new Map(bundleItems.map((item) => [item.asset_id, item]));
      const currentVersions = new Map(productionState.assets.map((item) => [item.asset.id, item.current_version]));
      bundleItems.forEach((item) => {
        const current = currentVersions.get(item.asset_id);
        if (current && current.id !== item.version_id) currentVersions.set(item.asset_id, { ...current, id: item.version_id, version_number: item.version_number, created_at: item.created_at, created_by: item.created_by });
      });

      // Build the visual project bundle: every asset branch plus full history.
      const items: AssetBundleItem[] = await Promise.all(
        projAssets.map(async (asset) => {
          let versions: AssetVersionRecord[] = [];
          try {
            const vers = await apiFetch<AssetVersionRecord[]>(`/versions/${asset.id}`);
            versions = [...vers].sort((a, b) => a.version_number - b.version_number);
          } catch {
            versions = [];
          }
          return { asset, currentVersion: currentVersions.get(asset.id) ?? (bundledVersions.get(asset.id) ? versions.find((version) => version.id === bundledVersions.get(asset.id)?.version_id) : undefined), versions };
        }),
      );
      setBundleItems(items);

      // Fetch Approvals count
      try {
        const tasks = await apiFetch<ApprovalTaskRecord[]>('/approvals/tasks');
        const assetIds = new Set(projAssets.map((a) => a.id));
        const pending = tasks.filter((t) => assetIds.has(t.asset_id) && t.status === 'PENDING');
        setPendingApprovalsCount(pending.length);
      } catch {
        setPendingApprovalsCount(0);
      }
    } catch {
      setError('Unable to load project production state');
    } finally {
      setLoading(false);
    }
  };

  const addProjectMember = async () => {
    if (!project || !memberId) return;
    try {
      await apiFetch(`/projects/${project.id}/members`, { method: 'POST', body: { user_id: memberId } });
      setMemberPickerOpen(false);
      setMemberId('');
    } catch {
      setError('Unable to add project member');
    }
  };

  useEffect(() => {
    void loadAllProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void loadProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId]);

  if (loading && !project) {
    return <CozySkeleton rows={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-2xl font-bold text-accent">
              📌
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  PROJECT STATE
                </span>
                <span className="rounded-full bg-statusSuccess/20 px-2.5 py-0.5 text-xs font-bold text-statusSuccess uppercase">
                  {project?.status || 'ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-text dark:text-textDark">
                {project?.title || 'Production Project'}
              </h2>
            </div>
          </div>

          {/* Project Selector */}
          {projects.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text/60 dark:text-textDark/60">Switch Project:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  navigate(`/projects/${e.target.value}`);
                }}
                className="rounded-2xl border border-black/10 bg-background/80 px-3.5 py-2 text-xs font-bold text-text outline-none dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {project?.description ? (
          <p className="mt-3 text-xs leading-relaxed text-text/70 dark:text-textDark/70">
            {project.description}
          </p>
        ) : null}

        {/* Current Production State Metrics */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-background/50 p-4 dark:border-white/5 dark:bg-[#4f3d3d]/50">
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">CURRENT ASSETS</p>
            <p className="mt-1 text-2xl font-bold text-statusSuccess">{assets.length}</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Active production assets</p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-background/50 p-4 dark:border-white/5 dark:bg-[#4f3d3d]/50">
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">AWAITING APPROVAL</p>
            <p className="mt-1 text-2xl font-bold text-statusPending">{pendingApprovalsCount}</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Review tasks pending</p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-background/50 p-4 dark:border-white/5 dark:bg-[#4f3d3d]/50">
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">PRODUCTION STATIONS</p>
            <p className="mt-1 text-2xl font-bold text-accent">{stations.length}</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Functional work areas</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          ⚠️ {error}
        </div>
      ) : null}

      {/* Production Stations in this Project */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <h3 className="text-base font-bold text-text dark:text-textDark">Project Stations</h3>
          <span className="text-xs text-text/60 dark:text-textDark/60">Functional work destinations</span>
        </div>

        {stations.length === 0 ? (
          <CozyEmptyState
            icon="⌂"
            title="No stations in this project"
            message="Add a station to organize your writing, editing, and generation tasks."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((st) => (
              <div
                key={st.id}
                onClick={() => navigate(`/stations/${st.id}`)}
                className="group cursor-pointer rounded-2xl border border-black/5 bg-background/40 p-4 transition hover:-translate-y-1 hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-lg font-bold text-accent">
                    {st.name}
                  </div>
                  <div>
                    <h4 className="font-bold text-text dark:text-textDark group-hover:text-accent">
                      {st.name}
                    </h4>
                    <p className="text-xs text-text/60 dark:text-textDark/60">
                      {st.description || 'Station Overview'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PROJECT VERSION BUNDLE / PRODUCTION STATE VISUALIZATION */}
      <div className="rounded-2xl border border-accent/45 bg-white/55 p-6 shadow-cozy dark:border-accent/35 dark:bg-[#3a2d2d]/75">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                PRODUCTION STATE BUNDLE
              </span>
              <span className="rounded-full bg-statusSuccess/20 px-2 py-0.5 text-[10px] font-bold text-statusSuccess">
                Live assembled state
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-bold text-text dark:text-textDark">
                Project Assets & Current Production Versions
            </h3>
          </div>
        </div>

        {bundleItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-text/60 dark:text-textDark/60">
            No assets created in this project yet.
          </p>
        ) : (
          <div className="relative pl-6">
            {/* Vertical Tree Trunk */}
            <div className="absolute left-[11px] top-3 h-[calc(100%-24px)] w-0.5 rounded-full bg-accent/40" />

            <div className="space-y-4">
              {bundleItems.map(({ asset, currentVersion, versions }) => {
                const versionNum = currentVersion?.version_number;
                const lastUpdated = currentVersion?.created_at || asset.updated_at || asset.created_at;

                return (
                  <div key={asset.id} className="relative flex items-start gap-4">
                    {/* Tree Node Dot */}
                    <div className="absolute -left-[23px] top-4 h-3.5 w-3.5 rounded-full border-2 border-white bg-accent shadow-sm dark:border-[#3a2d2d]" />

                    {/* Asset Bundle Card */}
                    <div
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="group flex flex-1 cursor-pointer flex-col gap-2 rounded-xl border border-black/10 bg-white/80 p-4 transition hover:border-accent hover:shadow-cozy sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#2d2222]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-base font-bold text-accent">
                          {asset.asset_type.slice(0, 1)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-text dark:text-textDark group-hover:text-accent">
                              {asset.title || asset.name}
                            </h4>
                            <span className="rounded-lg bg-statusSuccess/20 px-2 py-0.5 text-xs font-bold text-statusSuccess">
                              {versionNum ? `v${versionNum} CURRENT` : 'NO VERSION'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-text/60 dark:text-textDark/60">
                            {asset.asset_type} · {versions.length} version{versions.length === 1 ? '' : 's'}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {versions.map((version) => (
                              <span
                                key={version.id}
                                title={`Created ${formatDate(version.created_at)} by ${version.created_by || 'system'}`}
                                className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${currentVersion?.id === version.id ? 'border-statusSuccess bg-statusSuccess/20 text-statusSuccess' : 'border-black/10 bg-background/50 text-text/55 dark:border-white/10 dark:bg-[#423838] dark:text-textDark/55'}`}
                              >
                                v{version.version_number}{currentVersion?.id === version.id ? ' CURRENT' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <div className="text-right text-[11px] text-text/60 dark:text-textDark/60">
                          <div>
                            Updated by:{' '}
                              <span className="font-bold">{currentVersion?.created_by || 'system'}</span>
                          </div>
                          <div>{formatDate(lastUpdated)}</div>
                        </div>

                        <button
                          type="button"
                          className="rounded-xl bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent transition group-hover:bg-accent group-hover:text-backgroundDark"
                        >
                          Workspace →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Project Team Members */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <h3 className="text-base font-bold text-text dark:text-textDark">Project Team Members</h3>
          <div className="flex items-center gap-2"><span className="text-xs text-text/60 dark:text-textDark/60">{members.length} members</span>{roles.some((role) => role.toUpperCase() === 'ADMIN') ? <button type="button" onClick={() => setMemberPickerOpen(true)} className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-backgroundDark">Add member</button> : null}</div>
        </div>

        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 rounded-2xl border border-black/5 bg-background/40 px-3.5 py-2 text-xs font-semibold dark:border-white/5 dark:bg-[#4f3d3d]/50"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-backgroundDark">
                {(m.display_name || 'U').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-text dark:text-textDark">{m.display_name}</span>
            </div>
          ))}
        </div>
      </div>

      {memberPickerOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4"><div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-cozy dark:bg-[#2d2222]"><h3 className="text-lg font-bold">Add project member</h3><select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="mt-4 w-full rounded-xl border bg-white p-2.5 text-sm dark:bg-[#4f3d3d]"><option value="">Select member...</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.email}</option>)}</select><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setMemberPickerOpen(false)} className="rounded-xl bg-background px-3 py-2 text-xs font-bold dark:bg-[#4f3d3d]">Cancel</button><button type="button" onClick={() => void addProjectMember()} disabled={!memberId} className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Add member</button></div></div></div> : null}
    </div>
  );
}
