import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozySkeleton } from './UIStates';
import { GenerationStation } from './GenerationStation';
import type { AIJobStatusRecord, AssetLineageRecord, AssetRecord, AssetVersionRecord, StationRecord } from '../types';

type AIResult = { content?: string; results?: Array<{ format: string; content: string }>; asset_ids?: string[] };
const TEXT_TYPES = new Set(['TEXT', 'ARTICLE', 'BLOG_POST', 'LINKEDIN_POST', 'EMAIL', 'SOCIAL_POST']);
const ATOMIZATION_FORMATS = ['LinkedIn', 'Instagram', 'Email'];

export function StationPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const canWrite = roles.some((role) => ['EDITOR', 'ADMIN'].includes(role.toUpperCase()));
  const [station, setStation] = useState<StationRecord | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [lineage, setLineage] = useState<Record<string, AssetLineageRecord>>({});
  const [currentVersions, setCurrentVersions] = useState<Record<string, number>>({});
  const [versions, setVersions] = useState<AssetVersionRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [saveState, setSaveState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const editor = useEditor({ extensions: [StarterKit], content: '' });
  const writingAssets = assets.filter((asset) => TEXT_TYPES.has(asset.asset_type.toUpperCase()) || Boolean(asset.content));
  const selectedAsset = writingAssets.find((asset) => asset.id === selectedId) ?? null;
  const currentVersion = versions[versions.length - 1];

  const loadAssets = async (id: string) => {
    const stationAssets = await apiFetch<AssetRecord[]>(`/stations/${id}/assets`);
    const visibleAssets = await Promise.all(stationAssets.map((asset) => apiFetch<AssetRecord>(`/assets/${asset.id}`)));
    const entries = await Promise.all(visibleAssets.map(async (asset) => {
      const [assetLineage, assetVersions] = await Promise.all([
        apiFetch<AssetLineageRecord>(`/assets/${asset.id}/lineage`),
        apiFetch<AssetVersionRecord[]>(`/versions/${asset.id}`),
      ]);
      const sortedVersions = assetVersions.sort((a, b) => a.version_number - b.version_number);
      const latest = sortedVersions[sortedVersions.length - 1];
      return { assetId: asset.id, assetLineage, version: latest?.version_number };
    }));
    setAssets(visibleAssets);
    setLineage(Object.fromEntries(entries.map((entry) => [entry.assetId, entry.assetLineage])));
    setCurrentVersions(Object.fromEntries(entries.map((entry) => [entry.assetId, entry.version ?? 0])));
    setSelectedId((current) => visibleAssets.some((asset) => asset.id === current) ? current : visibleAssets[0]?.id ?? '');
  };

  useEffect(() => {
    if (!stationId) return;
    void Promise.all([
      apiFetch<StationRecord>(`/stations/${stationId}`),
      apiFetch<StationRecord[]>('/stations'),
    ]).then(async ([stationData]) => {
      setStation(stationData);
      await loadAssets(stationId);
    }).catch(() => setError('Unable to load this station.')).finally(() => setLoading(false));
  }, [stationId]);

  useEffect(() => {
    if (!selectedAsset || !editor) return;
    editor.commands.setContent(selectedAsset.content || '');
    setNewTitle(selectedAsset.title || selectedAsset.name);
    setAiResult('');
    setSaveState('');
    void apiFetch<AssetVersionRecord[]>(`/versions/${selectedAsset.id}`).then((items) => setVersions(items.sort((a, b) => a.version_number - b.version_number))).catch(() => setVersions([]));
  }, [selectedId, selectedAsset?.id, editor]);

  useEffect(() => {
    if (!editor) return;
    const updateSelection = () => setSelectedText(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '));
    editor.on('selectionUpdate', updateSelection);
    return () => { editor.off('selectionUpdate', updateSelection); };
  }, [editor]);

  const createTextAsset = async () => {
    if (!station || !user || !newTitle.trim()) return;
    try {
      const created = await apiFetch<AssetRecord>('/assets', { method: 'POST', body: { organization_id: user.organization_id, station_id: station.id, name: newTitle.trim(), title: newTitle.trim(), content: '', asset_type: 'TEXT' } });
      await loadAssets(station.id);
      setSelectedId(created.id);
      setNewTitle('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create text asset.'); }
  };

  const saveAsset = async () => {
    if (!selectedAsset || !editor || !canWrite) return;
    try {
      setSaveState('Saving');
      const updated = await apiFetch<AssetRecord>(`/assets/${selectedAsset.id}`, { method: 'PUT', body: { name: selectedAsset.name, title: newTitle.trim() || selectedAsset.name, content: editor.getHTML(), asset_type: selectedAsset.asset_type } });
      setAssets((current) => current.map((asset) => asset.id === updated.id ? updated : asset));
      const nextVersions = await apiFetch<AssetVersionRecord[]>(`/versions/${updated.id}`);
      setVersions(nextVersions.sort((a, b) => a.version_number - b.version_number));
      setSaveState('Saved');
    } catch (err) { setSaveState(err instanceof Error ? err.message : 'Unable to save.'); }
  };

  const deleteAsset = async () => {
    if (!selectedAsset || !canWrite || !window.confirm(`Delete ${selectedAsset.title || selectedAsset.name}?`)) return;
    try {
      await apiFetch(`/assets/${selectedAsset.id}`, { method: 'DELETE' });
      const remaining = assets.filter((asset) => asset.id !== selectedAsset.id);
      setAssets(remaining);
      setSelectedId(remaining[0]?.id ?? '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete asset.'); }
  };

  const submitAI = async (jobType: string) => {
    if (!selectedAsset || !canWrite || !selectedText.trim()) return;
    try {
      setJobStatus('QUEUED');
      setAiResult('');
      const job = await apiFetch<AIJobStatusRecord>('/ai/jobs', { method: 'POST', body: { job_type: jobType, asset_id: selectedAsset.id, draft: selectedText, prompt: '', action: jobType.toLowerCase(), formats: jobType === 'ATOMIZE' ? ATOMIZATION_FORMATS : [] } });
      let status = job;
      while (['QUEUED', 'RUNNING'].includes(status.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        status = await apiFetch<AIJobStatusRecord>(`/ai/jobs/${status.task_id}`);
        setJobStatus(status.status);
      }
      setJobStatus(status.status);
      const result = status.result as AIResult | null;
      setAiResult(result?.content || result?.results?.map((item) => `${item.format}\n${item.content}`).join('\n\n') || status.error || 'No result returned.');
      if (jobType === 'ATOMIZE' && stationId) await loadAssets(stationId);
    } catch (err) { setJobStatus('FAILED'); setAiResult(err instanceof Error ? err.message : 'Unable to submit AI job.'); }
  };

  if (loading) return <CozySkeleton rows={6} />;
  if (error && !station) return <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error}</div>;
  if (!station) return null;
  if (station.station_type === 'VIEWING') return <ViewingStation station={station} assets={assets} lineage={lineage} currentVersions={currentVersions} />;
  if (station.station_type === 'IMAGE') return <ImageStation station={station} assets={assets} lineage={lineage} currentVersions={currentVersions} />;
  if (station.station_type === 'GENERATION') return <GenerationStation station={station} />;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-5 dark:border-white/10"><div><button type="button" onClick={() => navigate(`/projects/${station.project_id}`)} className="text-xs font-bold text-accent">← Project</button><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Writing Station</p><h1 className="mt-1 text-3xl font-bold">{station.name}</h1></div><span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span></header>
    {error ? <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-3 text-sm">{error}</div> : null}
    <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
      <aside className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/70"><div className="flex items-center justify-between"><h2 className="font-bold">Documents</h2><span className="text-xs text-text/55">{writingAssets.length}</span></div><div className="mt-4 space-y-2">{writingAssets.map((asset) => { const parents = lineage[asset.id]?.parents ?? []; const children = lineage[asset.id]?.children ?? []; return <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)} className={`w-full border-l-2 p-2 text-left text-xs ${selectedId === asset.id ? 'border-accent bg-accent/15 font-bold' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'} ${parents.length ? 'ml-4 w-[calc(100%-1rem)]' : ''}`}><span className="block truncate">{parents.length ? '↳ ' : ''}{asset.title || asset.name}</span><span className="mt-1 block text-[10px] text-text/55">{children.length ? 'PARENT · ' : parents.length ? 'CHILD · ' : ''}v{currentVersions[asset.id] || '—'} CURRENT</span></button>; })}</div><div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="New text asset title" className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-xs dark:border-white/10 dark:bg-[#4f3d3d]" /><button type="button" disabled={!canWrite || !newTitle.trim()} onClick={() => void createTextAsset()} className="mt-2 w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Create Text Asset</button></div></aside>
      <main className="rounded-2xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/80"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} disabled={!selectedAsset} className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none" placeholder="Untitled document" /><div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-statusSuccess/20 px-2 py-1 font-bold text-statusSuccess">{currentVersion ? `v${currentVersion.version_number} CURRENT` : 'No version'}</span><span className="text-text/55">{saveState}</span></div></div><div className="writing-editor mt-5 min-h-[420px]"><EditorContent editor={editor} /></div><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-black/10 pt-4 dark:border-white/10"><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void deleteAsset()} className="text-xs font-bold text-statusError disabled:opacity-50">Delete Asset</button><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void saveAsset()} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Save</button></div></main>
      <aside className="space-y-5"><section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/70"><h2 className="font-bold">AI Assistant</h2><p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Select text in the editor, then choose an action.</p><div className="mt-3 grid grid-cols-2 gap-2">{[['Improve', 'IMPROVE_TONE'], ['Expand', 'EXPAND'], ['Summarize', 'SUMMARIZE'], ['Tone', 'IMPROVE_TONE'], ['Audience', 'CHANGE_AUDIENCE'], ['Continue', 'TEXT']].map(([label, type]) => <button key={label} type="button" disabled={!canWrite || !selectedText.trim()} onClick={() => void submitAI(type)} className="rounded-xl border border-black/10 px-2 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/10">{label}</button>)}</div>{jobStatus ? <p className="mt-3 text-xs text-accent">Job: {jobStatus}</p> : null}{aiResult ? <div className="mt-3 rounded-xl bg-background/70 p-3 text-xs"><p className="max-h-40 overflow-auto whitespace-pre-wrap">{aiResult}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => editor?.chain().focus().insertContent(aiResult).run()} className="rounded-lg bg-accent px-2 py-1 font-bold text-backgroundDark">Insert</button><button type="button" onClick={() => editor?.chain().focus().insertContentAt(editor.state.doc.content.size, `\n${aiResult}`).run()} className="rounded-lg border border-black/10 px-2 py-1 font-bold dark:border-white/10">Append</button><button type="button" onClick={() => void navigator.clipboard.writeText(aiResult)} className="rounded-lg border border-black/10 px-2 py-1 font-bold dark:border-white/10">Copy</button></div></div> : null}</section><section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/70"><h2 className="font-bold">Content Atomization</h2><p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Current parent: {selectedAsset?.title || 'Select a document'}</p><p className="mt-2 text-xs text-text/55">↓ generated child assets</p><div className="mt-3 flex flex-wrap gap-1">{(lineage[selectedId]?.children ?? []).map((child) => <span key={child.id} className="rounded-lg bg-accent/15 px-2 py-1 text-[10px] font-bold">{child.title || child.name}</span>)}</div><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void submitAI('ATOMIZE')} className="mt-4 w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Atomize into LinkedIn, Instagram, Email</button></section></aside>
    </div>
  </div>;
}

function ViewingStation({ station, assets, lineage, currentVersions }: ReadOnlyStationProps) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? '');
  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  return <ReadOnlyStationLayout station={station} assets={assets} lineage={lineage} currentVersions={currentVersions} selectedId={selectedId} onSelect={setSelectedId} title="Viewing Station" description="Read and preview project assets." selected={selected} currentVersion={selected ? currentVersions[selected.id] : undefined} />;
}

function ImageStation({ station, assets, lineage, currentVersions }: ReadOnlyStationProps) {
  const imageAssets = assets.filter((asset) => asset.asset_type.toUpperCase() === 'IMAGE');
  const [selectedId, setSelectedId] = useState(imageAssets[0]?.id ?? '');
  const selected = imageAssets.find((asset) => asset.id === selectedId) ?? null;
  return <ReadOnlyStationLayout station={station} assets={imageAssets} lineage={lineage} currentVersions={currentVersions} selectedId={selectedId} onSelect={setSelectedId} title="Image Station" description="Preview image assets from this project." selected={selected} currentVersion={selected ? currentVersions[selected.id] : undefined} />;
}

interface ReadOnlyStationProps {
  station: StationRecord;
  assets: AssetRecord[];
  lineage: Record<string, AssetLineageRecord>;
  currentVersions: Record<string, number>;
}

interface ReadOnlyStationLayoutProps extends ReadOnlyStationProps {
  title: string;
  description: string;
  selectedId: string;
  onSelect: (id: string) => void;
  selected: AssetRecord | null;
  currentVersion?: number;
}

function ReadOnlyStationLayout({ station, assets, lineage, currentVersions, title, description, selectedId, onSelect, selected, currentVersion }: ReadOnlyStationLayoutProps) {
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-5 dark:border-white/10"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{title}</p><h1 className="mt-2 text-3xl font-bold">{station.name}</h1><p className="mt-2 text-sm text-text/65 dark:text-textDark/65">{description}</p></div><span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span></header>
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/70"><div className="flex items-center justify-between"><h2 className="font-bold">Assets</h2><span className="text-xs text-text/55">{assets.length}</span></div><div className="mt-4 space-y-2">{assets.map((asset) => { const parents = lineage[asset.id]?.parents ?? []; return <button key={asset.id} type="button" onClick={() => onSelect(asset.id)} className={`w-full border-l-2 p-2 text-left text-xs ${selectedId === asset.id ? 'border-accent bg-accent/15 font-bold' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'} ${parents.length ? 'ml-4 w-[calc(100%-1rem)]' : ''}`}><span className="block truncate">{parents.length ? '↳ ' : ''}{asset.title || asset.name}</span><span className="mt-1 block text-[10px] text-text/55">{parents.length ? 'CHILD · ' : ''}v{currentVersions[asset.id] || '—'} CURRENT</span></button>; })}</div></aside>
      <main className="rounded-2xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-[#3a2d2d]/80">{selected ? <ReadOnlyAsset asset={selected} lineage={lineage[selected.id]} currentVersion={currentVersion} imageOnly={station.station_type === 'IMAGE'} /> : <p className="py-16 text-center text-sm text-text/60 dark:text-textDark/60">No assets are available in this station.</p>}</main>
    </div>
  </div>;
}

function ReadOnlyAsset({ asset, lineage, currentVersion, imageOnly }: { asset: AssetRecord; lineage?: AssetLineageRecord; currentVersion?: number; imageOnly: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const editor = useEditor({ extensions: [StarterKit], content: asset.content || '', editable: false });
  useEffect(() => { editor?.commands.setContent(asset.content || ''); }, [asset.id, editor]);
  useEffect(() => {
    if (asset.asset_type.toUpperCase() !== 'IMAGE' || !asset.storage_path) return;
    void apiFetch<{ data: string; encoding: string }>(`/assets/${asset.id}/download`).then((result) => setPreview(`data:image/png;base64,${result.data}`)).catch(() => setPreview(null));
  }, [asset.id, asset.asset_type, asset.storage_path]);
  const parent = lineage?.parents[0];
  const children = lineage?.children ?? [];
  return <article><div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10"><div><p className="text-[10px] font-bold uppercase tracking-wider text-accent">{asset.asset_type}</p><h2 className="mt-1 text-2xl font-bold">{asset.title || asset.name}</h2></div><span className="rounded-full bg-statusSuccess/20 px-3 py-1.5 text-xs font-bold text-statusSuccess">{currentVersion ? `v${currentVersion} CURRENT` : 'Version unavailable'}</span></div>{imageOnly || asset.asset_type.toUpperCase() === 'IMAGE' ? <div className="mt-6 flex min-h-[360px] items-center justify-center rounded-2xl bg-black/5 p-4 dark:bg-black/20">{preview ? <img src={preview} alt={asset.title || asset.name} className="max-h-[560px] max-w-full object-contain" /> : <p className="text-sm text-text/55">Preview unavailable.</p>}</div> : <div className="writing-editor mt-6"><EditorContent editor={editor} /></div>}<div className="mt-6 grid gap-3 border-t border-black/10 pt-4 text-xs text-text/60 dark:border-white/10 dark:text-textDark/60"><span>Author: {asset.owner_id ? asset.owner_id.slice(0, 8) : 'System'}</span><span>Created: {asset.created_at ? formatStationDate(asset.created_at) : 'Unknown'}</span>{parent ? <span>Derived from: {parent.title || parent.name}</span> : null}{children.length ? <span>Children: {children.map((child) => child.title || child.name).join(', ')}</span> : null}</div></article>;
}

function formatStationDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
