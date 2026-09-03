import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AssetPreview, JobStatusBadge } from './AssetPreview';
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
  const [relatedStations, setRelatedStations] = useState<StationRecord[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void apiFetch<StationRecord[]>('/stations')
      .then((stations) => setRelatedStations(stations.filter((item) => item.project_id === station.project_id)))
      .catch(() => setRelatedStations([]));
  }, [station.project_id]);

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

  const writingStation = relatedStations.find((item) => item.station_type === 'WRITING');
  const viewingStation = relatedStations.find((item) => item.station_type === 'VIEWING');
  const imageStation = relatedStations.find((item) => item.station_type === 'IMAGE');
  const targetStation = assetType === 'IMAGE' ? imageStation : (writingStation || viewingStation);

  return (
    <div className="relative space-y-6">
      <div className="blob-circle -left-8 -top-8 h-32 w-32" aria-hidden="true" />
      <div className="blob-circle bottom-0 right-0 h-24 w-24 bg-accent/30" aria-hidden="true" />

      <header className="relative flex flex-wrap items-start justify-between gap-4 border-b border-accentSecondary/30 pb-6">
        <div>
          <button type="button" onClick={() => navigate(`/projects/${station.project_id}`)} className="text-xs font-bold text-accentSecondary hover:underline">
            ← back to project
          </button>
          <p className="section-label mt-4">generation station</p>
          <h1 className="display-heading mt-1 text-text dark:text-textDark">{station.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-text/65 dark:text-textDark/65">
            Create assets and see results instantly — no need to switch sections.
          </p>
        </div>
        <span className="rounded-full bg-accentSecondary/20 px-4 py-2 text-xs font-bold uppercase text-accentSecondary dark:text-accentSecondary">
          {station.station_type}
        </span>
      </header>

      {error ? (
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error}</div>
      ) : null}

      <div className="grid min-h-[560px] gap-0 overflow-hidden rounded-2xl shadow-bold lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
        {/* Input pane — lime green */}
        <section className="flex flex-col bg-accent p-6 text-text lg:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text/60">new generation</p>
          <h2 className="font-display mt-2 text-3xl font-bold lowercase">create an asset</h2>

          <div className="mt-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider">asset type</p>
            <div className="grid grid-cols-2 gap-2">
              {(['TEXT', 'IMAGE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAssetType(type)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                    assetType === type
                      ? 'border-text bg-text text-white'
                      : 'border-text/20 bg-white/40 hover:border-text/40'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-6 block flex-1 text-xs font-bold uppercase tracking-wider" htmlFor="generation-prompt">
            prompt
            <textarea
              id="generation-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={8}
              placeholder="Describe what you want to create…"
              className="mt-2 w-full flex-1 resize-y rounded-xl border-2 border-text/15 bg-white/70 p-4 text-sm font-normal normal-case outline-none focus:border-text dark:bg-white/90"
            />
          </label>

          <button
            type="button"
            disabled={!canGenerate || !prompt.trim() || submitting}
            onClick={() => void generate()}
            className="mt-6 w-full rounded-xl bg-text px-5 py-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Queueing…' : 'Generate →'}
          </button>

          {!canGenerate ? (
            <p className="mt-3 text-center text-xs text-text/60">Editor or Admin role required to generate.</p>
          ) : null}
        </section>

        {/* Result pane — lavender */}
        <section className="flex flex-col bg-accentSecondary p-6 text-white lg:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">live preview</p>
              <h2 className="font-display mt-1 text-2xl font-bold lowercase">your result</h2>
            </div>
            {job ? <JobStatusBadge status={job.status} /> : null}
          </div>

          <div className="flex-1">
            <AssetPreview
              asset={generatedAsset}
              job={job}
              emptyMessage="Enter a prompt and hit Generate — your content will show up right here."
            />
          </div>

          {job ? (
            <div className="mt-6 space-y-3 border-t border-white/20 pt-5 text-xs">
              <dl className="grid gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-white/50">Job ID</dt>
                  <dd className="font-mono text-[11px]">{job.task_id.slice(0, 12)}…</dd>
                </div>
                <div>
                  <dt className="text-white/50">Priority</dt>
                  <dd>{job.priority}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Queue</dt>
                  <dd>{job.queue_position ?? (job.status === 'RUNNING' ? 'Running' : '—')}</dd>
                </div>
              </dl>

              {generatedAsset && job.status === 'COMPLETED' ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {targetStation ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/stations/${targetStation.id}`)}
                      className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-accentSecondary transition hover:bg-accent hover:text-text"
                    >
                      Open in {targetStation.name} →
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate('/ai')}
                    className="rounded-xl border border-white/30 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"
                  >
                    View in AI Queue
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
