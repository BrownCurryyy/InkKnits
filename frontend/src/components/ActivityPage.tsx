import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { ActivityRecord, AssetRecord, ProjectRecord, StationRecord } from '../types';

const activityBadgeStyles: Record<string, string> = {
  ASSET_CREATED: 'bg-statusSuccess/20 text-statusSuccess border-statusSuccess/30',
  ASSET_UPDATED: 'bg-accent/20 text-accent border-accent/30',
  ASSET_OPENED: 'bg-background text-text/80 border-black/10 dark:bg-[#554949] dark:text-textDark',
  IMAGE_GENERATED: 'bg-statusSuccess/20 text-statusSuccess border-statusSuccess/30',
  AI_GENERATED: 'bg-accent/20 text-accent border-accent/30',
  APPROVAL: 'bg-statusPending/20 text-statusPending border-statusPending/30',
  ESCALATION: 'bg-statusEscalated/20 text-statusEscalated border-statusEscalated/30',
};

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivity = async () => {
    try {
      setError('');
      const [activityData, projectData, assetData, stationData] = await Promise.all([
        apiFetch<ActivityRecord[]>('/activities'),
        apiFetch<ProjectRecord[]>('/projects'),
        apiFetch<AssetRecord[]>('/assets'),
        apiFetch<StationRecord[]>('/stations'),
      ]);
      setActivities(activityData);
      setProjects(projectData);
      setAssets(assetData);
      setStations(stationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load activity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadActivity(); }, []);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects]);
  const assetNames = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.title || asset.name])), [assets]);
  const assetProjectIds = useMemo(() => {
    const stationProjects = new Map(stations.map((station) => [station.id, station.project_id]));
    return new Map(assets.map((asset) => [asset.id, stationProjects.get(asset.station_id)]));
  }, [assets, stations]);
  const visibleActivities = activities.filter(
    (item) => projectFilter === 'ALL'
      || item.project_id === projectFilter
      || (item.project_id == null && item.asset_id != null && assetProjectIds.get(item.asset_id) === projectFilter),
  );

  if (loading) return <CozySkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <header className="rounded-[20px] border border-[#eadfb7] bg-[#fffaf1]/90 p-5 shadow-[0_10px_22px_rgba(66,56,56,0.04)] dark:border-white/10 dark:bg-[#352d2d]/90">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Activity</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">Project activity</h1>
            <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
              A live stream of work across the projects and assets in your environment.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadActivity()}
            className="inline-flex items-center justify-center rounded-xl border border-[#e7d9c0] bg-[#f7f0df] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text dark:border-white/10 dark:bg-[#4a3c3c] dark:text-textDark"
          >
            Refresh
          </button>
        </div>

        <label className="mt-5 block max-w-sm text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">
          Project
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="mt-2 w-full rounded-[12px] border border-[#e7d9c0] bg-[#f7f0df] px-3 py-2 text-sm text-text dark:border-white/10 dark:bg-[#4a3c3c] dark:text-textDark"
          >
            <option value="ALL">All accessible projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title}</option>
            ))}
          </select>
        </label>
      </header>

      {error ? <div className="rounded-[16px] border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error}</div> : null}

      <section className="rounded-[20px] border border-[#eadfb7] bg-[#fffaf1]/90 p-5 shadow-[0_10px_22px_rgba(66,56,56,0.04)] dark:border-white/10 dark:bg-[#352d2d]/90">
        {visibleActivities.length === 0 ? (
          <CozyEmptyState icon="•" title="No activity recorded" message="Events from your accessible projects will appear here." />
        ) : (
          <div className="space-y-3">
            {visibleActivities.map((item) => (
              <article key={item.id} className="rounded-[16px] border border-[#efe1c0] bg-[#fdf7ea] p-4 dark:border-white/10 dark:bg-[#483d3d]/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`rounded-xl border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${activityBadgeStyles[item.activity_type] || 'bg-background text-text border-black/10 dark:bg-[#554949] dark:text-textDark'}`}>
                      {item.activity_type}
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-6 text-text dark:text-textDark">{item.description}</p>
                      <p className="mt-1 text-[11px] text-text/55 dark:text-textDark/60">
                        User {item.user_id ? item.user_id.slice(0, 8) : 'System'} · {projectNames.get(item.project_id || '') || 'Organization activity'}
                      </p>
                      {item.asset_id ? (
                        <p className="mt-1 text-[11px] text-text/55 dark:text-textDark/60">
                          Asset: {assetNames.get(item.asset_id) || item.asset_id.slice(0, 8)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <time className="text-[11px] text-text/55 dark:text-textDark/60">{formatDate(item.created_at)}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

