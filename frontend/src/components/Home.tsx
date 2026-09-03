import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import type { ProjectRecord, StationRecord } from '../types';

export function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);

  useEffect(() => {
    void Promise.all([apiFetch<ProjectRecord[]>('/projects'), apiFetch<StationRecord[]>('/stations')]).then(([projectData, stationData]) => {
      setProjects(projectData);
      setStations(stationData);
    }).catch(() => undefined);
  }, []);

  const generationStations = stations.filter((s) => s.station_type === 'GENERATION');

  return (
    <div className="relative space-y-8">
      <div className="blob-circle -right-4 top-0 h-28 w-28" aria-hidden="true" />

      <header className="relative border-b border-accentSecondary/30 pb-8">
        <p className="section-label">home</p>
        <h1 className="display-heading mt-2 text-text dark:text-textDark">your workspace</h1>
        <p className="mt-3 max-w-xl text-sm text-text/65 dark:text-textDark/65">
          Start with a project, generate content, and see results instantly — no section-hopping required.
        </p>
      </header>

      {generationStations.length > 0 ? (
        <section className="panel-lavender">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">quick start</p>
          <h2 className="font-display mt-1 text-2xl font-bold lowercase">generate something</h2>
          <p className="mt-2 text-sm text-white/75">Jump straight to a generation station and see results side-by-side.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {generationStations.slice(0, 3).map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => navigate(`/stations/${station.id}`)}
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-accentSecondary transition hover:bg-accent hover:text-text"
              >
                {station.name} →
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="mb-5 flex items-center justify-between border-b border-accentSecondary/20 pb-4">
          <h2 className="font-display text-xl font-bold lowercase">assigned projects</h2>
          <button type="button" onClick={() => navigate('/projects')} className="text-xs font-bold text-accentSecondary hover:underline">
            view all →
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-text/60 dark:text-textDark/60">No projects are assigned to you.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-accentSecondary/20 bg-accentSecondary/5 p-4 text-left transition hover:border-accentSecondary/40 hover:bg-accentSecondary/10 dark:border-accentSecondary/15 dark:bg-accentSecondary/5"
              >
                <span>
                  <span className="block font-display text-lg font-bold lowercase">{project.title}</span>
                  <span className="mt-1 block text-xs text-text/55 dark:text-textDark/55">
                    {stations.filter((station) => station.project_id === project.id).length} stations available
                  </span>
                </span>
                <span className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase text-text">{project.status}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
