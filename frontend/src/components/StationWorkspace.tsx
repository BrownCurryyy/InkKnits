import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AssetRecord, AIJobStatusRecord, ProjectRecord, StationRecord } from '../types';

interface StationWorkspaceProps {
  station: StationRecord;
  assets: AssetRecord[];
  allStations: StationRecord[];
  canWrite: boolean;
  onSelectAsset: (id: string) => void;
  onRefresh: () => Promise<void>;
  onShowToast: (message: string) => void;
}

type WorkspaceMode = 'WRITING' | 'EDITING' | 'GENERATION' | 'IMAGE';
type TextJobType = 'REWRITE' | 'EXPAND' | 'SUMMARIZE' | 'IMPROVE_TONE' | 'CHANGE_AUDIENCE' | 'TEXT';

function getWorkspaceMode(station: StationRecord): WorkspaceMode {
  const value = `${station.name} ${station.description ?? ''}`.toUpperCase();
  if (value.includes('IMAGE') || value.includes('VISUAL')) return 'IMAGE';
  if (value.includes('GENERAT')) return 'GENERATION';
  if (value.includes('EDIT')) return 'EDITING';
  return 'WRITING';
}

function WorkspaceHeader({ station, mode }: { station: StationRecord; mode: WorkspaceMode }) {
  const labels: Record<WorkspaceMode, string> = {
    WRITING: 'Writing Station',
    EDITING: 'Editing Station',
    GENERATION: 'Generation Station',
    IMAGE: 'Image Station',
  };
  return (
    <div className="border-b border-black/10 pb-6 dark:border-white/10">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{labels[mode]}</p>
      <h2 className="mt-2 text-3xl font-bold text-text dark:text-textDark">{station.name}</h2>
      <p className="mt-2 max-w-2xl text-sm text-text/65 dark:text-textDark/65">
        {station.description || 'Functional production destination'}
      </p>
    </div>
  );
}

function AiActions({
  asset,
  draft,
  canWrite,
  onShowToast,
}: {
  asset: AssetRecord;
  draft: string;
  canWrite: boolean;
  onShowToast: (message: string) => void;
}) {
  const [job, setJob] = useState<AIJobStatusRecord | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (jobType: TextJobType | 'ATOMIZE', action: string, formats?: string[]) => {
    if (!canWrite) return;
    if (jobType !== 'ATOMIZE' && !draft.trim() && !prompt.trim()) {
      onShowToast('Add content or a prompt before submitting an AI job.');
      return;
    }
    setBusy(true);
    try {
      const submitted = await apiFetch<AIJobStatusRecord>('/ai/jobs', {
        method: 'POST',
        body: {
          job_type: jobType,
          asset_id: asset.id,
          draft,
          prompt: prompt || action,
          action,
          formats,
        },
      });
      setJob(submitted);
      onShowToast(`${action} job submitted to the AI Queue.`);
    } catch {
      onShowToast('Unable to submit the AI job.');
    } finally {
      setBusy(false);
    }
  };

  const actions: Array<[string, TextJobType, string]> = [
    ['Improve', 'REWRITE', 'improve'],
    ['Expand', 'EXPAND', 'expand'],
    ['Summarize', 'SUMMARIZE', 'summarize'],
    ['Tone', 'IMPROVE_TONE', 'tone'],
    ['Audience', 'CHANGE_AUDIENCE', 'audience'],
    ['Continue', 'TEXT', 'continue'],
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-accent/35 bg-accent/5 p-5 dark:bg-[#3a2d2d]/70">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Contextual AI Assistant</p>
        <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Every action is submitted through the centralized AI Queue.</p>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Optional direction for the assistant..."
        className="min-h-20 w-full rounded-xl border border-black/10 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-[#4f3d3d]"
        disabled={!canWrite || busy}
      />
      <div className="grid grid-cols-2 gap-2">
        {actions.map(([label, type, action]) => (
          <button key={label} type="button" onClick={() => void submit(type, action)} disabled={!canWrite || busy} className="rounded-xl bg-accent/20 px-3 py-2 text-xs font-bold text-accent disabled:opacity-50">
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-accent/20 bg-white/35 p-3 dark:bg-[#423838]/40">
        <p className="text-sm font-bold">Master Asset</p>
        <p className="my-1 text-center text-accent">↓</p>
        <p className="text-xs text-text/70 dark:text-textDark/70">Derived content variants</p>
        <button type="button" onClick={() => void submit('ATOMIZE', 'atomize', ['LinkedIn Post', 'Instagram Caption', 'Email Summary'])} disabled={!canWrite || busy} className="mt-3 w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">
          Atomize into variants
        </button>
      </div>
      {job ? <p className="text-xs text-text/60 dark:text-textDark/60">Job {job.status.toLowerCase()} · monitor in AI Queue</p> : null}
    </section>
  );
}

function WritingWorkspace({ station, assets, canWrite, onSelectAsset, onRefresh, onShowToast }: Omit<StationWorkspaceProps, 'allStations'>) {
  const [selectedId, setSelectedId] = useState(assets.find((asset) => asset.asset_type !== 'IMAGE')?.id ?? assets[0]?.id ?? '');
  const asset = assets.find((item) => item.id === selectedId) ?? null;
  const [saveState, setSaveState] = useState<'Saved' | 'Saving' | 'Unsaved'>('Saved');
  const editor = useEditor({ extensions: [StarterKit], content: asset?.content ?? '', editable: canWrite });

  useEffect(() => {
    if (asset && editor && editor.getHTML() !== asset.content) editor.commands.setContent(asset.content ?? '');
  }, [asset?.id]);

  const save = async () => {
    if (!asset || !editor || !canWrite) return;
    setSaveState('Saving');
    try {
      await apiFetch(`/assets/${asset.id}`, { method: 'PUT', body: { name: asset.name, title: asset.title ?? asset.name, content: editor.getHTML(), asset_type: asset.asset_type } });
      setSaveState('Saved');
      await onRefresh();
    } catch {
      setSaveState('Unsaved');
      onShowToast('Unable to save the document.');
    }
  };

  const text = editor?.getText() ?? '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (!editor || !asset || !canWrite || !editor.isFocused) return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(timer);
  }, [editor?.getHTML(), asset?.id]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-r border-black/10 p-1 pr-4 dark:border-white/10">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">Documents</p>
          {assets.filter((item) => item.asset_type !== 'IMAGE').map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`mb-2 w-full rounded-xl p-3 text-left text-xs font-semibold ${item.id === selectedId ? 'bg-accent text-backgroundDark' : 'bg-background/70 dark:bg-[#4f3d3d]'}`}>{item.title || item.name}</button>)}
        </div>
        <div className="min-w-0 rounded-2xl border border-black/10 bg-white/75 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/80">
          {asset && editor ? <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 dark:border-white/10">
              <input defaultValue={asset.title || asset.name} className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none" aria-label="Document title" />
              <span className="text-xs text-text/60 dark:text-textDark/60">{wordCount} words · {text.length} characters · {saveState}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {['Bold', 'Italic', 'Bullet list'].map((label) => <button key={label} type="button" onClick={() => label === 'Bold' ? editor.chain().focus().toggleBold().run() : label === 'Italic' ? editor.chain().focus().toggleItalic().run() : editor.chain().focus().toggleBulletList().run()} className="rounded-xl bg-background px-3 py-2 text-xs font-bold dark:bg-[#4f3d3d]">{label}</button>)}
              <button type="button" onClick={() => void save()} disabled={!canWrite} className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Save</button>
              <button type="button" onClick={() => onSelectAsset(asset.id)} className="rounded-xl bg-background px-3 py-2 text-xs font-bold dark:bg-[#4f3d3d]">Versions & detail</button>
            </div>
            <EditorContent editor={editor} className="min-h-[480px] rounded-xl border border-black/10 bg-white/50 p-7 text-[17px] leading-8 dark:border-white/10 dark:bg-[#2d2222]/45" />
            <div className="mt-4"><AiActions asset={asset} draft={text} canWrite={canWrite} onShowToast={onShowToast} /></div>
          </> : <p className="text-sm text-text/60">No writing assets are available in this station.</p>}
        </div>
      </div>
    </div>
  );
}

function EditingWorkspace({ assets, onSelectAsset }: { assets: AssetRecord[]; onSelectAsset: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? '');
  const selected = assets.find((asset) => asset.id === selectedId);
  return <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-[280px_1fr]"> <div className="rounded-3xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/90"><p className="mb-3 text-xs font-bold uppercase tracking-wider">Asset selection</p>{assets.map((asset) => <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)} className={`mb-2 w-full rounded-xl p-3 text-left text-xs font-semibold ${asset.id === selectedId ? 'bg-accent text-backgroundDark' : 'bg-background/70 dark:bg-[#4f3d3d]'}`}>{asset.title || asset.name}</button>)}</div><div className="rounded-3xl border border-black/5 bg-white/80 p-6 dark:border-white/10 dark:bg-[#3a2d2d]/90"><p className="text-xs font-bold uppercase tracking-wider text-accent">Editing workspace</p><h3 className="mt-2 text-xl font-bold">{selected?.title || selected?.name || 'Select an asset'}</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text/80 dark:text-textDark/80">{selected?.content || 'Select an asset to review and compare its content.'}</p>{selected ? <button type="button" onClick={() => onSelectAsset(selected.id)} className="mt-5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark">Open editing, versions, and activity</button> : null}</div></div></div>;
}

function GenerationWorkspace({ station, allStations, canWrite, onShowToast }: { station: StationRecord; allStations: StationRecord[]; canWrite: boolean; onShowToast: (message: string) => void }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(station.project_id);
  const [destination, setDestination] = useState(station.id);
  const [assetType, setAssetType] = useState('IMAGE');
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<AIJobStatusRecord | null>(null);
  useEffect(() => { void apiFetch<ProjectRecord[]>('/projects').then(setProjects).catch(() => setProjects([])); }, []);
  const projectStations = useMemo(() => allStations.filter((item) => item.project_id === selectedProjectId), [allStations, selectedProjectId]);
  useEffect(() => {
    if (projectStations.length > 0 && !projectStations.some((item) => item.id === destination)) {
      setDestination(projectStations[0].id);
    }
  }, [projectStations, destination]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !prompt.trim() || !canWrite) return;
    if (assetType !== 'IMAGE') {
      onShowToast('The current backend materializes Generation Station results only as image assets.');
      return;
    }
    try {
      const submitted = await apiFetch<AIJobStatusRecord>('/ai/jobs', { method: 'POST', body: { job_type: 'IMAGE', organization_id: user.organization_id, station_id: destination, prompt, name: `${assetType} generation`, title: prompt.slice(0, 80), asset_type: assetType } });
      setJob(submitted);
      onShowToast('Generation job submitted to the AI Queue.');
    } catch { onShowToast('Unable to submit generation job.'); }
  };
  return <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/90"><p className="text-xs font-bold uppercase tracking-wider text-accent">Designated creation surface</p><label className="block text-xs font-bold">Project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="mt-2 w-full rounded-xl border p-3 dark:bg-[#4f3d3d]" disabled={!projects.length}>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label><label className="block text-xs font-bold">Destination station<select value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-2 w-full rounded-xl border p-3 dark:bg-[#4f3d3d]">{projectStations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-xs font-bold">Asset type<select value={assetType} onChange={(event) => setAssetType(event.target.value)} className="mt-2 w-full rounded-xl border p-3 dark:bg-[#4f3d3d]"><option>IMAGE</option><option>TEXT</option><option>GENERIC</option></select></label><p className="text-xs text-text/60 dark:text-textDark/60">Image generation is currently the only generation result materialized as a first-class asset by the backend.</p><label className="block text-xs font-bold">Prompt<textarea required value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-2 min-h-32 w-full rounded-xl border p-3 dark:bg-[#4f3d3d]" /></label><button type="submit" disabled={!canWrite} className="rounded-xl bg-accent px-5 py-3 text-xs font-bold text-backgroundDark disabled:opacity-50">Generate through AI Queue</button>{job ? <p className="text-xs text-text/60">Job {job.status.toLowerCase()}. Image results become first-class assets when complete.</p> : null}</form>;
}

function ImageWorkspace({ assets, onSelectAsset }: { assets: AssetRecord[]; onSelectAsset: (id: string) => void }) {
  return <div className="space-y-4"><div className="rounded-3xl border border-black/5 bg-white/70 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/90"><p className="text-xs font-bold uppercase tracking-wider text-accent">Image library</p><p className="mt-2 text-sm text-text/70 dark:text-textDark/70">Browse image assets in project context. Creation belongs in the Generation Station.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assets.filter((asset) => asset.asset_type === 'IMAGE').map((asset) => <button key={asset.id} type="button" onClick={() => onSelectAsset(asset.id)} className="rounded-3xl border border-black/5 bg-white/80 p-5 text-left shadow-sm dark:border-white/10 dark:bg-[#3a2d2d]/90"><span className="text-xs font-bold uppercase text-accent">IMAGE</span><h3 className="mt-2 font-bold">{asset.title || asset.name}</h3><p className="mt-2 text-xs text-text/60">Open for versions, activity, and project context.</p></button>)}</div></div>;
}

export function StationWorkspace({ station, assets, allStations, canWrite, onSelectAsset, onRefresh, onShowToast }: StationWorkspaceProps) {
  const mode = getWorkspaceMode(station);
  return <div className="space-y-6"><WorkspaceHeader station={station} mode={mode} />{mode === 'WRITING' ? <WritingWorkspace station={station} assets={assets} canWrite={canWrite} onSelectAsset={onSelectAsset} onRefresh={onRefresh} onShowToast={onShowToast} /> : null}{mode === 'EDITING' ? <EditingWorkspace assets={assets} onSelectAsset={onSelectAsset} /> : null}{mode === 'GENERATION' ? <GenerationWorkspace station={station} allStations={allStations} canWrite={canWrite} onShowToast={onShowToast} /> : null}{mode === 'IMAGE' ? <ImageWorkspace assets={assets} onSelectAsset={onSelectAsset} /> : null}</div>;
}
