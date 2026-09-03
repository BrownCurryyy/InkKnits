import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { ProjectRecord, StationRecord } from '../types';

const STATION_TYPES: StationRecord['station_type'][] = ['WRITING', 'VIEWING', 'GENERATION', 'IMAGE'];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([apiFetch<ProjectRecord[]>('/projects'), apiFetch<StationRecord[]>('/stations')])
      .then(([projectData, stationData]) => {
        setProjects(projectData);
        setStations(stationData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CozySkeleton rows={5} />;

  return (
    <div className="space-y-8">
      <header className="border-b border-accentSecondary/30 pb-8">
        <p className="section-label">projects</p>
        <h1 className="display-heading mt-2 text-text dark:text-textDark">your projects</h1>
        <p className="mt-3 text-sm text-text/65 dark:text-textDark/65">Projects assigned to your account.</p>
      </header>
      {projects.length === 0 ? (
        <CozyEmptyState icon="⌂" title="no projects available" message="Projects assigned to you will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const projectStations = stations.filter((station) => station.project_id === project.id && STATION_TYPES.includes(station.station_type));
            const hasGeneration = projectStations.some((s) => s.station_type === 'GENERATION');
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/projects/${project.id}`)}
                className="panel-card text-left transition hover:border-accentSecondary/50 hover:shadow-bold"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold lowercase">{project.title}</h2>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase text-text">{project.status}</span>
                </div>
                {project.description ? <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">{project.description}</p> : null}
                <div className="mt-5 flex items-center justify-between border-t border-accentSecondary/20 pt-3 text-xs text-text/60 dark:text-textDark/60">
                  <span>{projectStations.length} stations{hasGeneration ? ' · includes generation' : ''}</span>
                  <span className="font-bold text-accentSecondary">open →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
