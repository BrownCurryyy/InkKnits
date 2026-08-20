import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiFetch, getAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VersionTimeline } from './VersionTimeline';
import type {
  ActivityRecord,
  AIJobStatusRecord,
  AssetRecord,
  AssetVersionRecord,
  AssetLineageRecord,
} from '../types';

type JobType =
  | 'TEXT'
  | 'REWRITE'
  | 'IMPROVE_TONE'
  | 'CHANGE_AUDIENCE'
  | 'SUMMARIZE'
  | 'EXPAND'
  | 'ATOMIZE'
  | 'IMAGE';

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

function getPermissionMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('requires')
    ) {
      return "You don't have permission for this.";
    }
    return error.message;
  }
  return fallback;
}

interface AssetDetailProps {
  asset: AssetRecord;
  versions: AssetVersionRecord[];
  activityFeed: ActivityRecord[];
  lineage: AssetLineageRecord | null;
  onOpenAsset: (id: string) => void;
  selectedVersionId: string;
  canWrite: boolean;
  canRequestApproval: boolean;
  onClose: () => void;
  onOpenEditModal: () => void;
  onOpenApprovalModal: () => void;
  onDeleteAsset: (id: string) => void;
  onSelectVersion: (id: string) => void;
  onRestoreVersion: (version: AssetVersionRecord) => void;
  onRefreshAsset: (id: string) => Promise<void>;
  onRefreshVersions: (id: string) => Promise<void>;
  onShowToast: (message: string) => void;
}

export function AssetDetail({
  asset,
  versions,
  activityFeed,
  lineage,
  onOpenAsset,
  selectedVersionId,
  canWrite,
  canRequestApproval,
  onClose,
  onOpenEditModal,
  onOpenApprovalModal,
  onDeleteAsset,
  onSelectVersion,
  onRestoreVersion,
  onRefreshAsset,
  onRefreshVersions,
  onShowToast,
}: AssetDetailProps) {
  const { user } = useAuth();
  const [detailTab, setDetailTab] = useState<'info' | 'versions' | 'activity'>('info');

  // Text Writing Surface State
  const [editorContent, setEditorContent] = useState(asset.content ?? '');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const autosaveTimerRef = useRef<number | null>(null);

  // Image Asset State
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // Inline AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiJobType, setAiJobType] = useState<JobType>(asset.asset_type === 'IMAGE' ? 'IMAGE' : 'TEXT');
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiJob, setAiJob] = useState<AIJobStatusRecord | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Update local content state when active asset changes
  useEffect(() => {
    setEditorContent(asset.content ?? '');
    setSaveState('saved');
    setAiPrompt('');
    setAiJobId(null);
    setAiJob(null);
    setAiJobType(asset.asset_type === 'IMAGE' ? 'IMAGE' : 'TEXT');

    if (asset.asset_type === 'IMAGE' && asset.storage_path) {
      void fetchImageData(asset.id);
    } else {
      setImageDataUrl(null);
    }
  }, [asset.id, asset.content, asset.asset_type, asset.storage_path]);

  // Fetch Base64 image payload if stored on disk
  const fetchImageData = async (assetId: string) => {
    setLoadingImage(true);
    try {
      const result = await apiFetch<{ data: string; encoding: string }>(`/assets/${assetId}/download`);
      if (result.data) {
        setImageDataUrl(`data:image/png;base64,${result.data}`);
      }
    } catch {
      setImageDataUrl(null);
    } finally {
      setLoadingImage(false);
    }
  };

  // Compute Word & Character counts
  const wordCount = editorContent.trim() ? editorContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = editorContent.length;

  // Perform backend PUT update (autosave)
  const saveContent = async (newContent: string) => {
    if (!canWrite) return;
    setSaveState('saving');
    try {
      await apiFetch(`/assets/${asset.id}`, {
        method: 'PUT',
        body: {
          name: asset.name,
          title: asset.title || asset.name,
          content: newContent,
          asset_type: asset.asset_type,
        },
      });
      setSaveState('saved');
      await onRefreshVersions(asset.id);
    } catch (err) {
      setSaveState('dirty');
      onShowToast(getPermissionMessage(err, 'Unable to autosave content'));
    }
  };

  // Handle live typing with debounced autosave
  const handleContentChange = (value: string) => {
    setEditorContent(value);
    setSaveState('dirty');

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveContent(value);
    }, 1000);
  };

  // Poll AI job status until completion/failure
  useEffect(() => {
    if (!aiJobId) return;

    const pollInterval = window.setInterval(async () => {
      try {
        const jobStatus = await apiFetch<AIJobStatusRecord>(`/ai/jobs/${aiJobId}`);
        setAiJob(jobStatus);

        if (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED') {
          setIsGenerating(false);
          window.clearInterval(pollInterval);
          if (jobStatus.status === 'COMPLETED') {
            onShowToast('✨ AI generation completed!');
          } else {
            onShowToast(jobStatus.error ?? 'AI job failed');
          }
        }
      } catch {
        setIsGenerating(false);
        window.clearInterval(pollInterval);
      }
    }, 1500);

    return () => window.clearInterval(pollInterval);
  }, [aiJobId]);

  // Submit AI job from inline panel
  const handleGenerateAI = async (overridePrompt?: string, overrideJobType?: JobType) => {
    if (!user) return;
    const promptToUse = overridePrompt || aiPrompt;
    const typeToUse = overrideJobType || aiJobType;

    if (!promptToUse.trim()) {
      onShowToast('Please enter a prompt for the AI assistant.');
      return;
    }

    setIsGenerating(true);
    setAiJob(null);
    try {
      const result = await apiFetch<AIJobStatusRecord>('/ai/jobs', {
        method: 'POST',
        body: {
          job_type: typeToUse,
          prompt: promptToUse,
          asset_id: asset.id,
          draft: editorContent,
          formats: typeToUse === 'ATOMIZE' ? ['LinkedIn Post', 'Tweet Thread', 'Email Summary'] : undefined,
          action: typeToUse.toLowerCase(),
          mood: 'Professional',
          style: 'Narrative',
        },
      });

      setAiJobId(result.task_id);
      setAiJob(result);
    } catch (err) {
      setIsGenerating(false);
      onShowToast(getPermissionMessage(err, 'Unable to submit AI job.'));
    }
  };

  // One-click actions for inserting AI text result
  const handleInsertText = (mode: 'replace' | 'append') => {
    if (!aiJob?.result) return;

    let textResult = '';
    if (typeof aiJob.result === 'string') {
      textResult = aiJob.result;
    } else if (typeof aiJob.result.content === 'string') {
      textResult = aiJob.result.content;
    } else if (typeof aiJob.result.data === 'string') {
      textResult = aiJob.result.data;
    } else {
      textResult = JSON.stringify(aiJob.result, null, 2);
    }

    const updatedContent =
      mode === 'replace'
        ? textResult
        : editorContent
        ? `${editorContent}\n\n${textResult}`
        : textResult;

    setEditorContent(updatedContent);
    void saveContent(updatedContent);
    onShowToast(mode === 'replace' ? 'Document content replaced!' : 'AI text appended!');
  };

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;

  return (
    <div className="space-y-6">
      {lineage?.parents[0] ? (
        <button
          type="button"
          onClick={() => onOpenAsset(lineage.parents[0].id)}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Generated from {lineage.parents[0].title || lineage.parents[0].name}
        </button>
      ) : null}
      {/* Top Header Card */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-2xl">
              {asset.asset_type.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
                  {asset.asset_type}
                </span>
                <span className="text-xs text-text/60 dark:text-textDark/60">
                  v{versions.length || 1} · Updated {formatDate(asset.updated_at || asset.created_at)}
                </span>
              </div>
              <h3 className="mt-1 text-2xl font-bold text-text dark:text-textDark">
                {asset.title || asset.name}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <>
                {canRequestApproval ? <button
                  type="button"
                  onClick={onOpenEditModal}
                  className="rounded-2xl bg-accent/20 px-4 py-2 text-xs font-bold text-accent transition hover:bg-accent/30 active:scale-95"
                >
                  ✏️ Quick Edit
                </button> : null}
                <button
                  type="button"
                  onClick={onOpenApprovalModal}
                  className="rounded-2xl bg-[#d4a373] px-4 py-2 text-xs font-bold text-backgroundDark transition hover:opacity-90 active:scale-95 shadow-sm"
                >
                  Request approval
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAsset(asset.id)}
                  className="rounded-2xl bg-statusError/20 px-4 py-2 text-xs font-bold text-statusError transition hover:bg-statusError/30 active:scale-95"
                >
                  🗑️ Delete
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-background px-4 py-2 text-xs font-bold text-text transition hover:bg-black/5 dark:bg-[#554949] dark:text-textDark"
            >
              ✕ Close
            </button>
          </div>
        </div>
      </div>

      {lineage?.children.length ? (
        <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5 dark:bg-[#3a2d2d]/60">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Lineage</p>
              <h4 className="mt-1 text-lg font-bold text-text dark:text-textDark">Generated variants</h4>
            </div>
            <span className="text-xs text-text/55 dark:text-textDark/55">{lineage.children.length} child assets</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lineage.children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onOpenAsset(child.id)}
                className="rounded-xl border border-black/10 bg-white/65 p-3 text-left transition hover:border-accent hover:bg-white dark:border-white/10 dark:bg-[#423838]/65"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">{child.asset_type}</span>
                <p className="mt-1 text-sm font-bold text-text dark:text-textDark">{child.title || child.name}</p>
                <p className="mt-2 text-xs text-text/55 dark:text-textDark/55">Open child asset →</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Main Grid: Left side Writing Surface / Image Display, Right Side Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left Surface Container */}
        <div className="space-y-6">
          {/* If TEXT asset: Dedicated Writing Surface */}
          {asset.asset_type === 'TEXT' || asset.asset_type === 'GENERIC' ? (
            <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
              {/* Toolbar & Status Bar */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
                    Writing Surface
                  </span>
                  <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-text/80 dark:bg-[#4f3d3d] dark:text-textDark">
                    {wordCount} words · {charCount} chars
                  </span>
                </div>

                {/* Autosave Status Pill */}
                <div className="flex items-center gap-2">
                  {saveState === 'saved' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-statusSuccess/20 px-3 py-1 text-xs font-bold text-statusSuccess border border-statusSuccess/30">
                      ✓ Saved to studio
                    </span>
                  )}
                  {saveState === 'saving' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent animate-pulse border border-accent/30">
                      Saving draft...
                    </span>
                  )}
                  {saveState === 'dirty' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-statusPending/20 px-3 py-1 text-xs font-bold text-statusPending border border-statusPending/30">
                      ● Unsaved changes
                    </span>
                  )}
                </div>
              </div>

              {/* Full-Height Editor Textarea */}
              <div className="relative">
                <textarea
                  value={editorContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  readOnly={!canWrite}
                  placeholder="Start writing your text document here..."
                  className="min-h-[440px] w-full resize-y rounded-2xl border border-black/5 bg-background/30 p-5 font-sans text-base leading-relaxed text-text outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15 dark:border-white/10 dark:bg-[#2d2222]/60 dark:text-textDark dark:focus:bg-[#2d2222]"
                />
              </div>
            </div>
          ) : null}

          {/* If IMAGE asset: Visual Image Display */}
          {asset.asset_type === 'IMAGE' ? (
            <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
              <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
                  Image Asset View
                </span>
                {asset.storage_path ? (
                  <span className="text-xs font-mono text-text/60 dark:text-textDark/60 truncate max-w-[220px]">
                    📁 {asset.storage_path}
                  </span>
                ) : null}
              </div>

              <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-background/40 p-6 dark:border-white/10 dark:bg-[#2d2222]/50">
                {loadingImage ? (
                  <div className="text-center text-sm text-text/60 dark:text-textDark/60 animate-pulse">
                    ⏳ Loading stored image...
                  </div>
                ) : imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt={asset.name}
                    className="max-h-[500px] rounded-2xl object-contain shadow-cozy"
                  />
                ) : (
                  <div className="text-center">
                    <span className="mb-2 block text-4xl">IMAGE</span>
                    <p className="font-semibold text-text dark:text-textDark">{asset.name}</p>
                    <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">
                      Use the contextual AI Assistant on the right to generate or refine visuals.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Sidebar: Contextual AI Assistant & Info / Versions / Activity Panels */}
        <aside className="space-y-6">
          {/* CONTEXTUAL AI ASSISTANT PANEL */}
          <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-white via-accent/5 to-statusPending/10 p-5 shadow-cozy backdrop-blur-md dark:border-accent/40 dark:from-[#3a2d2d] dark:via-[#423838] dark:to-[#4f3d3d]">
            <div className="mb-3 flex items-center justify-between border-b border-black/5 pb-2 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-backgroundDark shadow-sm font-bold text-sm">
                  AI
                </div>
                <div>
                  <h4 className="font-bold text-sm text-text dark:text-textDark">
                    AI Assistant
                  </h4>
                  <p className="text-[10px] text-text/60 dark:text-textDark/60">
                    Contextual to: <span className="font-bold">{asset.title || asset.name}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Buttons */}
            {asset.asset_type !== 'IMAGE' ? (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text/60 dark:text-textDark/60">
                  Quick Actions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Improve', prompt: 'Improve and polish the document text.', type: 'REWRITE' as JobType },
                    { label: 'Expand', prompt: 'Expand the document details.', type: 'EXPAND' as JobType },
                    { label: 'Summarize', prompt: 'Summarize key points.', type: 'SUMMARIZE' as JobType },
                    { label: 'Tone', prompt: 'Improve writing tone to be professional.', type: 'IMPROVE_TONE' as JobType },
                    { label: 'Audience', prompt: 'Adapt content for a broader audience.', type: 'CHANGE_AUDIENCE' as JobType },
                    { label: 'Continue', prompt: 'Continue writing the next paragraphs naturally.', type: 'TEXT' as JobType },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        setAiPrompt(action.prompt);
                        setAiJobType(action.type);
                        void handleGenerateAI(action.prompt, action.type);
                      }}
                      className="rounded-xl bg-white/80 px-2.5 py-1 text-[11px] font-bold text-text/80 shadow-sm transition hover:bg-accent hover:text-backgroundDark dark:bg-[#4f3d3d] dark:text-textDark"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Prompt Input Box */}
            <div className="space-y-2.5">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                placeholder={
                  asset.asset_type === 'IMAGE'
                    ? 'Describe image prompt to generate or refine...'
                    : 'Ask AI to generate, rewrite, or continue...'
                }
                className="w-full rounded-2xl border border-black/10 bg-white/90 p-3 text-xs text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-[#2d2222] dark:text-textDark"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleGenerateAI()}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? 'Working…' : 'Send request'}
                </button>
              </div>
            </div>

            {/* AI Result Display */}
            {aiJob ? (
              <div className="mt-4 rounded-2xl border border-black/10 bg-white/90 p-3.5 shadow-sm dark:border-white/10 dark:bg-[#2d2222]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    AI Output
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      aiJob.status === 'COMPLETED'
                        ? 'bg-statusSuccess/20 text-statusSuccess'
                        : aiJob.status === 'FAILED'
                        ? 'bg-statusError/20 text-statusError'
                        : 'bg-accent/20 text-accent animate-pulse'
                    }`}
                  >
                    {aiJob.status}
                  </span>
                </div>

                {aiJob.status === 'COMPLETED' && aiJob.result ? (
                  <div className="space-y-3">
                    {typeof aiJob.result === 'object' &&
                    aiJob.result !== null &&
                    'data' in aiJob.result &&
                    typeof (aiJob.result as { data: unknown }).data === 'string' ? (
                      <img
                        src={`data:image/png;base64,${(aiJob.result as { data: string }).data}`}
                        alt="Generated image"
                        className="max-h-60 rounded-xl object-contain shadow-cozy"
                      />
                    ) : (
                      <div className="max-h-48 overflow-auto rounded-xl bg-background/50 p-2.5 text-xs leading-relaxed text-text dark:bg-[#4f3d3d]/50 dark:text-textDark">
                        {typeof aiJob.result === 'string'
                          ? aiJob.result
                          : typeof aiJob.result.content === 'string'
                          ? aiJob.result.content
                          : JSON.stringify(aiJob.result, null, 2)}
                      </div>
                    )}

                    {asset.asset_type !== 'IMAGE' ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleInsertText('replace')}
                          className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-bold text-backgroundDark shadow-sm"
                        >
                          Replace Document
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertText('append')}
                          className="rounded-xl bg-background px-3 py-1.5 text-[11px] font-bold text-text dark:bg-[#554949] dark:text-textDark"
                        >
                          Append
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ASSET INFORMATION PANEL (Compact Contextual Info / Versions / Activity) */}
          <div className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
            <div className="mb-4 flex gap-1 rounded-2xl bg-background/80 p-1 dark:bg-[#2d2222]">
              {(['info', 'versions', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-bold capitalize transition ${
                    detailTab === tab
                      ? 'bg-accent text-backgroundDark shadow-sm'
                      : 'text-text/70 hover:text-text dark:text-textDark/70 dark:hover:text-textDark'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Info Tab */}
            {detailTab === 'info' ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-black/5 pb-2 dark:border-white/5">
                  <span className="font-bold text-text/60 dark:text-textDark/60">Asset Type</span>
                  <span className="font-semibold text-accent">{asset.asset_type}</span>
                </div>
                <div className="flex justify-between border-b border-black/5 pb-2 dark:border-white/5">
                  <span className="font-bold text-text/60 dark:text-textDark/60">Current Version</span>
                  <span className="font-bold text-statusSuccess">v{versions.length || 1}</span>
                </div>
                <div className="flex justify-between border-b border-black/5 pb-2 dark:border-white/5">
                  <span className="font-bold text-text/60 dark:text-textDark/60">Owner / Creator</span>
                  <span className="font-semibold text-text dark:text-textDark">
                    {asset.owner_id ? asset.owner_id.slice(0, 8) : 'System'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-black/5 pb-2 dark:border-white/5">
                  <span className="font-bold text-text/60 dark:text-textDark/60">Created</span>
                  <span className="text-text/70 dark:text-textDark/70">{formatDate(asset.created_at)}</span>
                </div>
                <div className="flex justify-between border-b border-black/5 pb-2 dark:border-white/5">
                  <span className="font-bold text-text/60 dark:text-textDark/60">Last Modified</span>
                  <span className="text-text/70 dark:text-textDark/70">{formatDate(asset.updated_at)}</span>
                </div>
                <div>
                  <span className="font-bold text-text/60 dark:text-textDark/60">Raw Metadata JSON</span>
                  <pre className="mt-1.5 max-h-40 overflow-auto rounded-xl bg-background/50 p-2.5 font-mono text-[10px] leading-4 text-text dark:bg-[#2d2222] dark:text-textDark">
                    {JSON.stringify(asset.raw_metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}

            {/* Versions Tab */}
            {detailTab === 'versions' ? (
              <VersionTimeline
                versions={versions}
                selectedVersionId={selectedVersionId}
                selectedVersion={selectedVersion}
                canWrite={canWrite}
                onSelectVersion={onSelectVersion}
                onRestoreVersion={onRestoreVersion}
              />
            ) : null}

            {/* Activity Tab */}
            {detailTab === 'activity' ? (
              <div className="space-y-3">
                {activityFeed.length === 0 ? (
                  <p className="text-xs text-text/70 dark:text-textDark/70">No activity logged.</p>
                ) : (
                  activityFeed.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-black/5 bg-white/70 p-3 dark:border-white/5 dark:bg-[#2d2222]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent uppercase">
                          {item.activity_type}
                        </span>
                        <span className="text-[10px] text-text/60 dark:text-textDark/60">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-text dark:text-textDark">{item.description}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
