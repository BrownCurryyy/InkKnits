import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AssetDetail } from './AssetDetail';
import { CozySkeleton } from './UIStates';
import type {
  ActivityRecord,
  AssetRecord,
  AssetVersionRecord,
  AssetLineageRecord,
  UserRecord,
} from '../types';

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

export function AssetWorkspace() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();

  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [versions, setVersions] = useState<AssetVersionRecord[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityRecord[]>([]);
  const [lineage, setLineage] = useState<AssetLineageRecord | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Modals state
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isApprovalModalOpen, setApprovalModalOpen] = useState(false);

  const [editDraft, setEditDraft] = useState({
    title: '',
    description: '',
  });
  const [editMetadataDraft, setEditMetadataDraft] = useState('{}');

  // Approval state
  const [approvalAssignee, setApprovalAssignee] = useState<string>('');
  const [approvalDeadline, setApprovalDeadline] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [orgMembers, setOrgMembers] = useState<UserRecord[]>([]);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const canWrite = roles.some((role) => ['ADMIN', 'EDITOR'].includes(role.toUpperCase()));
  const canRequestApproval = roles.includes('ADMIN');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadAssetDetail = async (id: string) => {
    try {
      const data = await apiFetch<AssetRecord>(`/assets/${id}`);
      setAsset(data);
      setEditDraft({
        title: data.title ?? data.name,
        description: data.description ?? '',
      });
      setEditMetadataDraft(JSON.stringify(data.raw_metadata ?? {}, null, 2));
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load asset workspace'));
    }
  };

  const loadVersions = async (id: string) => {
    try {
      const vers = await apiFetch<AssetVersionRecord[]>(`/versions/${id}`);
      const sorted = [...vers].sort((a, b) => a.version_number - b.version_number);
      setVersions(sorted);
      if (!selectedVersionId && sorted[0]) {
        setSelectedVersionId(sorted[0].id);
      }
    } catch {
      setVersions([]);
    }
  };

  const loadActivities = async (id: string) => {
    try {
      const globalFeed = await apiFetch<ActivityRecord[]>('/activities');
      const assetActivity = globalFeed.filter((item) => item.asset_id === id);
      setActivityFeed(assetActivity);
    } catch {
      setActivityFeed([]);
    }
  };

  const loadLineage = async (id: string) => {
    try {
      setLineage(await apiFetch<AssetLineageRecord>(`/assets/${id}/lineage`));
    } catch {
      setLineage(null);
    }
  };

  useEffect(() => {
    if (!assetId) return;

    const loadAll = async () => {
      setLoading(true);
      setError('');
      await loadAssetDetail(assetId);
      await loadVersions(assetId);
      await loadActivities(assetId);
      await loadLineage(assetId);
      setLoading(false);
    };

    void loadAll();
  }, [assetId]);

  const restoreVersion = async (version: AssetVersionRecord) => {
    if (!assetId) return;
    const confirmed = window.confirm(
      `Restore version ${version.version_number}? This will overwrite the current asset state.`,
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/versions/${assetId}/restore`, {
        method: 'POST',
        body: { version_id: version.id },
      });
      await loadAssetDetail(assetId);
      await loadVersions(assetId);
      showToast(`Version ${version.version_number} restored.`);
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to restore version.'));
    }
  };

  const submitAssetEdit = async () => {
    if (!assetId || !asset) return;

    try {
      await apiFetch(`/assets/${assetId}/properties`, {
        method: 'PATCH',
        body: { title: editDraft.title, description: editDraft.description },
      });

      setEditModalOpen(false);
      await loadAssetDetail(assetId);
      await loadVersions(assetId);
      showToast('Asset updated. Snapshot version created.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to update asset.'));
    }
  };

  const deleteAsset = async (id: string) => {
    const confirmed = window.confirm('Delete this asset? It will be soft-deleted.');
    if (!confirmed) return;

    try {
      await apiFetch(`/assets/${id}`, { method: 'DELETE' });
      showToast('Asset soft-deleted.');
      if (asset?.station_id) {
        navigate(`/stations/${asset.station_id}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      showToast(getPermissionMessage(err, "You don't have permission for this."));
    }
  };

  const openApprovalModal = async () => {
    if (!asset) return;
    setApprovalAssignee('');
    setApprovalDeadline('');
    setApprovalComment('');

    try {
      const members = await apiFetch<UserRecord[]>(`/organizations/${asset.organization_id}/members`);
      setOrgMembers(members);
    } catch {
      showToast('Unable to load organization members.');
    }

    setApprovalModalOpen(true);
  };

  const submitApprovalRequest = async () => {
    if (!asset || !approvalAssignee) {
      showToast('Please select an assignee.');
      return;
    }

    setIsSubmittingApproval(true);
    try {
      await apiFetch('/approvals/tasks', {
        method: 'POST',
        body: {
          asset_id: asset.id,
          assigned_to: approvalAssignee,
          deadline: approvalDeadline || null,
          comments: approvalComment || null,
        },
      });
      setApprovalModalOpen(false);
      showToast('Approval request sent.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to create approval request.'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  if (loading) {
    return <CozySkeleton rows={5} />;
  }

  if (error || !asset) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← Back to Home
        </button>
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          ⚠️ {error || 'Asset not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Asset Workspace Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/stations/${asset.station_id}`)}
          className="rounded-2xl bg-white/80 px-4 py-2 text-xs font-bold text-text shadow-sm transition hover:bg-white dark:bg-[#3a2d2d] dark:text-textDark"
        >
          ← Back to Station
        </button>
      </div>

      {/* Embedded Asset Detail Component */}
      <AssetDetail
        asset={asset}
        versions={versions}
        activityFeed={activityFeed}
        lineage={lineage}
        onOpenAsset={(id) => navigate(`/assets/${id}`)}
        selectedVersionId={selectedVersionId}
        canWrite={canWrite}
        canRequestApproval={canRequestApproval}
        onClose={() => navigate(`/stations/${asset.station_id}`)}
        onOpenEditModal={() => setEditModalOpen(true)}
        onOpenApprovalModal={() => void openApprovalModal()}
        onDeleteAsset={(id) => void deleteAsset(id)}
        onSelectVersion={setSelectedVersionId}
        onRestoreVersion={(version) => void restoreVersion(version)}
        onRefreshAsset={loadAssetDetail}
        onRefreshVersions={loadVersions}
        onShowToast={showToast}
      />

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#423838] px-5 py-3.5 text-sm font-medium text-[#FFF2C2] shadow-cozy border border-accent/20">
          {toast}
        </div>
      ) : null}

      {/* Edit Modal */}
      {isEditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Edit Asset Properties</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-sm font-semibold text-text/70 dark:text-textDark/70"
              >
                ✕ Close
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAssetEdit();
              }}
            >
              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Title</span>
                <input
                  value={editDraft.title}
                  onChange={(e) => setEditDraft((c) => ({ ...c, title: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>
              <label className="block text-xs font-bold"><span className="mb-1.5 block">Description</span><textarea value={editDraft.description} onChange={(e) => setEditDraft((c) => ({ ...c, description: e.target.value }))} rows={4} className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]" /></label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-backgroundDark shadow-sm"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Approval Modal */}
      {isApprovalModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Request Approval</h3>
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                className="text-sm font-semibold text-text/70 dark:text-textDark/70"
              >
                ✕ Close
              </button>
            </div>

            <p className="mb-4 text-xs font-semibold text-text/70 dark:text-textDark/70">
              Asset: <span className="text-accent">{asset.name}</span>
            </p>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitApprovalRequest();
              }}
            >
              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Assign to</span>
                <select
                  value={approvalAssignee}
                  onChange={(e) => setApprovalAssignee(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  required
                >
                  <option value="">Select a team member…</option>
                  {orgMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name} ({member.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Deadline (optional)</span>
                <input
                  type="datetime-local"
                  value={approvalDeadline}
                  onChange={(e) => setApprovalDeadline(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Comment (optional)</span>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={3}
                  placeholder="Add any notes or context for the reviewer…"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApproval}
                  className="rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-backgroundDark shadow-sm disabled:opacity-50"
                >
                  {isSubmittingApproval ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
