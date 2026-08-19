import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<ApprovalTaskFull[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<ApprovalTaskFull | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | ApprovalStatus>('All');
  const [showOnlyAssignedToMe, setShowOnlyAssignedToMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const canReview = roles.some((role) => ['ADMIN', 'EDITOR', 'REVIEWER'].includes(role.toUpperCase()));

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

  const escalateTask = async (taskId: string) => {
    try {
      await apiFetch(`/approvals/tasks/${taskId}/escalate`, { method: 'POST' });
      await loadTasks();
      await loadTaskDetail(taskId);
      showToast('Task escalated.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to escalate task.'));
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
        <div className="rounded-cozy border border-statusError/60 bg-statusError/20 p-3 text-sm text-text dark:text-textDark">
          {error}
        </div>
      ) : null}

      <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Approval Tasks</h2>
          <p className="mt-1 text-sm text-text/60 dark:text-textDark/60">
            Review and manage asset approvals across stations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(['All', 'Pending', 'Approved', 'Rejected', 'Escalated'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  statusFilter === status
                    ? 'bg-accent text-backgroundDark'
                    : 'bg-background text-text dark:bg-[#554949] dark:text-textDark'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlyAssignedToMe}
              onChange={(event) => setShowOnlyAssignedToMe(event.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm font-medium">Assigned to me</span>
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
          <h3 className="mb-4 text-lg font-semibold">Tasks</h3>

          {filteredTasks.length === 0 ? (
            <CozyEmptyState
              icon="✓"
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
                  className={`w-full rounded-cozy border p-4 text-left shadow-sm transition ${
                    selectedTaskId === task.id
                      ? 'border-accent bg-accent/10'
                      : 'border-transparent bg-background/50 dark:bg-[#4f3d3d]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{task.assetTitle}</h4>
                      <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">
                        Task {task.id.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                        statusColors[task.status] || statusColors.PENDING
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-text/60 dark:text-textDark/60">
                    <span>Created {formatDate(task.created_at)}</span>
                    {task.deadline ? <span>Due {formatDate(task.deadline)}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedTask ? (
          <aside className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Task Detail</h3>
                <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">
                  {selectedTask.assetTitle}
                </p>
                {selectedTask.asset_id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/assets/${selectedTask.asset_id}`)}
                    className="mt-2.5 inline-flex items-center gap-1 rounded-xl bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent transition hover:bg-accent hover:text-backgroundDark"
                  >
                    Open Asset in Workspace →
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskId('')}
                className="text-sm text-text/70 dark:text-textDark/70"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">
                  Status
                </p>
                <p
                  className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                    statusColors[selectedTask.status] || statusColors.PENDING
                  }`}
                >
                  {selectedTask.status}
                </p>
              </div>

              {selectedTask.deadline ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">
                    Deadline
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatDate(selectedTask.deadline)}</p>
                </div>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">
                  Created
                </p>
                <p className="mt-1 text-sm font-medium">{formatDate(selectedTask.created_at)}</p>
              </div>

              {selectedTask.completed_at ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">
                    Completed
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatDate(selectedTask.completed_at)}</p>
                </div>
              ) : null}

              {canReview ? (
                <div className="border-t border-black/10 pt-4 dark:border-white/10">
                  <label className="block text-sm">
                    <p className="mb-2 text-xs uppercase tracking-wide text-text/60 dark:text-textDark/60">
                      Comments
                    </p>
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void updateComment(selectedTask.id)}
                    className="mt-2 rounded-lg bg-background px-3 py-1 text-sm font-medium text-text dark:bg-[#554949] dark:text-textDark"
                  >
                    Save comment
                  </button>
                </div>
              ) : null}

              {canReview && selectedTask.status === 'PENDING' ? (
                <div className="border-t border-black/10 pt-4 dark:border-white/10">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void approveTask(selectedTask.id)}
                      className="flex-1 rounded-lg bg-statusSuccess/20 px-3 py-2 text-sm font-medium text-statusSuccess"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void rejectTask(selectedTask.id)}
                      className="flex-1 rounded-lg bg-statusError/20 px-3 py-2 text-sm font-medium text-text dark:text-textDark"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void escalateTask(selectedTask.id)}
                      className="flex-1 rounded-lg bg-statusEscalated/20 px-3 py-2 text-sm font-medium text-statusEscalated"
                    >
                      Escalate
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#423838] px-4 py-3 text-sm text-[#FFF2C2] shadow-cozy">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
