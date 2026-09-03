import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozySkeleton } from './UIStates';
import { GenerationStation } from './GenerationStation';
import { AssetNavigator } from './AssetNavigator';
import type { AIJobStatusRecord, ApprovalTaskRecord, AssetLineageRecord, AssetRecord, AssetVersionRecord, StationRecord, UserRecord } from '../types';

type AIResult = { content?: string; results?: Array<{ format: string; content: string }>; asset_ids?: string[] };
const TEXT_TYPES = new Set(['TEXT', 'ARTICLE', 'BLOG_POST', 'LINKEDIN_POST', 'EMAIL', 'SOCIAL_POST']);
const ATOMIZATION_OPTIONS = [
  { category: 'Writing', label: 'Article', description: 'Create a complete article from the source.' },
  { category: 'Writing', label: 'Long-form Article', description: 'Develop an in-depth written piece.' },
  { category: 'Writing', label: 'Blog Post', description: 'Turn the source into a web-ready post.' },
  { category: 'Writing', label: 'Short-form Article', description: 'Condense the source into a shorter article.' },
  { category: 'Writing', label: 'Executive Summary', description: 'Give leaders the essential context.' },
  { category: 'Writing', label: 'TL;DR', description: 'Reduce the source to its core message.' },
  { category: 'Writing', label: 'Key Takeaways', description: 'Extract the most important points.' },
  { category: 'Writing', label: 'Bullet-point Notes', description: 'Convert the source into scannable notes.' },
  { category: 'Writing', label: 'Outline', description: 'Structure the source as an outline.' },
  { category: 'Writing', label: 'FAQ', description: 'Create useful questions and answers.' },
  { category: 'Writing', label: 'Q&A', description: 'Present the ideas as an interview.' },
  { category: 'Writing', label: 'How-to / Tutorial', description: 'Turn the ideas into practical steps.' },
  { category: 'Writing', label: 'Checklist', description: 'Create an actionable checklist.' },
  { category: 'Writing', label: 'Action Items', description: 'Extract concrete next actions.' },
  { category: 'Writing', label: 'Pros & Cons', description: 'Compare benefits, drawbacks, and tradeoffs.' },
  { category: 'Social', label: 'LinkedIn Post', description: 'Create a professional LinkedIn post.' },
  { category: 'Social', label: 'X / Twitter Post', description: 'Write a concise post for X.' },
  { category: 'Social', label: 'X / Twitter Thread', description: 'Break the ideas into a connected thread.' },
  { category: 'Social', label: 'Instagram Caption', description: 'Create an engaging Instagram caption.' },
  { category: 'Social', label: 'Facebook Post', description: 'Adapt the source for Facebook.' },
  { category: 'Social', label: 'Short Social Caption', description: 'Create a compact cross-platform caption.' },
  { category: 'Social', label: 'Social Quote', description: 'Extract a shareable quote.' },
  { category: 'Social', label: 'Carousel Copy', description: 'Structure copy for a social carousel.' },
  { category: 'Communication', label: 'Email', description: 'Convert the source into an email.' },
  { category: 'Communication', label: 'Newsletter', description: 'Create an email-newsletter format.' },
  { category: 'Communication', label: 'Announcement', description: 'Write a clear public announcement.' },
  { category: 'Communication', label: 'Internal Memo', description: 'Adapt the source for an internal memo.' },
  { category: 'Communication', label: 'Press Release', description: 'Create a press-ready release.' },
  { category: 'Video / Audio', label: 'YouTube Script', description: 'Turn the source into a video script.' },
  { category: 'Video / Audio', label: 'Short-form Video Script', description: 'Create a concise short video script.' },
  { category: 'Video / Audio', label: 'Reels / Shorts Script', description: 'Structure a script for short-form video.' },
  { category: 'Video / Audio', label: 'Podcast Script', description: 'Create a spoken podcast script.' },
  { category: 'Video / Audio', label: 'Podcast Show Notes', description: 'Summarize the source for show notes.' },
  { category: 'Video / Audio', label: 'Video Description', description: 'Write a useful video description.' },
  { category: 'SEO / Marketing', label: 'SEO Title', description: 'Create a concise search-friendly title.' },
  { category: 'SEO / Marketing', label: 'Meta Description', description: 'Write a search-result description.' },
  { category: 'SEO / Marketing', label: 'SEO Keywords', description: 'Extract relevant search keywords.' },
  { category: 'SEO / Marketing', label: 'Ad Copy', description: 'Create persuasive advertising copy.' },
  { category: 'SEO / Marketing', label: 'CTA Variations', description: 'Generate several calls to action.' },
  { category: 'SEO / Marketing', label: 'Landing Page Copy', description: 'Adapt the source for a landing page.' },
] as const;
const ATOMIZATION_FORMATS = ATOMIZATION_OPTIONS.map((option) => option.label);

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
  const [newAssetTitle, setNewAssetTitle] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const editor = useEditor({ extensions: [StarterKit, Link.configure({ openOnClick: false })], content: '' });
  const writingAssets = assets.filter((asset) => TEXT_TYPES.has(asset.asset_type.toUpperCase()) || Boolean(asset.content));
  const selectedAsset = writingAssets.find((asset) => asset.id === selectedId) ?? null;
  const currentVersion = versions[versions.length - 1];

  const loadAssets = async (id: string, stationData?: StationRecord) => {
    const stationsForProject = stationData?.station_type === 'WRITING'
      ? [stationData]
      : (await apiFetch<StationRecord[]>('/stations')).filter((item) => item.project_id === stationData?.project_id);
    const stationIds = new Set(stationsForProject.map((item) => item.id));
    const stationAssets = stationData?.station_type === 'WRITING'
      ? await apiFetch<AssetRecord[]>(`/stations/${id}/assets`)
      : (await apiFetch<AssetRecord[]>('/assets')).filter((asset) => stationIds.has(asset.station_id));
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
    const currentStationId = stationId;
    void Promise.all([
      apiFetch<StationRecord>(`/stations/${currentStationId}`),
      apiFetch<StationRecord[]>('/stations'),
    ]).then(async ([stationData]) => {
      setStation(stationData);
      await loadAssets(currentStationId, stationData);
    }).catch(() => setError('Unable to load this station.')).finally(() => setLoading(false));
  }, [stationId]);

  useEffect(() => {
    if (!editor) return;
    if (!selectedAsset) {
      editor.commands.clearContent();
      setVersions([]);
      setNewTitle('');
      return;
    }
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
    if (!station || !user || !newAssetTitle.trim() || creatingAsset) return;
    try {
      setCreatingAsset(true);
      const created = await apiFetch<AssetRecord>('/assets', { method: 'POST', body: { organization_id: user.organization_id, station_id: station.id, name: newAssetTitle.trim(), title: newAssetTitle.trim(), content: '', asset_type: 'TEXT' } });
      setAssets((current) => current.some((asset) => asset.id === created.id) ? current : [...current, created]);
      setSelectedId(created.id);
      setNewTitle(created.title || created.name);
      setNewAssetTitle('');
      void Promise.all([
        apiFetch<AssetLineageRecord>(`/assets/${created.id}/lineage`),
        apiFetch<AssetVersionRecord[]>(`/versions/${created.id}`),
      ]).then(([assetLineage, assetVersions]) => {
        setLineage((current) => ({ ...current, [created.id]: assetLineage }));
        const sortedAssetVersions = [...assetVersions].sort((left, right) => left.version_number - right.version_number);
        const latest = sortedAssetVersions[sortedAssetVersions.length - 1];
        setCurrentVersions((current) => ({ ...current, [created.id]: latest?.version_number ?? 0 }));
        setVersions([...assetVersions].sort((left, right) => left.version_number - right.version_number));
      }).catch(() => undefined);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create text asset.'); }
    finally { setCreatingAsset(false); }
  };

  const saveAsset = async () => {
    if (!selectedAsset || !editor || !canWrite) return;
    const nextContent = editor.getHTML();
    const nextTitle = newTitle.trim() || selectedAsset.name;
    if (nextContent === (selectedAsset.content || '') && nextTitle === (selectedAsset.title || selectedAsset.name)) {
      setSaveState('No changes');
      return;
    }
    try {
      setSaveState('Saving');
      const updated = await apiFetch<AssetRecord>(`/assets/${selectedAsset.id}`, { method: 'PUT', body: { name: selectedAsset.name, title: nextTitle, content: nextContent, asset_type: selectedAsset.asset_type } });
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
      setLineage((current) => { const next = { ...current }; delete next[selectedAsset.id]; return next; });
      setCurrentVersions((current) => { const next = { ...current }; delete next[selectedAsset.id]; return next; });
      setVersions([]);
      setSelectedId(remaining[0]?.id ?? '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete asset.'); }
  };

  const submitAI = async (jobType: string) => {
    const isAtomization = jobType === 'ATOMIZE';
    if (!selectedAsset || !canWrite || (!isAtomization && !selectedText.trim()) || (isAtomization && selectedFormats.length === 0)) return;
    try {
      setJobStatus('QUEUED');
      setAiResult('');
      const masterContext = selectedAsset.content || '';
      const contextualPrompt = jobType === 'ATOMIZE'
        ? ''
        : `Master asset context:\n${masterContext}\n\nApply the requested operation to the highlighted selection below while preserving the master asset's meaning.`;
      const job = await apiFetch<AIJobStatusRecord>('/ai/jobs', { method: 'POST', body: { job_type: jobType, asset_id: selectedAsset.id, draft: isAtomization ? (selectedAsset.content || '') : selectedText, prompt: contextualPrompt, action: jobType.toLowerCase(), formats: isAtomization ? selectedFormats : [] } });
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

  const editorToolbar = <WritingToolbar editor={editor} />;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-5 dark:border-white/10"><div><button type="button" onClick={() => navigate(`/projects/${station.project_id}`)} className="text-xs font-bold text-accent">← Project</button><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Writing Station</p><h1 className="mt-1 text-3xl font-bold">{station.name}</h1></div><span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span></header>
    {error ? <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-3 text-sm">{error}</div> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_280px]">
      <AssetNavigator
        assets={writingAssets}
        lineage={lineage}
        currentVersions={currentVersions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreateAsset={() => void createTextAsset()}
        canCreate={canWrite && Boolean(newAssetTitle.trim()) && !creatingAsset}
        createTitle={newAssetTitle}
        onCreateTitleChange={setNewAssetTitle}
        createLabel="+ Create Text Asset"
        title="CONTENT"
        showCreateButton={true}
      />
      <main className="rounded-2xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-[#3a2d2d]/80"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} disabled={!selectedAsset} className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none" placeholder="Untitled document" /><div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-statusSuccess/20 px-2 py-1 font-bold text-statusSuccess">{currentVersion ? `v${currentVersion.version_number} CURRENT` : 'No version'}</span><span className="text-text/55">{saveState}</span></div></div>{editorToolbar}<div className="writing-editor mt-5 min-h-[420px]"><EditorContent editor={editor} /></div><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-black/10 pt-4 dark:border-white/10"><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void deleteAsset()} className="text-xs font-bold text-statusError disabled:opacity-50">Delete Asset</button><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void saveAsset()} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Save</button></div></main>
      <aside className="space-y-5"><WritingAssistant editor={editor} canWrite={canWrite} selectedText={selectedText} selectedAssetTitle={selectedAsset?.title || selectedAsset?.name || ''} jobStatus={jobStatus} aiResult={aiResult} onSubmit={submitAI} /><AtomizationPanel selectedAssetTitle={selectedAsset?.title || ''} formats={ATOMIZATION_FORMATS} selectedFormats={selectedFormats} setSelectedFormats={setSelectedFormats} jobStatus={jobStatus} canWrite={canWrite} canSubmit={Boolean(selectedAsset)} onSubmit={submitAI} children={lineage[selectedId]?.children ?? []} /></aside>
    </div>
  </div>;
}

type WritingToolbarProps = { editor: ReturnType<typeof useEditor> };

function WritingToolbar({ editor }: WritingToolbarProps) {
  const buttonClass = (active = false) => `rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5'}`;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 border-b border-black/10 pb-3 dark:border-white/10" aria-label="Writing toolbar">
      <div className="flex gap-1 pr-2">
        <button type="button" title="Undo" aria-label="Undo" onClick={() => editor?.chain().focus().undo().run()} className={buttonClass()}>Undo</button>
        <button type="button" title="Redo" aria-label="Redo" onClick={() => editor?.chain().focus().redo().run()} className={buttonClass()}>Redo</button>
      </div>
      <div className="flex gap-1 border-l border-black/10 pl-2 dark:border-white/10">
        <button type="button" title="Bold" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} className={buttonClass(Boolean(editor?.isActive('bold')))}>B</button>
        <button type="button" title="Italic" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} className={buttonClass(Boolean(editor?.isActive('italic')))}>I</button>
        <button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()} className={buttonClass(Boolean(editor?.isActive('strike')))}>S</button>
      </div>
      <div className="flex gap-1 border-l border-black/10 pl-2 dark:border-white/10">
        <button type="button" title="Paragraph" onClick={() => editor?.chain().focus().setParagraph().run()} className={buttonClass(Boolean(editor?.isActive('paragraph')))}>P</button>
        {[1, 2, 3].map((level) => <button key={level} type="button" title={`Heading ${level}`} onClick={() => editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()} className={buttonClass(Boolean(editor?.isActive('heading', { level })))}>H{level}</button>)}
      </div>
      <div className="flex gap-1 border-l border-black/10 pl-2 dark:border-white/10">
        <button type="button" title="Bullet list" aria-label="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={buttonClass(Boolean(editor?.isActive('bulletList')))}>•</button>
        <button type="button" title="Ordered list" aria-label="Ordered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={buttonClass(Boolean(editor?.isActive('orderedList')))}>1.</button>
        <button type="button" title="Blockquote" aria-label="Blockquote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={buttonClass(Boolean(editor?.isActive('blockquote')))}>Quote</button>
      </div>
      <button type="button" title="Set link" onClick={() => { const href = window.prompt('Link URL'); if (href) editor?.chain().focus().setLink({ href }).run(); }} className={buttonClass(Boolean(editor?.isActive('link')))}>Link</button>
    </div>
  );
}

function WritingAssistant({ editor, canWrite, selectedText, selectedAssetTitle, jobStatus, aiResult, onSubmit }: { editor: ReturnType<typeof useEditor>; canWrite: boolean; selectedText: string; selectedAssetTitle: string; jobStatus: string; aiResult: string; onSubmit: (jobType: string) => void }) {
  const actions = [['Improve', 'IMPROVE_TONE'], ['Rewrite', 'REWRITE'], ['Audience', 'CHANGE_AUDIENCE'], ['Tone', 'IMPROVE_TONE'], ['Summarize', 'SUMMARIZE'], ['Expand', 'EXPAND']];
  return (
    <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/70">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Contextual AI</p><h2 className="mt-1 text-lg font-bold">AI Assistant</h2></div><span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase text-accent">{jobStatus || 'Ready'}</span></div>
      <div className="mt-4 space-y-3 text-xs">
        <div className="rounded-xl border border-black/10 bg-background/40 p-3 dark:border-white/10 dark:bg-[#4f3d3d]/50"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Target · selected text</p><p className="mt-2 max-h-16 overflow-auto leading-5 text-text/75 dark:text-textDark/75">{selectedText ? `“${selectedText}”` : 'Highlight text in the editor to begin.'}</p></div>
        <div className="rounded-xl border border-black/10 bg-background/40 p-3 dark:border-white/10 dark:bg-[#4f3d3d]/50"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Context · master document</p><p className="mt-2 truncate font-semibold text-text/75 dark:text-textDark/75">{selectedAssetTitle || 'No document selected'}</p></div>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Actions</p>
      <div className="mt-2 grid grid-cols-2 gap-2">{actions.map(([label, type]) => <button key={label} type="button" disabled={!canWrite || !selectedText.trim() || Boolean(jobStatus && ['QUEUED', 'RUNNING'].includes(jobStatus))} onClick={() => onSubmit(type)} className="rounded-xl border border-black/10 px-2 py-2 text-xs font-bold transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10">{label}</button>)}</div>
      {aiResult ? <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">AI suggestion</p><p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{aiResult}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => editor?.chain().focus().insertContent(aiResult).run()} className="rounded-lg bg-accent px-2 py-1 font-bold text-backgroundDark">Insert</button><button type="button" onClick={() => editor?.chain().focus().insertContentAt(editor.state.doc.content.size, `\n${aiResult}`).run()} className="rounded-lg border border-black/10 px-2 py-1 font-bold dark:border-white/10">Append</button><button type="button" onClick={() => void navigator.clipboard.writeText(aiResult)} className="rounded-lg border border-black/10 px-2 py-1 font-bold dark:border-white/10">Copy</button></div></div> : null}
    </section>
  );
}

function AtomizationPanel({ selectedAssetTitle, formats, selectedFormats, setSelectedFormats, jobStatus, canWrite, canSubmit, onSubmit, children }: { selectedAssetTitle: string; formats: string[]; selectedFormats: string[]; setSelectedFormats: React.Dispatch<React.SetStateAction<string[]>>; jobStatus: string; canWrite: boolean; canSubmit: boolean; onSubmit: (jobType: string) => void; children: AssetRecord[] }) {
  const optionsByCategory = ATOMIZATION_OPTIONS.reduce<Record<string, typeof ATOMIZATION_OPTIONS[number][]>>((groups, option) => {
    (groups[option.category] ??= []).push(option);
    return groups;
  }, {});
  return (
    <section className="flex max-h-[620px] flex-col rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/70">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Create assets</p><h2 className="mt-1 text-lg font-bold">Content Atomisation</h2><p className="mt-1 text-xs text-text/60 dark:text-textDark/60">From {selectedAssetTitle || 'the selected master document'}</p>
      <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-text/55"><span>Select outputs</span><span className="flex gap-2"><button type="button" onClick={() => setSelectedFormats(formats)} className="text-accent">Select all</button><button type="button" onClick={() => setSelectedFormats([])} className="text-text/55">Clear</button></span></div>
      <div className="mt-2 flex-1 space-y-4 overflow-y-auto pr-1">{Object.entries(optionsByCategory).map(([category, options]) => <section key={category}><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">{category}</h3><div className="space-y-1.5">{options.map((option) => { const checked = selectedFormats.includes(option.label); return <label key={option.label} className={`flex cursor-pointer items-start justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${checked ? 'border-accent/60 bg-accent/10' : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5'}`}><span className="flex min-w-0 gap-2"><input type="checkbox" checked={checked} onChange={(event) => setSelectedFormats((current) => event.target.checked ? [...current, option.label] : current.filter((item) => item !== option.label))} className="mt-0.5 shrink-0" /><span className="min-w-0"><span className="block truncate font-semibold">{option.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-text/55 dark:text-textDark/55">{option.description}</span></span></span><span className="ml-2 shrink-0 text-[10px] text-text/50">{checked ? 'Selected' : ''}</span></label>; })}</div></section>)}</div>
      <p className="mt-3 text-xs text-text/55">{selectedFormats.length} selected</p>
      {children.length ? <p className="mt-2 truncate text-[10px] text-text/50">Existing generated assets: {children.length}</p> : null}
      <button type="button" disabled={!canWrite || !canSubmit || selectedFormats.length === 0 || Boolean(jobStatus && ['QUEUED', 'RUNNING'].includes(jobStatus))} onClick={() => onSubmit('ATOMIZE')} className="mt-4 w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark disabled:cursor-not-allowed disabled:opacity-50">{jobStatus === 'QUEUED' || jobStatus === 'RUNNING' ? 'Creating selected...' : 'Create Selected'}</button>
    </section>
  );
}

function ViewingStation({ station, assets, lineage, currentVersions }: ReadOnlyStationProps) {
  const [viewingAssets, setViewingAssets] = useState(assets);
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? '');
  const selected = viewingAssets.find((asset) => asset.id === selectedId) ?? null;
  return <ReadOnlyStationLayout station={station} assets={viewingAssets} lineage={lineage} currentVersions={currentVersions} selectedId={selectedId} onSelect={setSelectedId} onDelete={(assetId) => { const remaining = viewingAssets.filter((asset) => asset.id !== assetId); setViewingAssets(remaining); setSelectedId(remaining[0]?.id ?? ''); }} title="Viewing Station" description="Read and preview project assets." selected={selected} currentVersion={selected ? currentVersions[selected.id] : undefined} />;
}

function ImageStation({ station, assets, lineage, currentVersions }: ReadOnlyStationProps) {
  const { user, roles } = useAuth();
  const canUpload = roles.some((role) => ['EDITOR', 'ADMIN'].includes(role.toUpperCase()));
  const [imageAssets, setImageAssets] = useState(assets.filter((asset) => asset.asset_type.toUpperCase() === 'IMAGE'));
  const [selectedId, setSelectedId] = useState(imageAssets[0]?.id ?? '');
  const selected = imageAssets.find((asset) => asset.id === selectedId) ?? null;
  const upload = async (file: File) => {
    if (!user || !canUpload) return;
    const body = new FormData();
    body.append('organization_id', user.organization_id);
    body.append('station_id', station.id);
    body.append('name', file.name);
    body.append('asset_type', 'IMAGE');
    body.append('file', file);
    try {
      const created = await apiFetch<AssetRecord>('/assets/upload', { method: 'POST', body });
      setImageAssets((current) => [...current, created]);
      setSelectedId(created.id);
    } catch { return; }
  };
  const uploadControl = canUpload ? <label className="cursor-pointer rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark">Upload image<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label> : null;
  return <ReadOnlyStationLayout station={station} assets={imageAssets} lineage={lineage} currentVersions={currentVersions} selectedId={selectedId} onSelect={setSelectedId} onDelete={(assetId) => { const remaining = imageAssets.filter((asset) => asset.id !== assetId); setImageAssets(remaining); setSelectedId(remaining[0]?.id ?? ''); }} title="Image Station" description="Preview image assets from this project." selected={selected} currentVersion={selected ? currentVersions[selected.id] : undefined} headerAction={uploadControl} />;
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
  headerAction?: ReactNode;
  onDelete?: (assetId: string) => void;
}

function ReadOnlyStationLayout({ station, assets, lineage, currentVersions, title, description, selectedId, onSelect, selected, currentVersion, headerAction, onDelete }: ReadOnlyStationLayoutProps) {
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-5 dark:border-white/10"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{title}</p><h1 className="mt-2 text-3xl font-bold">{station.name}</h1><p className="mt-2 text-sm text-text/65 dark:text-textDark/65">{description}</p></div><div className="flex items-center gap-2">{headerAction}<span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span></div></header>
    <div className="grid gap-5 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
      <AssetNavigator
        assets={assets}
        lineage={lineage}
        currentVersions={currentVersions}
        selectedId={selectedId}
        onSelect={onSelect}
        title="CONTENT"
      />
      <main className="rounded-2xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-[#3a2d2d]/80">{selected ? <ReadOnlyAsset asset={selected} lineage={lineage[selected.id]} currentVersion={currentVersion} imageOnly={station.station_type === 'IMAGE'} onDeleted={onDelete} /> : <p className="py-16 text-center text-sm text-text/60 dark:text-textDark/60">No assets are available in this station.</p>}</main>
    </div>
  </div>;
}

function ReadOnlyAsset({ asset, lineage, currentVersion, imageOnly, onDeleted }: { asset: AssetRecord; lineage?: AssetLineageRecord; currentVersion?: number; imageOnly: boolean; onDeleted?: (assetId: string) => void }) {
  const { user, roles } = useAuth();
  const [approvalTask, setApprovalTask] = useState<ApprovalTaskRecord | null>(null);
  const [reviewers, setReviewers] = useState<UserRecord[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  const canRequestApproval = roles.some((role) => ['ADMIN'].includes(role.toUpperCase()));
  const canDelete = roles.some((role) => ['EDITOR', 'ADMIN'].includes(role.toUpperCase()));
  const activeApprovalTask = approvalTask && ['PENDING', 'ESCALATED'].includes((approvalTask.status || '').toUpperCase()) ? approvalTask : null;
  const approvalStatusLabel = !approvalTask ? 'Not submitted' : approvalTask.status === 'PENDING' ? 'Pending review' : approvalTask.status === 'APPROVED' ? 'Approved' : approvalTask.status === 'REJECTED' ? 'Rejected' : approvalTask.status === 'ESCALATED' ? 'Escalated' : approvalTask.status;

  useEffect(() => {
    if (!asset.id) return;
    void apiFetch<ApprovalTaskRecord[]>('/approvals/tasks')
      .then((tasks) => {
        const matching = tasks.filter((task) => task.asset_id === asset.id).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
        setApprovalTask(matching[0] ?? null);
      })
      .catch(() => setApprovalTask(null));
  }, [asset.id]);

  const previewApproval = async () => {
    if (!user?.organization_id) {
      setApprovalError('Unable to load reviewer list.');
      return;
    }

    try {
      const members = await apiFetch<UserRecord[]>(`/organizations/${user.organization_id}/members`);
      setReviewers(members);
      const defaultReviewer = members.find((member) => member.id !== user.id) ?? members[0] ?? null;
      setReviewerId(defaultReviewer?.id ?? '');
      setApprovalComment('');
      setApprovalError('');
      setShowApprovalModal(true);
    } catch {
      setApprovalError('Unable to load reviewers for approval routing.');
    }
  };

  const submitApprovalRequest = async () => {
    if (!reviewerId) {
      setApprovalError('Select a reviewer before submitting.');
      return;
    }

    try {
      setIsSubmittingApproval(true);
      setApprovalError('');
      const created = await apiFetch<ApprovalTaskRecord>('/approvals/tasks', {
        method: 'POST',
        body: {
          asset_id: asset.id,
          assigned_to: reviewerId,
          comments: approvalComment.trim() || undefined,
          deadline: null,
        },
      });
      setApprovalTask(created);
      setApprovalMessage(`Approval requested for ${asset.title || asset.name} · v${currentVersion ?? 0}`);
      setShowApprovalModal(false);
      setApprovalComment('');
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Unable to request approval. Please try again.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const deleteAsset = async () => {
    if (!canDelete || !window.confirm(`Delete ${asset.title || asset.name}?`)) return;
    try {
      await apiFetch(`/assets/${asset.id}`, { method: 'DELETE' });
      onDeleted?.(asset.id);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Unable to delete asset.');
    }
  };

  const previewEditor = useEditor({ extensions: [StarterKit], content: asset.content || '', editable: false });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  useEffect(() => { previewEditor?.commands.setContent(asset.content || ''); }, [asset.id, previewEditor]);
  useEffect(() => {
    if (asset.asset_type.toUpperCase() !== 'IMAGE' || !asset.storage_path) return;
    void apiFetch<{ data: string; encoding: string }>(`/assets/${asset.id}/download`).then((result) => setPreviewImage(`data:image/png;base64,${result.data}`)).catch(() => setPreviewImage(null));
  }, [asset.id, asset.asset_type, asset.storage_path]);
  const parent = lineage?.parents[0];
  const children = lineage?.children ?? [];
  return <article>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{asset.asset_type}</p>
        <h2 className="mt-1 text-2xl font-bold">{asset.title || asset.name}</h2>
      </div>
      <span className="rounded-full bg-statusSuccess/20 px-3 py-1.5 text-xs font-bold text-statusSuccess">{currentVersion ? `v${currentVersion} CURRENT` : 'Version unavailable'}</span>
    </div>
    <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-[#3a2d2d]/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text/55 dark:text-textDark/55">Approval</p>
          <p className="mt-1 text-sm font-semibold text-text dark:text-textDark">{approvalStatusLabel}</p>
          <p className="mt-1 text-[11px] text-text/60 dark:text-textDark/60">{activeApprovalTask ? `Submitted for v${currentVersion ?? 0}` : `Not submitted for v${currentVersion ?? 0}`}</p>
        </div>
        {canRequestApproval && !activeApprovalTask ? (
          <button type="button" onClick={() => void previewApproval()} className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark">Request Approval</button>
        ) : null}
        {activeApprovalTask ? <span className="rounded-full bg-statusPending/20 px-2.5 py-1 text-[10px] font-bold text-statusPending">Approval pending</span> : null}
      </div>
      {approvalMessage ? <p className="mt-3 rounded-xl bg-statusSuccess/15 px-3 py-2 text-xs font-medium text-statusSuccess">{approvalMessage}</p> : null}
      {approvalError ? <p className="mt-3 rounded-xl border border-statusError/40 bg-statusError/10 px-3 py-2 text-xs text-statusError">{approvalError}</p> : null}
    </div>
    {imageOnly || asset.asset_type.toUpperCase() === 'IMAGE' ? <div className="mt-6 flex min-h-[360px] items-center justify-center rounded-2xl bg-black/5 p-4 dark:bg-black/20">{previewImage ? <img src={previewImage} alt={asset.title || asset.name} className="max-h-[560px] max-w-full object-contain" /> : <p className="text-sm text-text/55">Preview unavailable.</p>}</div> : <div className="writing-editor mt-6"><EditorContent editor={previewEditor} /></div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 text-xs text-text/60 dark:border-white/10 dark:text-textDark/60"><div className="flex flex-wrap gap-3"><span>Author: {asset.owner_id ? asset.owner_id.slice(0, 8) : 'System'}</span><span>Created: {asset.created_at ? formatStationDate(asset.created_at) : 'Unknown'}</span>{parent ? <span>Derived from: {parent.title || parent.name}</span> : null}{children.length ? <span>Children: {children.map((child) => child.title || child.name).join(', ')}</span> : null}</div>{canDelete ? <button type="button" onClick={() => void deleteAsset()} className="font-bold text-statusError">Delete Asset</button> : null}</div>
    {showApprovalModal ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title">
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-[#fffaf1] p-5 shadow-[0_18px_42px_rgba(25,16,16,0.18)] dark:border-white/10 dark:bg-[#2f2626]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Request Approval</p>
          <h3 id="approval-modal-title" className="mt-2 text-2xl font-bold">{asset.title || asset.name}</h3>
          <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">Version {currentVersion ?? 0}</p>
          <p className="mt-4 text-sm leading-6 text-text dark:text-textDark">Submit this version for approval?</p>
          <div className="mt-4">
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/55">Reviewer</label>
            <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4a3d3d]">
              <option value="">Select a reviewer</option>
              {reviewers.map((member) => <option key={member.id} value={member.id}>{member.display_name || member.email}</option>)}
            </select>
          </div>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/55">
            Comment (optional)
            <textarea value={approvalComment} onChange={(event) => setApprovalComment(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#4a3d3d]" placeholder="Add context for the reviewer..." />
          </label>
          {approvalError ? <p className="mt-3 text-xs text-statusError">{approvalError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setShowApprovalModal(false)} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-bold dark:border-white/10">Cancel</button>
            <button type="button" onClick={() => void submitApprovalRequest()} disabled={!reviewerId || isSubmittingApproval} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmittingApproval ? 'Submitting...' : 'Request Approval'}
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </article>;
}

function formatStationDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
