import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { ActivityRecord } from '../types';

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

const activityBadgeStyles: Record<string, string> = {
  ASSET_CREATED: 'bg-statusSuccess/20 text-statusSuccess border-statusSuccess/30',
  ASSET_UPDATED: 'bg-accent/20 text-accent border-accent/30',
  ASSET_OPENED: 'bg-background text-text/80 border-black/10 dark:bg-[#554949] dark:text-textDark',
  IMAGE_GENERATED: 'bg-statusSuccess/20 text-statusSuccess border-statusSuccess/30',
  AI_GENERATED: 'bg-accent/20 text-accent border-accent/30',
  ARCHIVE: 'bg-statusError/20 text-statusError border-statusError/30',
};

export function ActivityPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch<ActivityRecord[]>('/activities');
      setActivities(data);
    } catch {
      setError('Unable to load production activities feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  if (loading) {
    return <CozySkeleton rows={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                WORKFLOW
              </span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                Global Stream
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-text dark:text-textDark">
              Production Activity Log
            </h2>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">
              Audit trail of organization events, asset updates, and AI generation tasks
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadActivities()}
            className="rounded-2xl bg-background px-4 py-2 text-xs font-bold text-text transition hover:bg-black/5 dark:bg-[#554949] dark:text-textDark"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          ⚠️ {error}
        </div>
      ) : null}

      {/* Activity List */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        {activities.length === 0 ? (
          <CozyEmptyState
            icon="📜"
            title="No activity recorded yet"
            message="Production activities, asset creation, and AI job runs will be logged here automatically."
          />
        ) : (
          <div className="space-y-3">
            {activities.map((item) => {
              const style = activityBadgeStyles[item.activity_type] || activityBadgeStyles.ASSET_OPENED;

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm transition hover:border-accent/30 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-[#2d2222]"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 rounded-xl border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style}`}>
                      {item.activity_type}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text dark:text-textDark">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-xs text-text/60 dark:text-textDark/60">
                        Activity ID: <span className="font-mono">{item.id.slice(0, 8)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-xs text-text/60 dark:text-textDark/60">
                      {formatDate(item.created_at)}
                    </span>
                    {item.asset_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${item.asset_id}`)}
                        className="rounded-xl bg-accent/15 px-3 py-1 text-xs font-bold text-accent transition hover:bg-accent/25"
                      >
                        View Asset →
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
