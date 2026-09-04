import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { AssetRecord, ProjectRecord, StationRecord } from '../types';

const STATION_ORDER: StationRecord['station_type'][] = ['WRITING', 'VIEWING', 'GENERATION', 'IMAGE'];

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      try {
        setLoading(true);
        setError('');
        const projectData = await apiFetch<ProjectRecord>(`/projects/${projectId}`);
        const [stationData, assetData] = await Promise.all([
          apiFetch<StationRecord[]>('/stations'),
          apiFetch<AssetRecord[]>('/assets'),
        ]);
        const projectStations = stationData
          .filter((station) => station.project_id === projectId && STATION_ORDER.includes(station.station_type))
          .sort((a, b) => STATION_ORDER.indexOf(a.station_type) - STATION_ORDER.indexOf(b.station_type));
        const stationIds = new Set(projectStations.map((station) => station.id));
        setProject(projectData);
        setStations(projectStations);
        setAssets(assetData.filter((asset) => stationIds.has(asset.station_id)));
      } catch {
        setError('Unable to load this project.');
      } finally {
        setLoading(false);
      }
    };

    void loadProject();
  }, [projectId]);

  if (loading) return <CozySkeleton rows={5} />;
  if (error || !project) return <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error || 'Project not found.'}</div>;

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate('/projects')} className="text-sm font-semibold text-accent hover:underline">
        ← Projects
      </button>

      <header className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Project</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">{project.title}</h1>
            {project.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text/65 dark:text-textDark/70">{project.description}</p>
            ) : null}
          </div>
          <span className="rounded-full bg-statusSuccess/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-statusSuccess">
            {project.status}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Summary label="Visible assets" value={assets.length} />
          <Summary label="Stations" value={stations.length} />
          <Summary label="Deadline" valueLabel={project.deadline ? formatDate(project.deadline) : 'Not set'} />
        </div>
      </header>

      <section className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="mb-4 flex items-end justify-between gap-2 border-b border-[#D9D6CF] pb-3 dark:border-[#292929]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">Workspaces</p>
            <h2 className="mt-1 text-xl font-semibold text-text dark:text-textDark">Project stations</h2>
          </div>
          <span className="text-xs text-text/55 dark:text-textDark/65">{stations.length} available</span>
        </div>

        {stations.length === 0 ? (
          <CozyEmptyState icon="•" title="No stations available" message="This project has no stations available to your account." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stations.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => navigate(`/stations/${station.id}`)}
                className="rounded-[16px] border border-[#D9D6CF] bg-[#F5F3EE] p-4 text-left transition hover:border-[#E53935]/40 hover:bg-[#FCE9E8]/40 dark:border-[#292929] dark:bg-[#1A1A1A]/80 dark:hover:border-[#E53935]/40 dark:hover:bg-[#211818]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{station.station_type}</p>
                <h3 className="mt-2 text-lg font-semibold text-text dark:text-textDark">{station.name}</h3>
                <p className="mt-2 text-sm leading-6 text-text/60 dark:text-textDark/70">
                  {station.description || 'Production workspace'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value, valueLabel }: { label?: string; value?: number; valueLabel?: string }) {
  return (
    <div className="rounded-[16px] border border-[#D9D6CF] bg-[#F5F3EE] p-4 dark:border-[#292929] dark:bg-[#1A1A1A]/80">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-accent">{valueLabel ?? value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

