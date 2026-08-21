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
      <button type="button" onClick={() => navigate('/projects')} className="text-sm font-semibold text-accent hover:underline">← Projects</button>
      <header className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Project</p>
            <h1 className="mt-2 text-3xl font-bold">{project.title}</h1>
            {project.description ? <p className="mt-2 max-w-2xl text-sm text-text/65 dark:text-textDark/65">{project.description}</p> : null}
          </div>
          <span className="rounded-full bg-statusSuccess/20 px-3 py-1.5 text-xs font-bold uppercase text-statusSuccess">{project.status}</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Summary label="Visible assets" value={assets.length} />
          <Summary label="Available stations" value={stations.length} />
          <Summary label="Deadline" value={project.deadline ? 1 : 0} valueLabel={project.deadline ? formatDate(project.deadline) : 'Not set'} />
        </div>
      </header>

      <section className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="mb-4 border-b border-black/5 pb-3 dark:border-white/10"><h2 className="text-lg font-bold">Stations</h2><p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Functional workspaces available to you in this project.</p></div>
        {stations.length === 0 ? <CozyEmptyState icon="⌂" title="No stations available" message="This project has no stations available to your account." /> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stations.map((station) => <button key={station.id} type="button" onClick={() => navigate(`/stations/${station.id}`)} className="rounded-2xl border border-black/5 bg-background/40 p-4 text-left transition hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/70"><p className="text-[10px] font-bold uppercase tracking-wider text-accent">{station.station_type}</p><h3 className="mt-2 font-bold">{station.name}</h3><p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{station.description || 'Production workspace'}</p></button>)}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value, valueLabel }: { label: string; value: number; valueLabel?: string }) {
  return <div className="rounded-2xl border border-black/5 bg-background/50 p-4 dark:border-white/5 dark:bg-[#4f3d3d]/50"><p className="text-xs font-bold text-text/60 dark:text-textDark/60">{label}</p><p className="mt-1 text-2xl font-bold text-accent">{valueLabel || value}</p></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
