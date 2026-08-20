import { CozyEmptyState } from './UIStates';
import type { AssetRecord, StationRecord } from '../types';

const assetTypeConfig: Record<string, { label: string; icon: string; style: string }> = {
  TEXT: { label: 'TEXT', icon: 'T', style: 'bg-accent/20 text-accent border-accent/30' },
  IMAGE: { label: 'IMAGE', icon: 'I', style: 'bg-statusSuccess/20 text-statusSuccess border-statusSuccess/30' },
  GENERIC: { label: 'GENERIC', icon: 'G', style: 'bg-statusPending/20 text-statusPending border-statusPending/30' },
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface AssetLibraryProps {
  selectedStation: StationRecord;
  assets: AssetRecord[];
  selectedAssetId: string;
  assetViewMode: 'grid' | 'list';
  canWrite: boolean;
  onSelectAsset: (id: string) => void;
  onChangeViewMode: (mode: 'grid' | 'list') => void;
  onOpenCreateModal: () => void;
  onOpenUploadModal: () => void;
  onOpenEditModal: (asset: AssetRecord) => void;
  onDeleteAsset: (id: string) => void;
}

export function AssetLibrary({
  selectedStation,
  assets,
  selectedAssetId,
  assetViewMode,
  canWrite,
  onSelectAsset,
  onChangeViewMode,
  onOpenCreateModal,
  onOpenUploadModal,
  onOpenEditModal,
  onDeleteAsset,
}: AssetLibraryProps) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-black/5 pb-4 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Asset Library
            </span>
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {assets.length} items
            </span>
          </div>
          <h3 className="mt-0.5 text-xl font-bold text-text dark:text-textDark">
            {selectedStation.name}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="inline-flex rounded-2xl bg-background/80 p-1 dark:bg-[#554949]">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeViewMode(mode)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  assetViewMode === mode
                    ? 'bg-accent text-backgroundDark shadow-sm'
                    : 'text-text/70 hover:text-text dark:text-textDark/70 dark:hover:text-textDark'
                }`}
              >
                {mode === 'grid' ? '⊞ Grid' : '≡ List'}
              </button>
            ))}
          </div>

          {canWrite ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="rounded-2xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark transition hover:opacity-90 active:scale-95 shadow-sm"
              >
                ✏️ Create asset
              </button>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="rounded-2xl bg-statusSuccess/30 px-4 py-2 text-xs font-bold text-text transition hover:bg-statusSuccess/40 active:scale-95 dark:text-textDark shadow-sm"
              >
                📤 Upload file
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {assets.length === 0 ? (
        <CozyEmptyState
          icon="✎"
          title="A blank canvas, how exciting"
          message="This station has no assets yet. Add a draft, upload an image, or let the AI lend a hand."
        />
      ) : (
        <div
          className={
            assetViewMode === 'grid'
              ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
              : 'space-y-3'
          }
        >
          {assets.map((asset) => {
            const isSelected = selectedAssetId === asset.id;
            const status = (
              asset.raw_metadata && typeof asset.raw_metadata.status === 'string'
                ? asset.raw_metadata.status
                : 'READY'
            ) as string;
            const type = (asset.asset_type || 'GENERIC').toUpperCase();
            const config = assetTypeConfig[type] || assetTypeConfig.GENERIC;

            return (
              <div
                key={asset.id}
                className={`group relative overflow-hidden rounded-2xl border p-4.5 transition-all duration-200 hover:-translate-y-1 ${
                  isSelected
                    ? 'border-accent bg-gradient-to-br from-accent/20 via-accent/10 to-transparent shadow-cozy ring-2 ring-accent/40'
                    : 'border-black/5 bg-background/40 hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/60 dark:hover:bg-[#4f3d3d]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAsset(asset.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-base font-bold shadow-sm transition-transform duration-200 group-hover:scale-105 ${config.style}`}
                      >
                        {config.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-text dark:text-textDark line-clamp-1">
                          {asset.title || asset.name}
                        </h4>
                        <p className="text-xs text-text/60 dark:text-textDark/60 line-clamp-1">
                          {asset.name}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-statusSuccess/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-statusSuccess border border-statusSuccess/30">
                      {status}
                    </span>
                  </div>

                  {asset.content ? (
                    <p className="mt-3 text-xs leading-5 text-text/70 dark:text-textDark/70 line-clamp-2 italic">
                      "{asset.content.slice(0, 120)}{asset.content.length > 120 ? '…' : ''}"
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3 text-[11px] text-text/60 dark:border-white/5 dark:text-textDark/60">
                    <span className="font-semibold text-accent">{config.label}</span>
                    <span>{formatDate(asset.updated_at || asset.created_at)}</span>
                  </div>
                </button>

                {canWrite ? (
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-black/5 pt-2 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => onOpenEditModal(asset)}
                      className="rounded-xl bg-background px-3 py-1 text-xs font-semibold text-text transition hover:bg-black/5 dark:bg-[#554949] dark:text-textDark"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="rounded-xl bg-statusError/20 px-3 py-1 text-xs font-semibold text-statusError transition hover:bg-statusError/30"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
