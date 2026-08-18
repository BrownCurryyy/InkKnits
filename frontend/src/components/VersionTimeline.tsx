import type { AssetVersionRecord } from '../types';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface VersionTimelineProps {
  versions: AssetVersionRecord[];
  selectedVersionId: string;
  selectedVersion: AssetVersionRecord | null;
  canWrite: boolean;
  onSelectVersion: (id: string) => void;
  onRestoreVersion: (version: AssetVersionRecord) => void;
}

export function VersionTimeline({
  versions,
  selectedVersionId,
  selectedVersion,
  canWrite,
  onSelectVersion,
  onRestoreVersion,
}: VersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-6 text-center text-sm text-text/60 dark:border-white/10 dark:bg-[#2d2222]/50 dark:text-textDark/60">
        <span className="mb-2 block text-2xl">⏳</span>
        No version history recorded yet. Monotonic snapshots are logged automatically on edit or restore.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative pl-6">
        {/* Monotonic timeline trunk line */}
        <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-0.5 rounded-full bg-accent/40" />

        {versions.map((version) => {
          const isSelected = selectedVersionId === version.id;
          const restoredFrom =
            version.raw_metadata && typeof version.raw_metadata.restored_from === 'number'
              ? version.raw_metadata.restored_from
              : version.raw_metadata && typeof version.raw_metadata.restored_from_version === 'number'
              ? version.raw_metadata.restored_from_version
              : null;

          return (
            <div key={version.id} className="relative mb-4">
              {/* Timeline dot */}
              <div
                className={`absolute -left-[23px] top-3.5 h-3.5 w-3.5 rounded-full border-2 border-white transition-all dark:border-[#2d2222] ${
                  isSelected ? 'bg-accent ring-4 ring-accent/20' : 'bg-text/30 dark:bg-textDark/30'
                }`}
              />

              <div
                className={`group rounded-2xl border p-3.5 transition-all duration-200 ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-transparent bg-white/70 hover:border-accent/30 hover:bg-white dark:bg-[#2d2222]/80 dark:hover:bg-[#2d2222]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectVersion(version.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                        v{version.version_number}
                      </span>
                      {restoredFrom !== null ? (
                        <span className="rounded-md bg-statusPending/20 px-2 py-0.5 text-[10px] font-semibold text-statusPending">
                          ↺ Restored from v{restoredFrom}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-text/60 dark:text-textDark/60">
                      {formatDate(version.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-text/70 dark:text-textDark/70">
                    👤 Created by: <span className="font-medium">{version.created_by ?? 'system'}</span>
                  </p>
                </button>

                {!isSelected && canWrite ? (
                  <button
                    type="button"
                    onClick={() => onRestoreVersion(version)}
                    className="mt-3 rounded-xl bg-statusEscalated/20 px-3 py-1.5 text-xs font-semibold text-statusEscalated transition hover:bg-statusEscalated/30 active:scale-95"
                  >
                    ↺ Restore v{version.version_number} (creates new v{versions.length + 1})
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selectedVersion ? (
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#2d2222]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Snapshot Preview · v{selectedVersion.version_number}
            </span>
            <span className="text-[10px] text-text/60 dark:text-textDark/60">
              {formatDate(selectedVersion.created_at)}
            </span>
          </div>
          <pre className="max-h-56 overflow-auto rounded-xl bg-background/50 p-3 text-xs leading-5 text-text dark:bg-[#4f3d3d]/60 dark:text-textDark">
            {JSON.stringify(
              selectedVersion.raw_metadata ?? { snapshot_path: selectedVersion.snapshot_path },
              null,
              2,
            )}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
