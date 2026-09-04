import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { ApprovalTaskRecord, AssetRecord, UserRecord } from '../types';

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Escalated';

interface ApprovalTaskFull extends ApprovalTaskRecord {
  assignedByUser?: UserRecord;
  assignedToUser?: UserRecord;
  assetTitle?: string;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-statusPending/30 text-statusPending',
  APPROVED: 'bg-statusSuccess/30 text-statusSuccess',
  REJECTED: 'bg-statusError/30 text-statusError',
  ESCALATED: 'bg-statusEscalated/30 text-statusEscalated',
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

export function ApprovalsQueue() {
  const { user, roles } = useAuth();

  const [tasks, setTasks] = useState<ApprovalTaskFull[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<ApprovalTaskFull | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | ApprovalStatus>('All');
  const [showOnlyAssignedToMe, setShowOnlyAssignedToMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const canReview = roles.some((role) => ['ADMIN', 'REVIEWER'].includes(role.toUpperCase()));

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const allTasks = await apiFetch<ApprovalTaskRecord[]>('/approvals/tasks');

      const enriched: ApprovalTaskFull[] = await Promise.all(
        allTasks.map(async (task) => {
          try {
            const asset = await apiFetch<AssetRecord>(`/assets/${task.asset_id}`);
            return { ...task, assetTitle: asset.title || asset.name };
          } catch {
            return { ...task, assetTitle: 'Asset' };
          }
        }),
      );

      setTasks(enriched);
      if (!enriched.some((t) => t.id === selectedTaskId)) {
        setSelectedTaskId('');
        setSelectedTask(null);
      }
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load approval tasks'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const loadTaskDetail = async (taskId: string) => {
    if (!taskId) {
      setSelectedTask(null);
      setCommentDraft('');
      return;
    }

    try {
      const task = await apiFetch<ApprovalTaskRecord>(`/approvals/tasks/${taskId}`);
      try {
        const asset = await apiFetch<AssetRecord>(`/assets/${task.asset_id}`);
        setSelectedTask({ ...task, assetTitle: asset.title || asset.name });
      } catch {
        setSelectedTask({ ...task, assetTitle: 'Asset' });
      }
      setCommentDraft(task.comments || '');
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load task detail'));
    }
  };

  useEffect(() => {
    void loadTaskDetail(selectedTaskId);
  }, [selectedTaskId]);

  const approveTask = async (taskId: string) => {
    try {
      await apiFetch(`/approvals/tasks/${taskId}/approve`, { method: 'POST' });
      await loadTasks();
      await loadTaskDetail(taskId);
      showToast('Task approved.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to approve task.'));
    }
  };

  const rejectTask = async (taskId: string) => {
    try {
      await apiFetch(`/approvals/tasks/${taskId}/reject`, { method: 'POST' });
      await loadTasks();
      await loadTaskDetail(taskId);
      showToast('Task rejected.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to reject task.'));
    }
  };

  const updateComment = async (taskId: string) => {
    try {
      await apiFetch(`/approvals/tasks/${taskId}/comment`, {
        method: 'POST',
        body: { comments: commentDraft },
      });
      await loadTaskDetail(taskId);
      showToast('Comment updated.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to update comment.'));
    }
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (statusFilter !== 'All') {
      result = result.filter((task) => task.status === statusFilter.toUpperCase());
    }

    if (showOnlyAssignedToMe && user) {
      result = result.filter((task) => task.assigned_to === user.id);
    }

    return result;
  }, [tasks, statusFilter, showOnlyAssignedToMe, user]);

  if (loading) {
    return <CozySkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[16px] border border-statusError/60 bg-statusError/20 p-3 text-sm text-text dark:text-textDark">
          {error}
        </div>
      ) : null}

      <header className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Approvals</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">Review queue</h1>
            <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
              Review and manage production assets awaiting approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['All', 'Pending', 'Approved', 'Rejected', 'Escalated'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                  statusFilter === status
                    ? 'bg-accent text-[#fffaf1]'
                    : 'border border-[#D9D6CF] bg-[#F5F3EE] text-text dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <section className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text dark:text-textDark">Tasks</h2>
            <label className="flex items-center gap-2 text-xs font-medium text-text/65 dark:text-textDark/70">
              <input
                type="checkbox"
                checked={showOnlyAssignedToMe}
                onChange={(event) => setShowOnlyAssignedToMe(event.target.checked)}
                className="h-4 w-4 rounded"
              />
              Assigned to me
            </label>
          </div>

          {filteredTasks.length === 0 ? (
            <CozyEmptyState
              icon="•"
              title="No approvals waiting"
              message="The review desk is clear. New approval requests will appear here when they are ready."
            />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full rounded-[16px] border p-4 text-left transition ${
                    selectedTaskId === task.id
                      ? 'border-[#E53935]/40 bg-[#FCE9E8] dark:border-[#E53935]/40 dark:bg-[#1F1717]'
                      : 'border-[#D9D6CF] bg-[#F5F3EE] hover:border-[#E53935]/40 dark:border-[#292929] dark:bg-[#1A1A1A]/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-text dark:text-textDark">{task.assetTitle}</h3>
                      <p className="mt-1 text-[11px] text-text/55 dark:text-textDark/60">Task {task.id.slice(0, 8)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${statusColors[task.status] || statusColors.PENDING}`}>
                      {task.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text/60 dark:text-textDark/60">
                    <span>Created {formatDate(task.created_at)}</span>
                    <span>•</span>
                    <span>Assigned to {task.assigned_to.slice(0, 8)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
          {selectedTask ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">Selected task</p>
                  <h2 className="mt-1 text-xl font-semibold text-text dark:text-textDark">{selectedTask.assetTitle}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${statusColors[selectedTask.status] || statusColors.PENDING}`}>
                  {selectedTask.status}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-sm text-text/70 dark:text-textDark/70">
                <div className="rounded-[14px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 dark:border-[#292929] dark:bg-[#1A1A1A]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">Review notes</p>
                  <p className="mt-2 leading-6">{selectedTask.comments || 'No review comments yet.'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void approveTask(selectedTask.id)}
                    disabled={!canReview}
                    className="flex-1 rounded-xl bg-statusSuccess/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-statusSuccess disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectTask(selectedTask.id)}
                    disabled={!canReview}
                    className="flex-1 rounded-xl bg-statusError/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-statusError disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>

                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">Comments</span>
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-[12px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm text-text focus:border-accent dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void updateComment(selectedTask.id)}
                  className="w-full rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#fffaf1]"
                >
                  Save comment
                </button>
              </div>
            </>
          ) : (
            <CozyEmptyState icon="•" title="No task selected" message="Choose a task from the queue to review and act on it." />
          )}

          {toast ? <div className="mt-4 rounded-xl bg-backgroundDark px-3 py-2 text-[11px] font-medium text-textDark">{toast}</div> : null}
        </aside>
      </div>
    </div>
  );
}
