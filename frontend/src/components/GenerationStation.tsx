import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozySkeleton } from './UIStates';
import type { AIJobStatusRecord, AssetRecord, StationRecord } from '../types';

type AssetType = 'TEXT' | 'IMAGE';
type AIResult = { asset_ids?: string[] };

export function GenerationStation({ station }: { station: StationRecord }) {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const canGenerate = roles.some((role) => ['EDITOR', 'ADMIN'].includes(role.toUpperCase()));
  const [assetType, setAssetType] = useState<AssetType>('TEXT');
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<AIJobStatusRecord | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<AssetRecord | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!job || !['QUEUED', 'RUNNING'].includes(job.status)) return;
    const interval = window.setInterval(() => {
      void apiFetch<AIJobStatusRecord>(`/ai/jobs/${job.task_id}`).then((updated) => {
        setJob(updated);
        const result = updated.result && typeof updated.result === 'object' ? updated.result as AIResult : null;
        if (updated.status === 'COMPLETED' && result?.asset_ids?.[0]) {
          void apiFetch<AssetRecord>(`/assets/${result.asset_ids[0]}`).then(setGeneratedAsset).catch(() => undefined);
        }
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [job]);

  const generate = async () => {
    if (!prompt.trim() || !canGenerate || submitting) return;
    try {
      setError('');
      setGeneratedAsset(null);
      setSubmitting(true);
      const created = await apiFetch<AIJobStatusRecord>('/ai/jobs', {
        method: 'POST',
        body: {
          job_type: assetType,
          station_id: station.id,
          prompt: prompt.trim(),
          draft: prompt.trim(),
          action: 'generate',
        },
      });
      setJob(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue generation.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-5 dark:border-white/10"><div><button type="button" onClick={() => navigate(`/projects/${station.project_id}`)} className="text-xs font-bold text-accent">← Project</button><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Generation Station</p><h1 className="mt-1 text-3xl font-bold">{station.name}</h1><p className="mt-2 text-sm text-text/65 dark:text-textDark/65">Create assets through the centralized AI queue.</p></div><span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold uppercase text-accent">{station.station_type}</span></header>
    {error ? <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-3 text-sm">{error}</div> : null}
    <main className="mx-auto w-full max-w-3xl rounded-2xl border border-black/10 bg-white/70 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/80"><div><p className="text-xs font-bold uppercase tracking-wider text-accent">New generation</p><h2 className="mt-2 text-2xl font-bold">Create an asset</h2></div><div className="mt-6"><p className="mb-2 text-xs font-bold">Asset Type</p><div className="grid grid-cols-2 gap-2">{(['TEXT', 'IMAGE'] as const).map((type) => <button key={type} type="button" onClick={() => setAssetType(type)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${assetType === type ? 'border-accent bg-accent/15 text-accent' : 'border-black/10 dark:border-white/10'}`}>{type}</button>)}</div></div><label className="mt-6 block text-xs font-bold" htmlFor="generation-prompt">Prompt<textarea id="generation-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="Describe what you want to create..." className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-background p-3 text-sm outline-none focus:border-accent dark:border-white/10 dark:bg-[#4f3d3d]" /></label><button type="button" disabled={!canGenerate || !prompt.trim() || submitting} onClick={() => void generate()} className="mt-5 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-backgroundDark disabled:opacity-50">{submitting ? 'Queueing...' : 'Generate'}</button>{job ? <section className="mt-8 border-t border-black/10 pt-5 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">AI Job</h3><span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase text-accent">{job.status}</span></div><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-text/55">Job ID</dt><dd className="font-mono">{job.task_id}</dd></div><div><dt className="text-text/55">Priority</dt><dd>{job.priority}</dd></div><div><dt className="text-text/55">Queue position</dt><dd>{job.queue_position ?? 'Running'}</dd></div></dl>{job.status === 'FAILED' ? <p className="mt-3 text-sm text-statusError">{job.error || 'Generation failed.'}</p> : null}{generatedAsset ? <div className="mt-4 rounded-xl bg-background/60 p-4"><p className="text-xs font-bold text-statusSuccess">Asset created</p><p className="mt-1 font-bold">{generatedAsset.title || generatedAsset.name}</p><p className="mt-1 text-xs text-text/60">Open the Writing or Viewing Station to continue.</p></div> : null}</section> : null}</main>
  </div>;
}
