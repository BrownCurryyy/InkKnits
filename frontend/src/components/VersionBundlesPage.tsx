import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../api/client';
import type { AssetVersionRecord, ProjectRecord, VersionBundleRecord } from '../types';
import { CozyEmptyState, CozySkeleton } from './UIStates';

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function VersionBundlesPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectId, setProjectId] = useState('');
  const [bundles, setBundles] = useState<VersionBundleRecord[]>([]);
  const [bundleId, setBundleId] = useState('');
  const [versions, setVersions] = useState<Record<string, AssetVersionRecord[]>>({});
  const [bundleName, setBundleName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeBundle = bundles.find((bundle) => bundle.is_active) ?? null;
  const selectedBundle = bundles.find((bundle) => bundle.id === bundleId) ?? bundles[0] ?? null;

  const loadBundles = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetch<VersionBundleRecord[]>(`/projects/${id}/bundles`);
      setBundles(data);
      setBundleId((current) => data.some((bundle) => bundle.id === current) ? current : data[0]?.id ?? '');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load version bundles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void apiFetch<ProjectRecord[]>('/projects').then((data) => {
      setProjects(data);
      setProjectId(data[0]?.id ?? '');
    }).catch(() => setError('Unable to load projects'));
  }, []);

  useEffect(() => {
    void loadBundles(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!selectedBundle) return;
    const missing = selectedBundle.items.filter((item) => !versions[item.asset_id]);
    if (!missing.length) return;
    void Promise.all(missing.map(async (item) => [item.asset_id, await apiFetch<AssetVersionRecord[]>(`/versions/${item.asset_id}`)] as const))
      .then((entries) => setVersions((current) => ({ ...current, ...Object.fromEntries(entries) })))
      .catch(() => undefined);
  }, [selectedBundle?.id]);

  const createBundle = async () => {
    if (!projectId || !bundleName.trim()) return;
    try {
      const created = await apiFetch<VersionBundleRecord>(`/projects/${projectId}/bundles`, { method: 'POST', body: { name: bundleName.trim() } });
      setBundles((current) => [created, ...current.map((bundle) => ({ ...bundle, is_active: false }))]);
      setBundleId(created.id);
      setBundleName('');
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create version bundle');
    }
  };

  const currentItems = useMemo(() => new Map((activeBundle?.items ?? []).map((item) => [item.asset_id, item.version_id])), [activeBundle]);

  if (loading && !projects.length) return <CozySkeleton rows={5} />;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-black/10 pb-6 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Workflow · Snapshots</p>
          <h1 className="mt-2 text-3xl font-bold">Version Bundles</h1>
          <p className="mt-2 max-w-2xl text-sm text-text/65 dark:text-textDark/65">Named project snapshots that preserve the exact asset versions selected at bundling time.</p>
        </div>
        <div className="flex gap-2">
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
          <button type="button" onClick={() => setCreateOpen(true)} disabled={!projectId} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Create bundle</button>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-statusError/40 bg-statusError/10 p-3 text-sm text-statusError">{error}</div> : null}
      {createOpen ? <div className="rounded-2xl border border-accent/35 bg-accent/5 p-4"><div className="flex gap-2"><input autoFocus value={bundleName} onChange={(event) => setBundleName(event.target.value)} placeholder="e.g. Launch Draft v1" className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4f3d3d]" /><button type="button" onClick={() => void createBundle()} disabled={!bundleName.trim()} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Save snapshot</button><button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl bg-background px-3 py-2 text-xs font-bold dark:bg-[#4f3d3d]">Cancel</button></div></div> : null}

      {!bundles.length ? <CozyEmptyState icon="◇" title="No version bundles yet" message="Create a named snapshot to preserve the current versions across this project." /> : <>
        <div className="flex gap-2 overflow-x-auto border-b border-black/10 pb-3 dark:border-white/10">{bundles.map((bundle) => <button key={bundle.id} type="button" onClick={() => setBundleId(bundle.id)} className={`shrink-0 rounded-xl px-4 py-2 text-left text-xs font-bold ${selectedBundle?.id === bundle.id ? 'bg-accent text-backgroundDark' : 'bg-background dark:bg-[#4f3d3d]'}`}>{bundle.name}{bundle.is_active ? ' · Current' : ''}</button>)}</div>
        {selectedBundle ? <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/70"><div className="mb-6 flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{selectedBundle.is_active ? 'Current active bundle' : 'Historical bundle'}</p><h2 className="mt-1 text-2xl font-bold">{selectedBundle.name}</h2></div><p className="text-right text-xs text-text/55 dark:text-textDark/55">Created {formatDate(selectedBundle.created_at)}</p></div><div className="space-y-6">{selectedBundle.items.map((item) => { const assetVersions = versions[item.asset_id] ?? []; return <div key={item.asset_id} className="relative border-l-2 border-accent/30 pl-5"><div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-accent" /><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold">{item.asset_title}</h3><p className="text-xs text-text/55 dark:text-textDark/55">{item.asset_type} · {assetVersions.length || 1} versions</p></div><span className="rounded-full bg-statusSuccess/20 px-2.5 py-1 text-[10px] font-bold text-statusSuccess">v{item.version_number} bundled</span></div><div className="flex flex-wrap gap-2">{assetVersions.sort((a, b) => a.version_number - b.version_number).map((version) => { const bundled = version.id === item.version_id; const active = version.id === currentItems.get(item.asset_id); return <div key={version.id} title={`${bundled ? 'Bundled version' : 'Older version'}\nCreated: ${formatDate(version.created_at)}\nCreated by: ${version.created_by ?? 'system'}\nPreview: ${bundled ? item.snapshot_preview ?? 'No text preview' : 'Open asset for details'}`} className={`group relative rounded-xl border px-3 py-2 text-xs transition ${bundled ? 'border-statusSuccess bg-statusSuccess/15 font-bold text-text dark:text-textDark' : 'border-black/10 bg-background/60 text-text/60 dark:border-white/10 dark:bg-[#4f3d3d]/60'} ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-background dark:ring-offset-[#3a2d2d]' : ''}`}><span>v{version.version_number}</span>{active ? <span className="ml-2 text-[10px] text-accent">CURRENT</span> : null}<div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-64 rounded-xl border border-black/10 bg-[#fff8dc] p-3 text-left text-[11px] font-normal text-text shadow-cozy group-hover:block dark:border-white/10 dark:bg-[#423838] dark:text-textDark"><p>Created {formatDate(version.created_at)}</p><p>By {version.created_by ?? 'system'}</p><p className="mt-1 line-clamp-4 opacity-70">{bundled ? item.snapshot_preview ?? 'No text preview available.' : 'Historical version. Open the asset for full details.'}</p></div></div>; })}</div></div>; })}</div></section> : null}
      </>}
    </div>
  );
}