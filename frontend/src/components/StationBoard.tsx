import { CozyEmptyState } from './UIStates';
import type { OrganizationRecord, ProjectRecord, StationRecord } from '../types';

interface StationBoardProps {
  organizations: OrganizationRecord[];
  projects: ProjectRecord[];
  stations: StationRecord[];
  selectedOrgId: string;
  selectedProjectId: string;
  selectedStationId: string;
  selectedProject: ProjectRecord | null;
  stationMetrics: Record<string, number>;
  onSelectOrg: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectStation: (id: string) => void;
}

export function StationBoard({
  organizations,
  projects,
  stations,
  selectedOrgId,
  selectedProjectId,
  selectedStationId,
  selectedProject,
  stationMetrics,
  onSelectOrg,
  onSelectProject,
  onSelectStation,
}: StationBoardProps) {
  return (
    <div className="space-y-6">
      {/* Header bar with org/project select */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-statusPending/30 text-2xl shadow-inner">
              🧶
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                  Workspace
                </p>
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Studio Hub
                </span>
              </div>
              <h2 className="mt-0.5 text-2xl font-bold text-text dark:text-textDark">
                Station Board
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {organizations.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text/60 dark:text-textDark/60">Org:</span>
                <select
                  value={selectedOrgId}
                  onChange={(e) => onSelectOrg(e.target.value)}
                  className="rounded-2xl border border-black/10 bg-background/80 px-3.5 py-2 text-sm font-medium text-text outline-none transition hover:border-accent dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {projects.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text/60 dark:text-textDark/60">Project:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => onSelectProject(e.target.value)}
                  className="rounded-2xl border border-black/10 bg-background/80 px-3.5 py-2 text-sm font-medium text-text outline-none transition hover:border-accent dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stations Grid */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-black/5 pb-4 dark:border-white/10">
          <div>
            <h3 className="text-lg font-bold text-text dark:text-textDark">Stations</h3>
            <p className="text-xs text-text/60 dark:text-textDark/60">
              Select a station to open its cozy creative workspace
            </p>
          </div>
          {selectedProject ? (
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              📌 {selectedProject.title}
            </span>
          ) : null}
        </div>

        {stations.length === 0 ? (
          <CozyEmptyState
            icon="⌂"
            title="Your studio is waiting"
            message="Create a project and station to give your first assets a cozy home."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((station) => {
              const isSelected = selectedStationId === station.id;
              const count = stationMetrics[station.id] ?? 0;

              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => onSelectStation(station.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 active:translate-y-0 ${
                    isSelected
                      ? 'border-accent bg-gradient-to-br from-accent/20 via-accent/10 to-transparent shadow-cozy ring-2 ring-accent/40'
                      : 'border-black/5 bg-background/40 hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/70 dark:hover:bg-[#4f3d3d]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-base font-bold shadow-sm transition-transform duration-200 group-hover:scale-110 ${
                          isSelected
                            ? 'bg-accent text-backgroundDark'
                            : 'bg-accent/20 text-accent dark:bg-accent/30'
                        }`}
                      >
                        {station.icon ?? '✨'}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-text dark:text-textDark">
                          {station.name}
                        </h4>
                        <p className="text-xs text-text/60 dark:text-textDark/60">
                          {station.description || 'Creative Station'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                        isSelected
                          ? 'bg-accent text-backgroundDark'
                          : 'bg-statusPending/30 text-statusPending dark:bg-statusPending/20'
                      }`}
                    >
                      <span>📦</span> {count} {count === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
