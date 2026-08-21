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
    <div className="space-y-6">
      <header className="border-b border-black/10 pb-6 dark:border-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Projects</p>
        <h1 className="mt-2 text-3xl font-bold">Your projects</h1>
        <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">Projects assigned to your account.</p>
      </header>
      {projects.length === 0 ? <CozyEmptyState icon="⌂" title="No projects available" message="Projects assigned to you will appear here." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const projectStations = stations.filter((station) => station.project_id === project.id && STATION_TYPES.includes(station.station_type));
            return <button key={project.id} type="button" onClick={() => navigate(`/projects/${project.id}`)} className="rounded-2xl border border-black/10 bg-white/60 p-5 text-left transition hover:border-accent/50 hover:bg-white/80 dark:border-white/10 dark:bg-[#3a2d2d]/70 dark:hover:bg-[#4f3d3d]">
              <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">{project.title}</h2><span className="rounded-full bg-statusSuccess/20 px-2.5 py-1 text-[10px] font-bold uppercase text-statusSuccess">{project.status}</span></div>
              {project.description ? <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">{project.description}</p> : null}
              <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-3 text-xs text-text/60 dark:border-white/10 dark:text-textDark/60"><span>{projectStations.length} available stations</span><span className="font-bold text-accent">Open project →</span></div>
            </button>;
          })}
        </div>
      )}
    </div>
  );
}
