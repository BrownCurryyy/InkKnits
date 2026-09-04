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
      <header className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Projects</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">Project workspace</h1>
            <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
              Open a project to access its stations, current assets, and production context.
            </p>
          </div>
          <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
            {projects.length} accessible
          </span>
        </div>
      </header>

      {projects.length === 0 ? (
        <CozyEmptyState icon="•" title="No projects available" message="Projects assigned to you will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const projectStations = stations.filter(
              (station) => station.project_id === project.id && STATION_TYPES.includes(station.station_type),
            );
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/projects/${project.id}`)}
                className="rounded-[18px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 text-left shadow-[0_10px_20px_rgba(13,13,13,0.03)] transition hover:border-[#D9D6CF] hover:bg-[#FCE9E8]/40 dark:border-[#292929] dark:bg-[#151515]/80 dark:hover:border-[#E53935]/40 dark:hover:bg-[#1D1919]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-text dark:text-textDark">{project.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
                      {project.description || 'No description provided for this project.'}
                    </p>
                  </div>
                  <span className="rounded-full bg-statusSuccess/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-statusSuccess">
                    {project.status}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {projectStations.slice(0, 4).map((station) => (
                    <span
                      key={station.id}
                      className="rounded-full border border-[#D9D6CF] bg-[#F5F3EE] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text/70 dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark/75"
                    >
                      {station.station_type}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#D9D6CF] pt-3 text-xs text-text/60 dark:border-[#292929] dark:text-textDark/60">
                  <span>{projectStations.length} workspaces</span>
                  <span className="font-semibold text-accent">Open project</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

