import { useEffect, useState } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
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

type JobType = 'TEXT' | 'REWRITE' | 'IMPROVE_TONE' | 'CHANGE_AUDIENCE' | 'SUMMARIZE' | 'EXPAND' | 'ATOMIZE' | 'IMAGE';

function friendlyJobError(error?: string | null) {
  if (!error) return 'The job could not be completed. Please try again.';
  if (error.toLowerCase().includes('ollama')) return 'The local text-generation service is unavailable. Start Ollama, then try again.';
  if (error.toLowerCase().includes('comfyui')) return 'The local image-generation service is unavailable. Start ComfyUI, then try again.';
  return 'The job could not be completed. Please check the local AI services and try again.';
}

export function AIJobConsole() {
  const { user, roles } = useAuth();
  const [jobs, setJobs] = useState<AIJobStatusRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<AIJobStatusRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'FAILED'>('ALL');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadJobs = async () => {
    try {
      setError('');
      const loadedJobs = await apiFetch<AIJobStatusRecord[]>('/ai/jobs');
      setJobs(loadedJobs);
      if (!selectedJobId && loadedJobs[0]) {
        setSelectedJobId(loadedJobs[0].task_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI jobs');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    void loadJobs();
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
    <div className="space-y-8">
      {error ? (
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          ⚠️ {error}
        </div>
      ) : null}

      {/* Header */}
      <div className="border-b border-black/10 pb-5 dark:border-white/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                WORKFLOW
              </span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                Global Monitor
              </span>
            </div>
            <h2 className="mt-2 text-3xl font-bold text-text dark:text-textDark">
              AI Queue & Job Monitor
            </h2>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">
              Monitor asynchronous text and image generation tasks across stations
            </p>
          </div>

          <span className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-text/70 dark:bg-[#554949] dark:text-textDark/70">
            Monitoring surface
          </span>
        </div>

        {/* Filter Pills */}
        <div className="mt-4 flex gap-2 border-t border-black/5 pt-4 dark:border-white/5">
          {(['ALL', 'RUNNING', 'QUEUED', 'COMPLETED', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-accent text-backgroundDark'
                  : 'bg-background text-text/70 hover:text-text dark:bg-[#554949] dark:text-textDark/70'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        {/* Job Monitor Queue List */}
        <div className="rounded-2xl border border-black/10 bg-white/65 p-5 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/75">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-base font-bold text-text dark:text-textDark">Queue activity</h3><span className="text-xs text-text/50 dark:text-textDark/50">{filteredJobs.length} visible</span></div>

          {filteredJobs.length === 0 ? (
            <CozyEmptyState
              icon="✦"
              title="The queue is quiet"
              message="Contextual AI jobs triggered from an Asset Workspace will appear here with live progress."
            />
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <button
                  key={job.task_id}
                  type="button"
                  onClick={() => setSelectedJobId(job.task_id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                    selectedJobId === job.task_id
                      ? 'border-accent bg-accent/10 shadow-cozy'
                      : 'border-black/5 bg-background/40 hover:border-accent/40 hover:bg-background/80 dark:border-white/10 dark:bg-[#4f3d3d]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-text dark:text-textDark">
                        {jobTypeLabels[job.job_type] || job.job_type}
                      </h4>
                      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60 line-clamp-1">
                        {job.prompt ? job.prompt : 'No prompt details'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        statusColors[job.status] || statusColors.QUEUED
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  {job.queue_position !== null && job.queue_position !== undefined && job.status === 'QUEUED' ? (
                    <p className="mt-2 text-xs font-semibold text-accent">
                      Queue Position: #{job.queue_position}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-text/50 dark:text-textDark/50">
                    {job.project_id ? `Project ${job.project_id.slice(0, 8)}` : 'No project context'}
                    {job.asset_id ? ` · Asset ${job.asset_id.slice(0, 8)}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Job Detail Sidebar */}
        {selectedJob ? (
          <aside className="rounded-2xl border border-black/10 bg-white/75 p-5 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/80">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-text dark:text-textDark">Task Status Detail</h3>
                <p className="mt-0.5 font-mono text-[10px] text-text/60 dark:text-textDark/60">
                  ID: {selectedJob.task_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobId('')}
                className="text-xs font-bold text-text/70 dark:text-textDark/70"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="font-bold text-text/60 dark:text-textDark/60">Job Type</p>
                <p className="mt-1 font-semibold text-accent">
                  {jobTypeLabels[selectedJob.job_type] || selectedJob.job_type}
                </p>
              </div>

              <div>
                <p className="font-bold text-text/60 dark:text-textDark/60">Status</p>
                <p
                  className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    statusColors[selectedJob.status] || statusColors.QUEUED
                  }`}
                >
                  {selectedJob.status}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-bold text-text/60 dark:text-textDark/60">Priority</p>
                  <p className="mt-1 font-semibold">{selectedJob.priority}</p>
                </div>
                <div>
                  <p className="font-bold text-text/60 dark:text-textDark/60">Result</p>
                  <p className="mt-1 font-semibold">{selectedJob.result_available ? 'Available' : 'Pending'}</p>
                </div>
              </div>

              {selectedJob.prompt ? (
                <div>
                  <p className="font-bold text-text/60 dark:text-textDark/60">Prompt</p>
                  <p className="mt-1 max-h-32 overflow-auto rounded-xl bg-background/50 p-3 text-xs leading-relaxed dark:bg-[#4f3d3d]">
                    {selectedJob.prompt}
                  </p>
                </div>
              ) : null}

              {selectedJob.status === 'COMPLETED' && selectedJob.result ? (
                <div className="border-t border-black/5 pt-3 dark:border-white/5">
                  <p className="mb-2 font-bold text-accent">Result Output</p>
                  <div className="max-h-48 overflow-auto rounded-xl bg-background/50 p-3 dark:bg-[#4f3d3d]">
                    {typeof selectedJob.result === 'string' ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedJob.result}</p>
                    ) : typeof selectedJob.result.data === 'string' ? (
                      <img
                        src={`data:image/png;base64,${selectedJob.result.data}`}
                        alt="AI Result"
                        className="max-h-60 rounded-xl object-contain shadow-cozy"
                      />
                    ) : typeof selectedJob.result.content === 'string' ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedJob.result.content}</p>
                    ) : (
                      <pre className="overflow-auto font-mono text-[10px]">
                        {JSON.stringify(selectedJob.result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedJob.status === 'FAILED' ? (
                <div className="rounded-xl border border-statusError/30 bg-statusError/10 p-3 text-statusError">
                  <p className="font-bold">Job Execution Failed</p>
                  <p className="mt-1 leading-relaxed">{friendlyJobError(selectedJob.error)}</p>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#423838] px-5 py-3.5 text-sm font-medium text-[#FFF2C2] shadow-cozy border border-accent/20">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
