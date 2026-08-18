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
} from '../types';

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
  latestVersion?: AssetVersionRecord;
  parentAssetId?: string;
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [bundleItems, setBundleItems] = useState<AssetBundleItem[]>([]);
  const [members, setMembers] = useState<UserRecord[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

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

      // Fetch Assets for project stations
      const stationIds = new Set(projStations.map((s) => s.id));
      const allAssets = await apiFetch<AssetRecord[]>('/assets');
      const projAssets = allAssets.filter((a) => stationIds.has(a.station_id));
      setAssets(projAssets);

      // Build Version Bundle / Production State
      const items: AssetBundleItem[] = await Promise.all(
        projAssets.map(async (asset) => {
          let latestVersion: AssetVersionRecord | undefined;
          try {
            const vers = await apiFetch<AssetVersionRecord[]>(`/versions/${asset.id}`);
            const sorted = [...vers].sort((a, b) => b.version_number - a.version_number);
            latestVersion = sorted[0];
          } catch {
            latestVersion = undefined;
          }

          const parentAssetId =
            asset.raw_metadata && typeof asset.raw_metadata.parent_asset_id === 'string'
              ? asset.raw_metadata.parent_asset_id
              : undefined;

          return { asset, latestVersion, parentAssetId };
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
                    {st.icon || '✨'}
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

      {/* PROJECT VERSION BUNDLE / PRODUCTION STATE LINEAGE VISUALIZATION */}
      <div className="rounded-3xl border border-accent/30 bg-gradient-to-br from-white via-accent/5 to-background p-6 shadow-cozy backdrop-blur-md dark:border-accent/30 dark:from-[#3a2d2d] dark:via-[#423838] dark:to-[#4f3d3d]">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                PRODUCTION STATE BUNDLE
              </span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                Current Version Snapshot Tree
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-bold text-text dark:text-textDark">
              Project Assets & Active Version Lineage
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
              {bundleItems.map(({ asset, latestVersion, parentAssetId }) => {
                const versionNum = latestVersion?.version_number ?? 1;
                const lastUpdated = latestVersion?.created_at || asset.updated_at || asset.created_at;

                return (
                  <div key={asset.id} className="relative flex items-start gap-4">
                    {/* Tree Node Dot */}
                    <div className="absolute -left-[23px] top-4 h-3.5 w-3.5 rounded-full border-2 border-white bg-accent shadow-sm dark:border-[#3a2d2d]" />

                    {/* Asset Bundle Card */}
                    <div
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="group flex flex-1 cursor-pointer flex-col gap-2 rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-cozy sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#2d2222]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-base font-bold text-accent">
                          {asset.asset_type === 'IMAGE' ? '🎨' : asset.asset_type === 'TEXT' ? '📝' : '📄'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-text dark:text-textDark group-hover:text-accent">
                              {asset.title || asset.name}
                            </h4>
                            <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                              v{versionNum} (Active)
                            </span>
                            {parentAssetId ? (
                              <span className="rounded-lg bg-statusPending/20 px-2 py-0.5 text-[10px] font-semibold text-statusPending">
                                🔗 Derived child
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-text/60 dark:text-textDark/60">
                            {asset.name} · {asset.asset_type}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <div className="text-right text-[11px] text-text/60 dark:text-textDark/60">
                          <div>
                            Updated by:{' '}
                            <span className="font-bold">{latestVersion?.created_by || 'system'}</span>
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
          <span className="text-xs text-text/60 dark:text-textDark/60">{members.length} members</span>
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
    </div>
  );
}
