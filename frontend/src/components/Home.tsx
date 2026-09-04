import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import type { ProjectRecord, StationRecord } from '../types';

export function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);

  useEffect(() => {
    void Promise.all([
      apiFetch<ProjectRecord[]>('/projects'),
      apiFetch<StationRecord[]>('/stations'),
    ])
      .then(([projectData, stationData]) => {
        setProjects(projectData);
        setStations(stationData);
      })
      .catch(() => undefined);
  }, []);

  const projectStats = useMemo(
    () => projects.map((project) => ({
      project,
      stations: stations.filter((station) => station.project_id === project.id),
    })),
    [projects, stations],
  );

  return (
    <div className="space-y-6">
      <header className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Home</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">Your work today</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text/65 dark:text-textDark/70">
              Everything relevant to the projects and stations currently in motion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="inline-flex items-center justify-center rounded-xl border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text transition hover:bg-[#FCE9E8] dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark"
          >
            View projects
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <section className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">Assigned work</p>
              <h2 className="mt-1 text-xl font-semibold text-text dark:text-textDark">Projects in motion</h2>
            </div>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
              {projects.length} active
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#D9D6CF] bg-[#F5F3EE]/80 px-5 py-8 text-sm text-text/65 dark:border-[#292929] dark:bg-[#1A1A1A]/60 dark:text-textDark/70">
              No projects are assigned to you right now.
            </div>
          ) : (
            <div className="space-y-3">
              {projectStats.map(({ project, stations: projectStations }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="flex w-full items-start justify-between gap-4 rounded-[16px] border border-[#D9D6CF] bg-[#F5F3EE] p-4 text-left transition hover:border-[#E53935]/40 hover:bg-[#FCE9E8]/35 dark:border-[#292929] dark:bg-[#1A1A1A]/80 dark:hover:border-[#E53935]/40 dark:hover:bg-[#1F1717]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-text dark:text-textDark">{project.title}</h3>
                      <span className="rounded-full bg-statusSuccess/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-statusSuccess">
                        {project.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
                      {project.description || 'No project description provided.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text/55 dark:text-textDark/60">
                      <span className="rounded-full border border-[#D9D6CF] bg-[#F5F3EE] px-2 py-1 dark:border-[#292929] dark:bg-[#1A1A1A]">
                        {projectStations.length} stations
                      </span>
                      <span className="rounded-full border border-[#D9D6CF] bg-[#F5F3EE] px-2 py-1 dark:border-[#292929] dark:bg-[#1A1A1A]">
                        {projectStations.map((station) => station.station_type).join(', ')}
                      </span>
                    </div>
                  </div>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">Open</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">Need attention</p>
            <h2 className="mt-1 text-xl font-semibold text-text dark:text-textDark">Summary</h2>

            <div className="mt-4 space-y-3 text-sm text-text/70 dark:text-textDark/70">
              <div className="flex items-center justify-between rounded-[14px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 dark:border-[#292929] dark:bg-[#1A1A1A]">
                <span>Projects</span>
                <strong className="text-base font-semibold text-text dark:text-textDark">{projects.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[14px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 dark:border-[#292929] dark:bg-[#1A1A1A]">
                <span>Stations</span>
                <strong className="text-base font-semibold text-text dark:text-textDark">{stations.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[14px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 dark:border-[#292929] dark:bg-[#1A1A1A]">
                <span>Ready for review</span>
                <strong className="text-base font-semibold text-accent">—</strong>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">Recent activity</p>
            <h2 className="mt-1 text-xl font-semibold text-text dark:text-textDark">Latest touchpoints</h2>
            <div className="mt-4 space-y-3 text-sm text-text/70 dark:text-textDark/70">
              {projectStats.slice(0, 3).map(({ project }) => (
                <div key={project.id} className="rounded-[14px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 dark:border-[#292929] dark:bg-[#1A1A1A]">
                  <div className="font-medium text-text dark:text-textDark">{project.title}</div>
                  <div className="mt-1 text-xs text-text/55 dark:text-textDark/60">Updated in project context</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

