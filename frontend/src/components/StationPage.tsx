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
  const [atomizationOpen, setAtomizationOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [writingFocus, setWritingFocus] = useState(false);
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
    let active = true;
    setLoading(true);
    setError('');
    setStation(null);
    setAssets([]);
    setLineage({});
    setCurrentVersions({});
    setSelectedId('');
    void Promise.all([
      apiFetch<StationRecord>(`/stations/${currentStationId}`),
      apiFetch<StationRecord[]>('/stations'),
    ]).then(async ([stationData]) => {
      if (!active) return;
      setStation(stationData);
      await loadAssets(currentStationId, stationData);
    }).catch(() => {
      if (active) setError('Unable to load this station.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
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
    if (!selectedAsset || !canWrite || (!isAtomization && !selectedText.trim()) || (isAtomization && selectedFormats.length === 0)) return false;
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
      return true;
    } catch (err) { setJobStatus('FAILED'); setAiResult(err instanceof Error ? err.message : 'Unable to submit AI job.'); return false; }
  };

  if (loading) return <CozySkeleton rows={6} />;
  if (error && !station) return <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error}</div>;
  if (!station) return null;
  if (station.station_type === 'VIEWING') return <ViewingStation station={station} assets={assets} lineage={lineage} currentVersions={currentVersions} />;
  if (station.station_type === 'IMAGE') return <ImageStation station={station} assets={assets} lineage={lineage} currentVersions={currentVersions} />;
  if (station.station_type === 'GENERATION') return <GenerationStation station={station} />;

  const editorToolbar = <WritingToolbar editor={editor} />;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D9D6CF] pb-5 dark:border-[#292929]"><div><button type="button" onClick={() => navigate(`/projects/${station.project_id}`)} className="text-xs font-bold text-accent">← Project</button>{!writingFocus ? <><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Writing Station</p><h1 className="mt-1 text-3xl font-bold">{station.name}</h1></> : <h1 className="mt-4 text-2xl font-bold">Writing Focus</h1>}</div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setNavigationOpen((current) => !current)} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold dark:border-white/10">{navigationOpen ? 'Hide assets' : 'Show assets'}</button><button type="button" onClick={() => setAiPanelOpen((current) => !current)} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold dark:border-white/10">{aiPanelOpen ? 'Hide AI' : 'AI'}</button><button type="button" onClick={() => setAtomizationOpen(true)} disabled={!canWrite || !selectedAsset} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold dark:border-white/10 disabled:opacity-40">Create assets</button><button type="button" onClick={() => { setWritingFocus((current) => !current); setNavigationOpen(false); setAiPanelOpen(false); }} className="rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent">{writingFocus ? 'Exit focus' : 'Focus'}</button>{!writingFocus ? <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span> : null}</div></header>
    {error ? <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-3 text-sm">{error}</div> : null}
    <div className={`grid gap-5 transition-[grid-template-columns] duration-300 ${writingFocus || !navigationOpen ? 'xl:grid-cols-[minmax(0,1fr)]' : aiPanelOpen ? 'xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_280px]' : 'xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]'}`}>
      {navigationOpen && !writingFocus ? <AssetNavigator
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
      /> : null}
      <main className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 dark:border-[#292929] dark:bg-[#151515]/90"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} disabled={!selectedAsset} className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none" placeholder="Untitled document" /><div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-statusSuccess/20 px-2 py-1 font-bold text-statusSuccess">{currentVersion ? `v${currentVersion.version_number} CURRENT` : 'No version'}</span><span className="text-text/55">{saveState}</span></div></div>{editorToolbar}<div className="writing-editor mt-5 min-h-[420px]"><EditorContent editor={editor} /></div><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-black/10 pt-4 dark:border-white/10"><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void deleteAsset()} className="text-xs font-bold text-statusError disabled:opacity-50">Delete Asset</button><button type="button" disabled={!canWrite || !selectedAsset} onClick={() => void saveAsset()} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Save</button></div></main>
      {aiPanelOpen && !writingFocus ? <aside className="space-y-5 transition-opacity duration-300"><WritingAssistant editor={editor} canWrite={canWrite} selectedText={selectedText} selectedAssetTitle={selectedAsset?.title || selectedAsset?.name || ''} jobStatus={jobStatus} aiResult={aiResult} onSubmit={(jobType) => { void submitAI(jobType); }} /></aside> : null}
    </div>
    <AtomizationPanel open={atomizationOpen} setOpen={setAtomizationOpen} showLauncher={false} selectedAssetTitle={selectedAsset?.title || ''} formats={ATOMIZATION_FORMATS} selectedFormats={selectedFormats} setSelectedFormats={setSelectedFormats} jobStatus={jobStatus} canWrite={canWrite} canSubmit={Boolean(selectedAsset)} onSubmit={async () => { const succeeded = await submitAI('ATOMIZE'); if (succeeded) setAtomizationOpen(false); }} children={lineage[selectedId]?.children ?? []} />
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
    <section className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-4 dark:border-[#292929] dark:bg-[#151515]/90">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Contextual AI</p><h2 className="mt-1 text-lg font-bold">AI Assistant</h2></div><span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase text-accent">{jobStatus || 'Ready'}</span></div>
      <div className="mt-4 space-y-3 text-xs">
        <div className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE]/80 p-3 dark:border-[#292929] dark:bg-[#1A1A1A]/80"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Target · selected text</p><p className="mt-2 max-h-16 overflow-auto leading-5 text-text/75 dark:text-textDark/75">{selectedText ? `“${selectedText}”` : 'Highlight text in the editor to begin.'}</p></div>
        <div className="rounded-xl border border-[#D9D6CF] bg-[#F5F3EE]/80 p-3 dark:border-[#292929] dark:bg-[#1A1A1A]/80"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Context · master document</p><p className="mt-2 truncate font-semibold text-text/75 dark:text-textDark/75">{selectedAssetTitle || 'No document selected'}</p></div>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Actions</p>
      <div className="mt-2 grid grid-cols-2 gap-2">{actions.map(([label, type]) => <button key={label} type="button" disabled={!canWrite || !selectedText.trim() || Boolean(jobStatus && ['QUEUED', 'RUNNING'].includes(jobStatus))} onClick={() => onSubmit(type)} className="rounded-xl border border-black/10 px-2 py-2 text-xs font-bold transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10">{label}</button>)}</div>
      {aiResult ? <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">AI suggestion</p><p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{aiResult}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => editor?.chain().focus().insertContent(aiResult).run()} className="rounded-lg bg-accent px-2 py-1 font-bold text-backgroundDark">Insert</button><button type="button" onClick={() => editor?.chain().focus().insertContentAt(editor.state.doc.content.size, `\n${aiResult}`).run()} className="rounded-lg border border-black/10 px-2 py-1 font-bold dark:border-white/10">Append</button><button type="button" onClick={() => void navigator.clipboard.writeText(aiResult)} className="rounded-lg border border-black/10 px-2 py-1 font-bold dark:border-white/10">Copy</button></div></div> : null}
    </section>
  );
}

type AtomizationPanelProps = { open: boolean; setOpen: (open: boolean) => void; selectedAssetTitle: string; formats: string[]; selectedFormats: string[]; setSelectedFormats: React.Dispatch<React.SetStateAction<string[]>>; jobStatus: string; canWrite: boolean; canSubmit: boolean; onSubmit: (jobType: string) => void; children: AssetRecord[]; showLauncher?: boolean };

function AtomizationPanel({ open, setOpen, showLauncher = true, ...workspaceProps }: AtomizationPanelProps) {
  const { jobStatus, canWrite, canSubmit } = workspaceProps;
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !['QUEUED', 'RUNNING'].includes(jobStatus)) setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleEscape); };
  }, [open, jobStatus, setOpen]);
  return (
    <>
      {showLauncher ? <section className="rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-4 shadow-[0_8px_20px_rgba(17,17,17,0.04)] dark:border-[#292929] dark:bg-[#151515]/90">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Create assets</p>
        <h2 className="mt-1 text-lg font-bold">Content Atomisation</h2>
        <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Turn this document into focused formats.</p>
        <button type="button" onClick={() => setOpen(true)} disabled={!canWrite || !canSubmit} className="mt-4 w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-backgroundDark transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_12px_rgba(190,52,44,0.18)] disabled:cursor-not-allowed disabled:opacity-50">Open{workspaceProps.selectedFormats.length ? ` · ${workspaceProps.selectedFormats.length} selected` : ''}</button>
      </section> : null}
      {open ? <div className="atomization-backdrop fixed inset-0 z-50 flex items-center justify-center bg-backgroundDark/60 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="atomization-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !['QUEUED', 'RUNNING'].includes(jobStatus)) setOpen(false); }}><div className="atomization-modal w-full max-w-3xl" onMouseDown={(event) => event.stopPropagation()}><AtomizationWorkspace {...workspaceProps} onClose={() => { if (!['QUEUED', 'RUNNING'].includes(jobStatus)) setOpen(false); }} /></div></div> : null}
    </>
  );
}

function AtomizationWorkspace({ selectedAssetTitle, formats, selectedFormats, setSelectedFormats, jobStatus, canWrite, canSubmit, onSubmit, children, onClose }: { selectedAssetTitle: string; formats: string[]; selectedFormats: string[]; setSelectedFormats: React.Dispatch<React.SetStateAction<string[]>>; jobStatus: string; canWrite: boolean; canSubmit: boolean; onSubmit: (jobType: string) => void; children: AssetRecord[]; onClose: () => void }) {
  const optionsByCategory = ATOMIZATION_OPTIONS.reduce<Record<string, typeof ATOMIZATION_OPTIONS[number][]>>((groups, option) => {
    (groups[option.category] ??= []).push(option);
    return groups;
  }, {});
  const categories = Object.keys(optionsByCategory);
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? 'Writing');
  const [showAllSelected, setShowAllSelected] = useState(false);
  const activeOptions = optionsByCategory[activeCategory] ?? [];
  const toggleFormat = (format: string) => setSelectedFormats((current) => current.includes(format) ? current.filter((item) => item !== format) : [...current, format]);
  return (
    <section className="flex max-h-[min(680px,calc(100vh-2rem))] flex-col rounded-2xl border border-accent/30 bg-[#F5F3EE] p-5 shadow-[0_24px_70px_rgba(17,17,17,0.12)] dark:bg-[#151515]">
      <header className="flex items-start justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/10"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Create assets</p><h2 id="atomization-modal-title" className="mt-1 text-2xl font-bold">Content Atomisation</h2><p className="mt-1 text-sm text-text/60 dark:text-textDark/60">Turn {selectedAssetTitle || 'this document'} into multiple focused formats.</p></div><button type="button" aria-label="Close Content Atomisation" onClick={onClose} disabled={['QUEUED', 'RUNNING'].includes(jobStatus)} className="rounded-lg border border-black/10 px-2.5 py-1 text-lg leading-none transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10">×</button></header>
      <div className="mt-4 flex items-center justify-between gap-3 border-b border-black/10 pb-1 dark:border-white/10"><div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Atomisation categories">{categories.map((category) => <button key={category} type="button" role="tab" aria-selected={activeCategory === category} onClick={() => setActiveCategory(category)} className={`relative whitespace-nowrap px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors duration-200 ${activeCategory === category ? 'text-accent' : 'text-text/50 hover:text-text/80 dark:text-textDark/55 dark:hover:text-textDark/80'}`}>{category.replace('Video / Audio', 'Media').replace('SEO / Marketing', 'Marketing')}{activeCategory === category ? <span className="absolute inset-x-2 -bottom-[5px] h-0.5 rounded-full bg-accent transition-all duration-200" /> : null}</button>)}</div><div className="flex shrink-0 gap-2 text-[10px] font-bold"><button type="button" onClick={() => setSelectedFormats(formats)} className="text-accent transition-opacity hover:opacity-70">Select all</button><button type="button" onClick={() => setSelectedFormats([])} className="text-text/50 transition-opacity hover:opacity-70">Clear</button></div></div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1"><div key={activeCategory} className="grid grid-cols-2 gap-3 sm:grid-cols-3">{activeOptions.map((option, index) => { const checked = selectedFormats.includes(option.label); return <button key={option.label} type="button" role="checkbox" aria-checked={checked} onClick={() => toggleFormat(option.label)} style={{ animationDelay: `${index * 25}ms` }} className={`[animation:atomizationFadeIn_220ms_ease-out_both] group relative min-h-[82px] rounded-xl border p-3 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${checked ? 'border-accent/70 bg-accent/10 shadow-[0_4px_12px_rgba(180,151,231,0.14)]' : 'border-[#D9D6CF] bg-[#F5F3EE]/70 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/5 dark:border-[#292929] dark:bg-[#1A1A1A]/80 dark:hover:bg-[#1A1A1A]'}`}><span className={`absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold transition-all duration-200 ${checked ? 'scale-100 bg-accent text-backgroundDark' : 'scale-75 border border-text/25 text-transparent group-hover:scale-100'}`}>✓</span><span className="block max-w-[calc(100%-22px)] truncate text-sm font-bold text-text dark:text-textDark">{option.label}</span><span className="mt-1 block truncate text-[11px] leading-4 text-text/55 dark:text-textDark/55">{option.description}</span></button>; })}</div></div>
      <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/55">Selected</p><div className="flex items-center gap-2"><span className="text-[10px] text-text/50">{selectedFormats.length} format{selectedFormats.length === 1 ? '' : 's'}</span>{selectedFormats.length > 6 ? <button type="button" onClick={() => setShowAllSelected((current) => !current)} className="text-[10px] font-bold text-accent">{showAllSelected ? 'Less' : 'View all'}</button> : null}</div></div>{selectedFormats.length ? <div className={`mt-2 flex flex-wrap gap-1.5 ${showAllSelected ? '' : 'max-h-12 overflow-hidden'}`}>{selectedFormats.map((format) => <button key={format} type="button" onClick={() => toggleFormat(format)} title={`Remove ${format}`} className="[animation:atomizationFadeIn_180ms_ease-out_both] rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/25">{format} <span aria-hidden="true">×</span></button>)}</div> : <p className="mt-2 text-[10px] text-text/50">Choose one or more formats above.</p>}</div>
      {children.length ? <p className="mt-2 truncate text-[10px] text-text/50">Existing generated assets: {children.length}</p> : null}
      <button type="button" disabled={!canWrite || !canSubmit || selectedFormats.length === 0 || Boolean(jobStatus && ['QUEUED', 'RUNNING'].includes(jobStatus))} onClick={() => onSubmit('ATOMIZE')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-backgroundDark transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_12px_rgba(190,52,44,0.18)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">{jobStatus === 'QUEUED' || jobStatus === 'RUNNING' ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-backgroundDark/30 border-t-backgroundDark" />Creating selected...</> : `Generate ${selectedFormats.length ? `${selectedFormats.length} selected` : 'selected'}`}</button>
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
  useEffect(() => {
    const nextAssets = assets.filter((asset) => asset.asset_type.toUpperCase() === 'IMAGE');
    setImageAssets(nextAssets);
    setSelectedId((current) => nextAssets.some((asset) => asset.id === current) ? current : nextAssets[0]?.id ?? '');
  }, [assets, station.id]);
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
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  return <div className={`space-y-5 transition-all duration-300 ${focusMode ? 'fixed inset-0 z-30 overflow-y-auto bg-background p-5 dark:bg-backgroundDark lg:ml-72' : ''}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D9D6CF] pb-5 dark:border-[#292929]"><div>{!focusMode ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{title}</p> : null}<h1 className={`${focusMode ? 'mt-2 text-2xl' : 'mt-2 text-3xl'} font-bold`}>{focusMode ? `${title} Focus` : station.name}</h1>{!focusMode ? <p className="mt-2 text-sm text-text/65 dark:text-textDark/65">{description}</p> : null}</div><div className="flex items-center gap-2">{!focusMode ? headerAction : null}<button type="button" onClick={() => setNavigationOpen((current) => !current)} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold dark:border-white/10">{navigationOpen ? 'Hide assets' : 'Show assets'}</button><button type="button" onClick={() => { setFocusMode((current) => !current); setNavigationOpen(false); }} className="rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent">{focusMode ? 'Exit focus' : 'Focus'}</button>{!focusMode ? <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span> : null}</div></header>
    <div className={`grid gap-5 transition-[grid-template-columns] duration-300 ${focusMode || !navigationOpen ? 'lg:grid-cols-[minmax(0,1fr)]' : 'lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]'}`}>
      {navigationOpen && !focusMode ? <AssetNavigator
        assets={assets}
        lineage={lineage}
        currentVersions={currentVersions}
        selectedId={selectedId}
        onSelect={onSelect}
        title="CONTENT"
      /> : null}
      <main className={`rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-6 transition-all duration-300 dark:border-[#292929] dark:bg-[#151515]/90 ${focusMode ? 'min-h-[calc(100vh-9rem)]' : ''}`}>{selected ? <ReadOnlyAsset asset={selected} lineage={lineage[selected.id]} currentVersion={currentVersion} imageOnly={station.station_type === 'IMAGE'} onDeleted={onDelete} /> : <p className="py-16 text-center text-sm text-text/60 dark:text-textDark/60">No assets are available in this station.</p>}</main>
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
    <div className="mt-4 rounded-2xl border border-[#D9D6CF] bg-[#F5F3EE]/90 p-4 dark:border-[#292929] dark:bg-[#151515]/90">
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
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-[#F5F3EE] p-5 shadow-[0_18px_42px_rgba(25,16,16,0.18)] dark:border-white/10 dark:bg-[#2f2626]">
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
