import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { AssetRecord, ProjectRecord, StationRecord } from '../types';

const STATION_ORDER: StationRecord['station_type'][] = ['WRITING', 'VIEWING', 'GENERATION', 'IMAGE'];

const STATION_ICONS: Record<StationRecord['station_type'], string> = {
  WRITING: '✎',
  VIEWING: '👁',
  GENERATION: '✦',
  IMAGE: '🖼',
};

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

  const generationStation = stations.find((s) => s.station_type === 'GENERATION');

  return (
    <div className="space-y-8">
      <button type="button" onClick={() => navigate('/projects')} className="text-sm font-bold text-accentSecondary hover:underline">← projects</button>

      <header className="panel-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label">project</p>
            <h1 className="display-heading mt-2 text-text dark:text-textDark">{project.title}</h1>
            {project.description ? <p className="mt-2 max-w-2xl text-sm text-text/65 dark:text-textDark/65">{project.description}</p> : null}
          </div>
          <span className="rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase text-text">{project.status}</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Summary label="Visible assets" value={assets.length} />
          <Summary label="Available stations" value={stations.length} />
          <Summary label="Deadline" value={project.deadline ? 1 : 0} valueLabel={project.deadline ? formatDate(project.deadline) : 'Not set'} />
        </div>
      </header>

      {generationStation ? (
        <section className="panel-lime">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text/60">recommended</p>
          <h2 className="font-display mt-1 text-2xl font-bold lowercase">start generating</h2>
          <p className="mt-2 text-sm text-text/70">Create assets and preview results instantly in a split-pane view.</p>
          <button
            type="button"
            onClick={() => navigate(`/stations/${generationStation.id}`)}
            className="mt-4 rounded-xl bg-text px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            Open {generationStation.name} →
          </button>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="mb-5 border-b border-accentSecondary/20 pb-4">
          <h2 className="font-display text-xl font-bold lowercase">stations</h2>
          <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Functional workspaces available in this project.</p>
        </div>
        {stations.length === 0 ? (
          <CozyEmptyState icon="⌂" title="no stations available" message="This project has no stations available to your account." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stations.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => navigate(`/stations/${station.id}`)}
                className={`rounded-2xl border-2 p-5 text-left transition hover:shadow-bold ${
                  station.station_type === 'GENERATION'
                    ? 'border-accent bg-accent/15 hover:border-accent'
                    : 'border-accentSecondary/25 bg-accentSecondary/5 hover:border-accentSecondary/50'
                }`}
              >
                <span className="text-2xl">{STATION_ICONS[station.station_type]}</span>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-accentSecondary">{station.station_type}</p>
                <h3 className="font-display mt-1 text-lg font-bold lowercase">{station.name}</h3>
                <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{station.description || 'Production workspace'}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value, valueLabel }: { label: string; value: number; valueLabel?: string }) {
  return (
    <div className="rounded-2xl border-2 border-accentSecondary/20 bg-accentSecondary/5 p-4">
      <p className="text-xs font-bold text-text/60 dark:text-textDark/60">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold text-accentSecondary">{valueLabel || value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
