import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type {
  ActivityRecord,
  AIJobStatusRecord,
  ApprovalTaskRecord,
  AssetRecord,
  OrganizationRecord,
  ProjectRecord,
  StationDashboardRecord,
  StationRecord,
} from '../types';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [recentAssets, setRecentAssets] = useState<AssetRecord[]>([]);
  const [stationMetrics, setStationMetrics] = useState<Record<string, number>>({});
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalTaskRecord[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityRecord[]>([]);
  const [activeJobs, setActiveJobs] = useState<AIJobStatusRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initial load: Organizations
  useEffect(() => {
    if (!user) return;

    const loadOrgs = async () => {
      try {
        setLoading(true);
        const orgs = await apiFetch<OrganizationRecord[]>('/organizations');
        setOrganizations(orgs);

        const preferredOrg = user.organization_id || orgs[0]?.id || '';
        const orgToUse = orgs.length === 1 ? orgs[0].id : preferredOrg;
        setSelectedOrgId(orgToUse);
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load workspace'));
      } finally {
        setLoading(false);
      }
    };

    void loadOrgs();
  }, [user]);

  // Load Projects for selected Org
  useEffect(() => {
    if (!selectedOrgId) return;

    const loadProjects = async () => {
      try {
        const allProjects = await apiFetch<ProjectRecord[]>('/projects');
        const orgProjects = allProjects.filter((p) => p.organization_id === selectedOrgId);
        setProjects(orgProjects);

        if (orgProjects.length === 1) {
          setSelectedProjectId(orgProjects[0].id);
        } else if (!orgProjects.some((p) => p.id === selectedProjectId)) {
          setSelectedProjectId(orgProjects[0]?.id ?? '');
        }
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load projects'));
      }
    };

    void loadProjects();
  }, [selectedOrgId]);

  // Load Stations & Overview metrics for selected Project
  useEffect(() => {
    if (!selectedProjectId) return;

    const loadDashboardOverview = async () => {
      try {
        // 1. Fetch Stations
        const allStations = await apiFetch<StationRecord[]>('/stations');
        const projectStations = allStations.filter((s) => s.project_id === selectedProjectId);
        setStations(projectStations);

        // 2. Fetch Station Metrics
        const metricsResults = await Promise.all(
          projectStations.map(async (st) => {
            try {
              const dash = await apiFetch<StationDashboardRecord>(`/stations/${st.id}/dashboard`);
              return [st.id, dash.metrics.total_assets] as const;
            } catch {
              return [st.id, 0] as const;
            }
          }),
        );
        setStationMetrics(Object.fromEntries(metricsResults));

        // 3. Fetch All Assets (filtered by station)
        const allAssets = await apiFetch<AssetRecord[]>('/assets');
        const stationIds = new Set(projectStations.map((s) => s.id));
        const projectAssets = allAssets.filter((a) => stationIds.has(a.station_id));

        // Sort by updated_at / created_at descending
        const sortedAssets = [...projectAssets].sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0).getTime() -
            new Date(a.updated_at || a.created_at || 0).getTime(),
        );
        setRecentAssets(sortedAssets.slice(0, 6));

        // 4. Fetch Pending Approvals
        try {
          const tasks = await apiFetch<ApprovalTaskRecord[]>('/approvals/tasks');
          setPendingApprovals(tasks.filter((t) => t.status === 'PENDING').slice(0, 5));
        } catch {
          setPendingApprovals([]);
        }

        // 5. Fetch Activity Feed
        try {
          const activities = await apiFetch<ActivityRecord[]>('/activities');
          setRecentActivities(activities.slice(0, 6));
        } catch {
          setRecentActivities([]);
        }
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load production overview'));
      }
    };

    void loadDashboardOverview();
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const totalAssetsCount = Object.values(stationMetrics).reduce((a, b) => a + b, 0);

  if (loading) {
    return <CozySkeleton rows={5} />;
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          ⚠️ {error}
        </div>
      ) : null}

      {/* Production Overview Header */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-statusPending/30 text-2xl font-bold shadow-inner">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                  Production Overview
                </span>
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                  Project Hub
                </span>
              </div>
              <h2 className="mt-0.5 text-2xl font-bold text-text dark:text-textDark">
                {selectedProject?.title || 'Studio Dashboard'}
              </h2>
            </div>
          </div>

          {/* Org & Project Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {organizations.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text/60 dark:text-textDark/60">Org:</span>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="rounded-2xl border border-black/10 bg-background/80 px-3.5 py-2 text-xs font-medium text-text outline-none transition hover:border-accent dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {projects.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text/60 dark:text-textDark/60">Project:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="rounded-2xl border border-black/10 bg-background/80 px-3.5 py-2 text-xs font-medium text-text outline-none transition hover:border-accent dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-background/50 p-4 dark:border-white/5 dark:bg-[#4f3d3d]/50">
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">STATIONS</p>
            <p className="mt-1 text-2xl font-bold text-accent">{stations.length}</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Active production stations</p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-background/50 p-4 dark:border-white/5 dark:bg-[#4f3d3d]/50">
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">TOTAL ASSETS</p>
            <p className="mt-1 text-2xl font-bold text-statusSuccess">{totalAssetsCount}</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Assets across all stations</p>
          </div>

          <div
            onClick={() => navigate('/approvals')}
            className="cursor-pointer rounded-2xl border border-black/5 bg-background/50 p-4 transition hover:border-accent dark:border-white/5 dark:bg-[#4f3d3d]/50"
          >
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">PENDING APPROVALS</p>
            <p className="mt-1 text-2xl font-bold text-statusPending">{pendingApprovals.length}</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Click to open approval desk →</p>
          </div>

          <div
            onClick={() => navigate('/ai')}
            className="cursor-pointer rounded-2xl border border-black/5 bg-background/50 p-4 transition hover:border-accent dark:border-white/5 dark:bg-[#4f3d3d]/50"
          >
            <p className="text-xs font-bold text-text/60 dark:text-textDark/60">AI QUEUE MONITOR</p>
            <p className="mt-1 text-2xl font-bold text-accent">Active</p>
            <p className="mt-1 text-[11px] text-text/50 dark:text-textDark/50">Click to monitor AI jobs →</p>
          </div>
        </div>
      </div>

      {/* Production Stations Section */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="mb-5 flex items-center justify-between border-b border-black/5 pb-4 dark:border-white/10">
          <div>
            <h3 className="text-lg font-bold text-text dark:text-textDark">Production Stations</h3>
            <p className="text-xs text-text/60 dark:text-textDark/60">
              Select a station destination to manage its dedicated assets
            </p>
          </div>
        </div>

        {stations.length === 0 ? (
          <CozyEmptyState
            icon="⌂"
            title="No stations available"
            message="Create a station in your project to start producing assets."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((st) => {
              const assetCount = stationMetrics[st.id] ?? 0;

              return (
                <div
                  key={st.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-black/5 bg-background/40 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/70 dark:hover:bg-[#4f3d3d]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/20 text-base font-bold text-accent shadow-sm">
                        {st.icon || '✨'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-text dark:text-textDark">{st.name}</h4>
                        <p className="text-xs text-text/60 dark:text-textDark/60">
                          {st.description || 'Station Overview'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-statusPending/20 px-2.5 py-1 text-xs font-bold text-statusPending">
                      {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate(`/stations/${st.id}`)}
                      className="rounded-xl bg-accent/20 px-4 py-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-backgroundDark"
                    >
                      Open Station →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid Row: Recently Modified Assets + Workflow Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recently Modified Assets */}
        <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
          <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
            <h3 className="text-base font-bold text-text dark:text-textDark">Recently Modified Assets</h3>
            <span className="text-xs text-text/60 dark:text-textDark/60">Latest updates</span>
          </div>

          {recentAssets.length === 0 ? (
            <p className="py-6 text-center text-xs text-text/60 dark:text-textDark/60">
              No assets produced yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentAssets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => navigate(`/assets/${asset.id}`)}
                  className="group flex cursor-pointer items-center justify-between rounded-2xl border border-black/5 bg-background/30 p-3.5 transition hover:border-accent/40 hover:bg-background/70 dark:border-white/5 dark:bg-[#4f3d3d]/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-xs font-bold text-accent">
                      {asset.asset_type === 'IMAGE' ? '🎨' : asset.asset_type === 'TEXT' ? '📝' : '📄'}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-text dark:text-textDark group-hover:text-accent">
                        {asset.title || asset.name}
                      </h4>
                      <p className="text-[11px] text-text/60 dark:text-textDark/60">
                        {asset.name} · {asset.asset_type}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-text/60 dark:text-textDark/60">
                    {formatDate(asset.updated_at || asset.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Activity Feed Summary */}
        <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
          <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
            <h3 className="text-base font-bold text-text dark:text-textDark">Recent Stream Activity</h3>
            <button
              type="button"
              onClick={() => navigate('/activity')}
              className="text-xs font-bold text-accent hover:underline"
            >
              View All Log →
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <p className="py-6 text-center text-xs text-text/60 dark:text-textDark/60">
              No recent activities.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-background/30 p-3 text-xs dark:border-white/5 dark:bg-[#4f3d3d]/40"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md bg-accent/20 px-2 py-0.5 font-bold uppercase text-accent text-[10px]">
                      {item.activity_type}
                    </span>
                    <span className="font-medium text-text dark:text-textDark">{item.description}</span>
                  </div>
                  <span className="text-[10px] text-text/60 dark:text-textDark/60">
                    {formatDate(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
