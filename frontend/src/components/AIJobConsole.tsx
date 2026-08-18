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
  RUNNING: 'bg-accent/30 text-accent',
  COMPLETED: 'bg-statusSuccess/30 text-statusSuccess',
  FAILED: 'bg-statusError/30 text-statusError',
};

type JobType = 'TEXT' | 'REWRITE' | 'IMPROVE_TONE' | 'CHANGE_AUDIENCE' | 'SUMMARIZE' | 'EXPAND' | 'ATOMIZE' | 'IMAGE';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPermissionMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
      return "You don't have permission for this.";
    }
    return error.message;
  }
  return fallback;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitOpen, setSubmitOpen] = useState(false);
  const [submitPrompt, setSubmitPrompt] = useState('');
  const [submitJobType, setSubmitJobType] = useState<JobType>('TEXT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = roles.some((role) => ['ADMIN', 'EDITOR'].includes(role.toUpperCase()));

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadJobs = async () => {
    // Note: This endpoint doesn't exist in the backend, so we'll need to load individual jobs
    // or modify this to call a list endpoint if it exists. For now, we'll show submitted jobs.
    // In a real app, you'd want a GET /ai/jobs endpoint to list all jobs.
    setLoading(false);
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const job = await apiFetch<AIJobStatusRecord>(`/ai/jobs/${jobId}`);
      setSelectedJob(job);
      setJobs((current) => current.map((item) => (item.task_id === job.task_id ? { ...item, ...job } : item)));
      return job.status;
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to load job status'));
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

    // Set up polling
    const pollInterval = window.setInterval(async () => {
      const status = await pollJobStatus(selectedJobId);
      if (status === 'COMPLETED' || status === 'FAILED') {
        window.clearInterval(pollInterval);
      }
    }, 2000);

    return () => window.clearInterval(pollInterval);
  }, [selectedJobId]);

  const submitJob = async () => {
    if (!user || !submitPrompt.trim()) {
      showToast('Please enter a prompt.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiFetch<AIJobStatusRecord>('/ai/jobs', {
        method: 'POST',
        body: {
          job_type: submitJobType,
          prompt: submitPrompt,
          created_by: user.id,
          organization_id: user.organization_id,
          action: 'generate',
          mood: 'Professional',
          style: 'Narrative',
        },
      });

      // Add to job list and select it
      setJobs((current) => [result, ...current]);
      setSelectedJobId(result.task_id);
      setSubmitOpen(false);
      setSubmitPrompt('');
      showToast('Job submitted.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to submit job.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <CozySkeleton rows={3} />
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-cozy border border-statusError/60 bg-statusError/20 p-3 text-sm text-text dark:text-textDark">
          {error}
        </div>
      ) : null}

      <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">AI Job Console</h2>
            <p className="mt-1 text-sm text-text/60 dark:text-textDark/60">Submit and monitor AI processing jobs</p>
          </div>
          {canSubmit ? (
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="rounded-xl bg-accent px-4 py-2 font-medium text-backgroundDark"
            >
              New job
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
          <h3 className="mb-4 text-lg font-semibold">Job Queue</h3>

          {jobs.length === 0 ? (
            <CozyEmptyState icon="✦" title="The queue is delightfully quiet" message="When you run an AI job, it will appear here with live progress and its finished result." />
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <button
                  key={job.task_id}
                  type="button"
                  onClick={() => setSelectedJobId(job.task_id)}
                  className={`w-full rounded-cozy border p-4 text-left shadow-sm transition ${
                    selectedJobId === job.task_id
                      ? 'border-accent bg-accent/10'
                      : 'border-transparent bg-background/50 dark:bg-[#4f3d3d]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{jobTypeLabels[job.job_type] || job.job_type}</h4>
                      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">
                        {job.prompt ? job.prompt.slice(0, 60) + (job.prompt.length > 60 ? '…' : '') : 'No prompt'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${statusColors[job.status] || statusColors.QUEUED} ${job.status === 'RUNNING' ? 'animate-pulse shadow-[0_0_14px_rgba(180,151,231,.55)]' : ''}`}>
                      {job.status}
                    </span>
                  </div>
                  {job.queue_position !== null && job.status === 'QUEUED' ? (
                    <p className="mt-2 text-xs text-text/60 dark:text-textDark/60">Position: #{job.queue_position}</p>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedJob ? (
          <aside className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Job Detail</h3>
                <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{selectedJob.task_id.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobId('')}
                className="text-sm text-text/70 dark:text-textDark/70"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">Job Type</p>
                <p className="mt-1 text-sm font-medium">{jobTypeLabels[selectedJob.job_type] || selectedJob.job_type}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">Status</p>
                <p className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusColors[selectedJob.status] || statusColors.QUEUED}`}>
                  {selectedJob.status}
                </p>
              </div>

              {selectedJob.queue_position !== null && selectedJob.status === 'QUEUED' ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">Queue Position</p>
                  <p className="mt-1 text-sm font-medium">#{selectedJob.queue_position}</p>
                </div>
              ) : null}

              {selectedJob.prompt ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">Prompt</p>
                  <p className="mt-1 max-h-32 overflow-auto rounded-lg bg-background/50 p-2 text-sm dark:bg-[#4f3d3d]">
                    {selectedJob.prompt}
                  </p>
                </div>
              ) : null}

              {selectedJob.status === 'COMPLETED' && selectedJob.result ? (
                <div className="border-t border-black/10 pt-4 dark:border-white/10">
                  <p className="mb-2 text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">Result</p>
                  <div className="max-h-48 overflow-auto rounded-lg bg-background/50 p-3 dark:bg-[#4f3d3d]">
                    {typeof selectedJob.result === 'string' ? (
                      <p className="whitespace-pre-wrap text-sm">{selectedJob.result}</p>
                    ) : typeof selectedJob.result.data === 'string' ? (
                      <img
                        src={`data:image/png;base64,${selectedJob.result.data}`}
                        alt="AI-generated result"
                        className="max-h-80 w-full rounded-lg object-contain"
                      />
                    ) : typeof selectedJob.result.content === 'string' ? (
                      <p className="whitespace-pre-wrap text-sm">{selectedJob.result.content}</p>
                    ) : (
                      <pre className="overflow-auto text-xs">
                        {JSON.stringify(selectedJob.result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedJob.status === 'FAILED' ? (
                <div className="border-t border-statusError/30 bg-statusError/10 p-3 dark:border-statusError/20">
                  <p className="text-sm font-medium text-statusError">Job failed</p>
                  <p className="mt-2 text-xs text-text dark:text-textDark">{friendlyJobError(selectedJob.error)}</p>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {isSubmitOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-xl rounded-cozy bg-background p-5 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">New AI Job</h3>
              <button
                type="button"
                onClick={() => setSubmitOpen(false)}
                className="text-sm text-text/70 dark:text-textDark/70"
              >
                Close
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitJob();
              }}
            >
              <label className="block text-sm">
                <span className="mb-2 block">Job Type</span>
                <select
                  value={submitJobType}
                  onChange={(event) => setSubmitJobType(event.target.value as JobType)}
                  className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                >
                  <option value="TEXT">Text Generation</option>
                  <option value="REWRITE">Rewrite</option>
                  <option value="IMPROVE_TONE">Improve Tone</option>
                  <option value="CHANGE_AUDIENCE">Change Audience</option>
                  <option value="SUMMARIZE">Summarize</option>
                  <option value="EXPAND">Expand</option>
                  <option value="IMAGE">Image Generation</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-2 block">Prompt</span>
                <textarea
                  value={submitPrompt}
                  onChange={(event) => setSubmitPrompt(event.target.value)}
                  rows={8}
                  placeholder="Describe what you want the AI to generate…"
                  className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  required
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSubmitOpen(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-backgroundDark disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#423838] px-4 py-3 text-sm text-[#FFF2C2] shadow-cozy">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
