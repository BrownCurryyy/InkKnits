import { useEffect, useRef, useState } from 'react';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { AIJobStatusRecord } from '../types';

const jobTypeLabels: Record<string, string> = {
  TEXT: 'Text Generation',
  REWRITE: 'Rewrite',
  IMPROVE_TONE: 'Improve Tone',
  CHANGE_AUDIENCE: 'Change Audience',
  SUMMARIZE: 'Summarize',
  EXPAND: 'Expand',
  ATOMIZE: 'Atomize',
  IMAGE: 'Image Generation',
};

const statusColors: Record<string, string> = {
  QUEUED: 'bg-statusPending/30 text-statusPending',
  RUNNING: 'bg-accent/30 text-accent animate-pulse shadow-sm',
  COMPLETED: 'bg-statusSuccess/30 text-statusSuccess',
  FAILED: 'bg-statusError/30 text-statusError',
};

function friendlyJobError(error?: string | null) {
  if (!error) return 'The job could not be completed. Please try again.';
  if (error.toLowerCase().includes('ollama')) return 'The local text-generation service is unavailable. Start Ollama, then try again.';
  if (error.toLowerCase().includes('comfyui')) return 'The local image-generation service is unavailable. Start ComfyUI, then try again.';
  return 'The job could not be completed. Please check the local AI services and try again.';
}

export function AIJobConsole() {
  const [jobs, setJobs] = useState<AIJobStatusRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<AIJobStatusRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'FAILED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const selectedJobIdRef = useRef('');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadJobs = async (showLoading = false) => {
    try {
      setError('');
      if (showLoading) setLoading(true);
      const loadedJobs = await apiFetch<AIJobStatusRecord[]>('/ai/jobs');
      setJobs(loadedJobs);
      const currentSelectedJobId = selectedJobIdRef.current;
      const selected = loadedJobs.find((job) => job.task_id === currentSelectedJobId);
      if (selected) {
        setSelectedJob((current) => current ? { ...current, ...selected } : selected);
      } else if (!currentSelectedJobId && loadedJobs[0]) {
        setSelectedJobId(loadedJobs[0].task_id);
      } else if (currentSelectedJobId) {
        setSelectedJobId(loadedJobs[0]?.task_id ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI jobs');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  const pollJobStatus = async (jobId: string) => {
    try {
      const job = await apiFetch<AIJobStatusRecord>(`/ai/jobs/${jobId}`);
      setSelectedJob(job);
      setJobs((current) => current.map((item) => (item.task_id === job.task_id ? { ...item, ...job } : item)));
      return job.status;
    } catch {
      return null;
    }
  };

  const suspendJob = async (jobId: string) => {
    try {
      await apiFetch(`/ai/jobs/${jobId}/cancel`, { method: 'POST' });
      await pollJobStatus(jobId);
      setToast('Job suspended.');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Unable to suspend job.');
    }
  };

  useEffect(() => {
    void loadJobs(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => { void loadJobs(); }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      return;
    }

    void pollJobStatus(selectedJobId);

    const pollInterval = window.setInterval(async () => {
      const status = await pollJobStatus(selectedJobId);
      if (status === 'COMPLETED' || status === 'FAILED') {
        window.clearInterval(pollInterval);
      }
    }, 2000);

    return () => window.clearInterval(pollInterval);
  }, [selectedJobId]);

  const filteredJobs = jobs.filter((j) => (statusFilter === 'ALL' ? true : j.status === statusFilter));

  if (loading) {
    return <CozySkeleton rows={3} />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[16px] border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark">
          {error}
        </div>
      ) : null}

      <header className="rounded-[20px] border border-[#eadfb7] bg-[#fffaf1]/90 p-5 shadow-[0_10px_22px_rgba(66,56,56,0.04)] dark:border-white/10 dark:bg-[#352d2d]/90">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">AI workflow</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">AI queue</h1>
            <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
              Central monitoring for generated text, images, and derived creative outputs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'RUNNING', 'QUEUED', 'COMPLETED', 'FAILED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                  statusFilter === st
                    ? 'bg-accent text-[#fffaf1]'
                    : 'border border-[#e7d9c0] bg-[#f7f0df] text-text dark:border-white/10 dark:bg-[#4a3c3c] dark:text-textDark'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <section className="rounded-[20px] border border-[#eadfb7] bg-[#fffaf1]/90 p-5 shadow-[0_10px_22px_rgba(66,56,56,0.04)] dark:border-white/10 dark:bg-[#352d2d]/90">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text dark:text-textDark">Queue activity</h2>
            <span className="text-xs text-text/55 dark:text-textDark/60">{filteredJobs.length} visible</span>
          </div>

          {filteredJobs.length === 0 ? (
            <CozyEmptyState
              icon="•"
              title="The queue is quiet"
              message="Contextual AI jobs triggered from project workspaces will appear here with live status."
            />
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <button
                  key={job.task_id}
                  type="button"
                  onClick={() => setSelectedJobId(job.task_id)}
                  className={`w-full rounded-[16px] border p-4 text-left transition ${
                    selectedJobId === job.task_id
                      ? 'border-[#d7c0f0] bg-[#f3eaff] dark:border-[#ae8de8]/70 dark:bg-[#473a59]'
                      : 'border-[#efe1c0] bg-[#fdf7ea] hover:border-[#d7c0f0] dark:border-white/10 dark:bg-[#483d3d]/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-text dark:text-textDark">{jobTypeLabels[job.job_type] || job.job_type}</h3>
                      <p className="mt-1 text-[11px] text-text/55 dark:text-textDark/60">{job.task_id}</p>
                      <p className="mt-2 text-sm leading-6 text-text/60 dark:text-textDark/70">
                        {job.prompt || 'No prompt details'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${statusColors[job.status] || statusColors.QUEUED}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text/55 dark:text-textDark/60">
                    {job.project_id ? <span>{job.project_id.slice(0, 8)}</span> : null}
                    {job.asset_id ? <span>• {job.asset_id.slice(0, 8)}</span> : null}
                    {job.created_by ? <span>• {job.created_by.slice(0, 8)}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-[20px] border border-[#eadfb7] bg-[#fffaf1]/90 p-5 shadow-[0_10px_22px_rgba(66,56,56,0.04)] dark:border-white/10 dark:bg-[#352d2d]/90">
          {selectedJob ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">Selected job</p>
                  <h2 className="mt-1 text-xl font-semibold text-text dark:text-textDark">{jobTypeLabels[selectedJob.job_type] || selectedJob.job_type}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${statusColors[selectedJob.status] || statusColors.QUEUED}`}>
                  {selectedJob.status}
                </span>
              </div>

              <dl className="mt-4 space-y-3 text-sm text-text/70 dark:text-textDark/70">
                <div className="rounded-[14px] border border-[#efe1c0] bg-[#fdf7ea] px-3 py-2 dark:border-white/10 dark:bg-[#483d3d]">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">Job ID</dt>
                  <dd className="mt-1 font-mono text-xs">{selectedJob.task_id}</dd>
                </div>
                <div className="rounded-[14px] border border-[#efe1c0] bg-[#fdf7ea] px-3 py-2 dark:border-white/10 dark:bg-[#483d3d]">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">Status</dt>
                  <dd className="mt-1 font-medium">{selectedJob.status}</dd>
                </div>
                {selectedJob.error ? (
                  <div className="rounded-[14px] border border-statusError/40 bg-statusError/10 px-3 py-2 text-sm text-statusError">
                    {friendlyJobError(selectedJob.error)}
                  </div>
                ) : null}
              </dl>

              <button
                type="button"
                onClick={() => void suspendJob(selectedJob.task_id)}
                className="mt-4 w-full rounded-xl border border-statusError/30 bg-statusError/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-statusError"
              >
                Suspend job
              </button>
            </>
          ) : (
            <CozyEmptyState icon="•" title="No job selected" message="Select a job from the queue to inspect its status and output." />
          )}

          {toast ? <div className="mt-4 rounded-xl bg-backgroundDark px-3 py-2 text-[11px] font-medium text-textDark">{toast}</div> : null}
        </aside>
      </div>
    </div>
  );
}
