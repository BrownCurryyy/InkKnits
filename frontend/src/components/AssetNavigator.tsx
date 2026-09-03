import { useMemo, useState } from 'react';

import type { AssetLineageRecord, AssetRecord } from '../types';
import { CozyEmptyState } from './UIStates';

type AssetNavigatorProps = {
  assets: AssetRecord[];
  lineage: Record<string, AssetLineageRecord>;
  currentVersions: Record<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateAsset?: () => void;
  canCreate?: boolean;
  createLabel?: string;
  title?: string;
  showCreateButton?: boolean;
  createTitle?: string;
  onCreateTitleChange?: (value: string) => void;
};

function getAssetTitle(asset: AssetRecord) {
  return asset.title?.trim() || asset.name || 'Untitled asset';
}

function getAssetSubtitle(asset: AssetRecord, lineageRecord?: AssetLineageRecord, version?: number) {
  const isGenerated = Boolean(lineageRecord && lineageRecord.parents.length > 0);
  const label = isGenerated ? 'GENERATED' : 'MASTER';
  return `${label} · v${version ?? 0}`;
}

function matchesSearch(asset: AssetRecord, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    asset.title,
    asset.name,
    asset.asset_type,
    asset.description,
    asset.owner_id,
    asset.storage_path,
    asset.raw_metadata ? JSON.stringify(asset.raw_metadata) : '',
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function AssetNavigator({
  assets,
  lineage,
  currentVersions,
  selectedId,
  onSelect,
  onCreateAsset,
  canCreate = false,
  createLabel = 'Create Text Asset',
  title = 'CONTENT',
  showCreateButton = false,
  createTitle = '',
  onCreateTitleChange,
}: AssetNavigatorProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [generatedCollapsed, setGeneratedCollapsed] = useState(false);

  const visibleAssets = useMemo(() => {
    const filtered = assets.filter((asset) => matchesSearch(asset, query));
    return [...filtered].sort((left, right) => getAssetTitle(left).localeCompare(getAssetTitle(right)));
  }, [assets, query]);

  const rootIds = useMemo(() => {
    const ids = new Set(visibleAssets.map((asset) => asset.id));
    return visibleAssets
      .filter((asset) => !(lineage[asset.id]?.parents?.length))
      .map((asset) => asset.id)
      .filter((id) => ids.has(id));
  }, [lineage, visibleAssets]);

  const toggleCollapse = (assetId: string) => {
    setCollapsed((current) => ({ ...current, [assetId]: !current[assetId] }));
  };

  const renderSearchRows = () => {
    if (!query.trim()) return null;
    if (visibleAssets.length === 0) {
      return (
        <div className="mt-4">
          <CozyEmptyState title="No content matches your search." message="Try a different title, asset type, or keyword." icon="⌕" />
        </div>
      );
    }

    return visibleAssets.map((asset) => {
      const lineageRecord = lineage[asset.id];
      const parents = lineageRecord?.parents ?? [];
      const derivedFrom = parents[0];
      const isSelected = selectedId === asset.id;
      const version = currentVersions[asset.id] ?? 0;

      return (
        <div key={asset.id} className="ml-0">
          <button
            type="button"
            onClick={() => onSelect(asset.id)}
            title={getAssetTitle(asset)}
            className={[
              'w-full rounded-xl border px-2.5 py-2 text-left transition-colors',
              isSelected
                ? 'border-accent/60 bg-accent/10 text-text shadow-[inset_0_0_0_1px_rgba(120,96,72,0.08)]'
                : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5',
            ].join(' ')}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="mt-0.5 text-[11px] text-text/60 dark:text-textDark/60">{derivedFrom ? '↳' : '▤'}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-5">{getAssetTitle(asset)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text/55 dark:text-textDark/55">
              <span className={derivedFrom ? 'font-semibold text-accent' : 'font-semibold text-text/70 dark:text-textDark/70'}>
                {derivedFrom ? 'GENERATED' : 'MASTER'}
              </span>
              <span>·</span>
              <span>v{version}</span>
              {derivedFrom ? <span>·</span> : null}
              {derivedFrom ? <span className="truncate">From {getAssetTitle(derivedFrom)}</span> : null}
            </div>
          </button>
        </div>
      );
    });
  };

  const renderNode = (assetId: string, depth = 0): JSX.Element => {
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return <></>;

    const lineageRecord = lineage[asset.id];
    const childIds = (lineageRecord?.children ?? []).map((entry) => entry.id).filter((id) => visibleAssets.some((item) => item.id === id) && !lineage[id]?.parents?.length);
    const hasChildren = childIds.length > 0;
    const isExpanded = !collapsed[asset.id];
    const isSelected = selectedId === asset.id;
    const isGenerated = Boolean(lineageRecord && lineageRecord.parents.length > 0);
    const version = currentVersions[asset.id] ?? 0;

    return (
      <div key={asset.id} className="space-y-1">
        <div className="flex items-start gap-2" style={{ paddingLeft: `${depth * 14}px` }}>
          <button
            type="button"
            aria-label={hasChildren ? (isExpanded ? 'Collapse group' : 'Expand group') : 'Asset'}
            onClick={(event) => {
              event.stopPropagation();
              if (hasChildren) toggleCollapse(asset.id);
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded-md text-center text-[10px] font-bold text-text/55 transition-colors hover:bg-black/5 dark:text-textDark/60 dark:hover:bg-white/5"
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </button>

          <button
            type="button"
            onClick={() => onSelect(asset.id)}
            title={getAssetTitle(asset)}
            className={[
              'min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-left transition-colors',
              isSelected
                ? 'border-accent/60 bg-accent/10 text-text shadow-[inset_0_0_0_1px_rgba(120,96,72,0.08)]'
                : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5',
            ].join(' ')}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[11px] text-text/60 dark:text-textDark/60">{isGenerated ? '↳' : '▤'}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-5">{getAssetTitle(asset)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text/55 dark:text-textDark/55">
              <span className={isGenerated ? 'font-semibold text-accent' : 'font-semibold text-text/70 dark:text-textDark/70'}>
                {isGenerated ? 'GENERATED' : 'MASTER'}
              </span>
              <span>·</span>
              <span>v{version}</span>
              {hasChildren ? <><span>·</span><span>{childIds.length}</span></> : null}
            </div>
          </button>
        </div>

        {hasChildren && isExpanded ? (
          <div className="mt-1 border-l border-black/8 pl-2 dark:border-white/10">
            {childIds.map((childId) => renderNode(childId, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const documentRoots = rootIds.filter((assetId) => !lineage[assetId]?.parents?.length);
  const generatedAssets = visibleAssets.filter((asset) => Boolean(lineage[asset.id]?.parents?.length));

  const renderGenerated = () => {
    if (generatedAssets.length === 0) return null;
    return (
      <section className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
        <button type="button" onClick={() => setGeneratedCollapsed((current) => !current)} className="mb-2 flex w-full items-center justify-between text-left">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{generatedCollapsed ? '▶' : '▼'} Generated</span>
          <span className="text-[10px] text-text/50 dark:text-textDark/50">{generatedAssets.length}</span>
        </button>
        {!generatedCollapsed ? <div className="space-y-1">
          {generatedAssets.map((asset) => {
            const isSelected = selectedId === asset.id;
            const version = currentVersions[asset.id] ?? 0;
            const source = lineage[asset.id]?.parents?.[0];
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset.id)}
                title={getAssetTitle(asset)}
                className={`w-full rounded-xl border px-2.5 py-2 text-left transition-colors ${isSelected ? 'border-accent/60 bg-accent/10' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                <span className="block truncate text-[12px] font-semibold leading-5">{getAssetTitle(asset)}</span>
                <span className="mt-1 block truncate text-[10px] text-text/55 dark:text-textDark/55">GENERATED · v{version}</span>
                {source ? <span className="block truncate text-[10px] text-text/50 dark:text-textDark/50">From {getAssetTitle(source)}</span> : null}
              </button>
            );
          })}
        </div> : null}
      </section>
    );
  };

  const renderTree = () => {
    if (visibleAssets.length === 0 && !query.trim()) {
      return (
        <div className="mt-4">
          <CozyEmptyState title="No content yet" message="Create your first text asset to get started." icon="＋" />
        </div>
      );
    }

    if (query.trim()) {
      return renderSearchRows();
    }

    return (
      <>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Documents</span>
            <span className="text-[10px] text-text/50 dark:text-textDark/50">{documentRoots.length}</span>
          </div>
          <div className="space-y-1">{documentRoots.map((assetId) => renderNode(assetId, 0))}</div>
        </section>
        {renderGenerated()}
      </>
    );
  };

  return (
    <aside className="flex h-full min-h-[420px] w-[260px] min-w-[220px] max-w-[280px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/70 dark:border-white/10 dark:bg-[#3a2d2d]/70">
      <div className="flex items-center justify-between border-b border-black/10 px-3.5 py-3 dark:border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{title}</span>
        <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">{assets.length}</span>
      </div>

      <div className="border-b border-black/10 px-3.5 py-3 dark:border-white/10">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search content..."
          aria-label="Search content"
          className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-xs text-text outline-none ring-0 placeholder:text-text/45 focus:border-accent/60 dark:border-white/10 dark:bg-[#4f3d3d] dark:text-textDark dark:placeholder:text-textDark/45"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {renderTree()}
      </div>

      {showCreateButton && onCreateAsset ? (
        <div className="border-t border-black/10 px-3.5 py-3 dark:border-white/10">
          {onCreateTitleChange ? (
            <input
              value={createTitle}
              onChange={(event) => onCreateTitleChange(event.target.value)}
              placeholder="New document title"
              aria-label="New document title"
              className="mb-2 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-xs outline-none focus:border-accent/60 dark:border-white/10 dark:bg-[#4f3d3d]"
            />
          ) : null}
          <button
            type="button"
            onClick={() => onCreateAsset()}
            disabled={!canCreate}
            className="w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createLabel}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
