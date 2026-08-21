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

  return (
    <div className="space-y-6">
      <header className="border-b border-black/10 pb-6 dark:border-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Home</p>
        <h1 className="mt-2 text-3xl font-bold">Your production workspace</h1>
        <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">Start with a project, then move into one of its workspaces.</p>
      </header>
      <section className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10"><h2 className="text-lg font-bold">Assigned projects</h2><button type="button" onClick={() => navigate('/projects')} className="text-xs font-bold text-accent">View all</button></div>
        {projects.length === 0 ? <p className="text-sm text-text/60 dark:text-textDark/60">No projects are assigned to you.</p> : <div className="space-y-3">{projects.map((project) => <button key={project.id} type="button" onClick={() => navigate(`/projects/${project.id}`)} className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-background/50 p-4 text-left dark:border-white/10 dark:bg-[#4f3d3d]/60"><span><span className="block font-bold">{project.title}</span><span className="mt-1 block text-xs text-text/60 dark:text-textDark/60">{stations.filter((station) => station.project_id === project.id).length} available stations</span></span><span className="rounded-full bg-statusSuccess/20 px-2.5 py-1 text-[10px] font-bold uppercase text-statusSuccess">{project.status}</span></button>)}</div>}
      </section>
    </div>
  );
}
