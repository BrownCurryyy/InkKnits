import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from './AuthContext';
import type { ProjectRecord, StationRecord } from '../types';

type WorkspaceContextValue = {
  projects: ProjectRecord[];
  stations: StationRecord[];
  loading: boolean;
  error: string;
  addProject: (project: ProjectRecord) => void;
  removeProject: (projectId: string) => void;
  refreshStations: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshStations = async () => {
    const stationData = await apiFetch<StationRecord[]>('/stations');
    setStations(stationData);
  };

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setStations([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    void Promise.all([
      apiFetch<ProjectRecord[]>('/projects'),
      apiFetch<StationRecord[]>('/stations'),
    ]).then(([projectData, stationData]) => {
      if (!active) return;
      setProjects(projectData);
      setStations(stationData);
    }).catch((err) => {
      if (active) {
        setError(err instanceof Error ? err.message : 'Unable to load workspace.');
        setProjects([]);
        setStations([]);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [user?.id]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    projects,
    stations,
    loading,
    error,
    addProject: (project) => setProjects((current) => current.some((item) => item.id === project.id) ? current.map((item) => item.id === project.id ? project : item) : [...current, project]),
    removeProject: (projectId) => {
      setProjects((current) => current.filter((project) => project.id !== projectId));
      setStations((current) => current.filter((station) => station.project_id !== projectId));
    },
    refreshStations,
  }), [projects, stations, loading, error]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
