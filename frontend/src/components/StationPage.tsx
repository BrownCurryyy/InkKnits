import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { API_BASE_URL, apiFetch, getAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AssetLibrary } from './AssetLibrary';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { AssetRecord, StationDashboardRecord, StationRecord } from '../types';

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

export function StationPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();

  const [station, setStation] = useState<StationRecord | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TEXT' | 'IMAGE' | 'GENERIC'>('ALL');
  const [assetViewMode, setAssetViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<AssetRecord | null>(null);

  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Drafts
  const [createDraft, setCreateDraft] = useState({
    name: '',
    title: '',
    content: '',
    asset_type: 'TEXT' as 'TEXT' | 'IMAGE' | 'GENERIC',
  });
  const [editDraft, setEditDraft] = useState({
    name: '',
    title: '',
    content: '',
    asset_type: 'TEXT' as 'TEXT' | 'IMAGE' | 'GENERIC',
  });
  const [editMetadataDraft, setEditMetadataDraft] = useState('{}');

  const canWrite = roles.some((role) => ['ADMIN', 'MANAGER'].includes(role.toUpperCase()));

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadData = async () => {
    if (!stationId) return;
    try {
      setLoading(true);
      setError('');

      // Fetch all stations to find current station details
      const allStations = await apiFetch<StationRecord[]>('/stations');
      const targetStation = allStations.find((s) => s.id === stationId);
      if (!targetStation) {
        setError('Station not found');
        setLoading(false);
        return;
      }
      setStation(targetStation);

      // Fetch assets for station
      const allAssets = await apiFetch<AssetRecord[]>('/assets');
      const stationAssets = allAssets.filter((a) => a.station_id === stationId);
      setAssets(stationAssets);
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load station workspace'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [stationId]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch =
        !searchQuery ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.title && asset.title.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'ALL' || (asset.asset_type || 'GENERIC').toUpperCase() === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [assets, searchQuery, typeFilter]);

  const submitCreateAsset = async () => {
    if (!stationId || !user || !station) return;
    try {
      await apiFetch('/assets', {
        method: 'POST',
        body: {
          organization_id: user.organization_id,
          station_id: stationId,
          owner_id: user.id,
          name: createDraft.name,
          title: createDraft.title || createDraft.name,
          content: createDraft.content,
          asset_type: createDraft.asset_type,
        },
      });
      setCreateModalOpen(false);
      setCreateDraft({ name: '', title: '', content: '', asset_type: 'TEXT' });
      await loadData();
      showToast('Asset created successfully.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to create asset.'));
    }
  };

  const uploadFile = async (file: File) => {
    if (!stationId || !user) return;
    const form = new FormData();
    form.append('organization_id', user.organization_id);
    form.append('station_id', stationId);
    form.append('owner_id', user.id);
    form.append('name', file.name);
    form.append('asset_type', 'IMAGE');
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/assets/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${getAccessToken()}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = async () => {
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadModalOpen(false);
        await loadData();
        showToast('Asset uploaded successfully.');
      } else {
        try {
          const json = JSON.parse(xhr.responseText || '{}') as { detail?: string };
          showToast(getPermissionMessage(new Error(json.detail ?? 'Upload failed'), 'Upload failed.'));
        } catch {
          showToast('Upload failed.');
        }
      }
    };
    xhr.onerror = () => {
      setUploadProgress(0);
      showToast('Upload failed.');
    };
    xhr.send(form);
  };

  const submitAssetEdit = async () => {
    if (!selectedAssetForEdit) return;

    try {
      await apiFetch(`/assets/${selectedAssetForEdit.id}`, {
        method: 'PUT',
        body: {
          name: editDraft.name,
          title: editDraft.title || editDraft.name,
          content: editDraft.content,
          asset_type: editDraft.asset_type,
        },
      });

      if (editMetadataDraft.trim()) {
        try {
          const parsedMetadata = JSON.parse(editMetadataDraft) as Record<string, unknown>;
          await apiFetch(`/assets/${selectedAssetForEdit.id}/metadata`, {
            method: 'PATCH',
            body: { raw_metadata: parsedMetadata },
          });
        } catch {
          showToast('Content updated, but metadata JSON was invalid.');
          return;
        }
      }

      setEditModalOpen(false);
      setSelectedAssetForEdit(null);
      await loadData();
      showToast('Asset updated.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to update asset.'));
    }
  };

  const deleteAsset = async (assetId: string) => {
    const confirmed = window.confirm('Delete this asset? It will be soft-deleted.');
    if (!confirmed) return;

    try {
      await apiFetch(`/assets/${assetId}`, { method: 'DELETE' });
      await loadData();
      showToast('Asset soft-deleted.');
    } catch (err) {
      showToast(getPermissionMessage(err, "You don't have permission for this."));
    }
  };

  if (loading) {
    return <CozySkeleton rows={4} />;
  }

  if (error || !station) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← Back to Dashboard
        </button>
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold text-text dark:text-textDark shadow-cozy">
          ⚠️ {error || 'Station not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Station Header */}
      <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy backdrop-blur-md dark:border-white/10 dark:bg-[#3a2d2d]/90">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-2xl bg-background px-3.5 py-2 text-xs font-bold text-text transition hover:bg-black/5 dark:bg-[#554949] dark:text-textDark"
            >
              ← Dashboard
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-2xl font-bold">
              {station.icon || '✨'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  STATION
                </span>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {assets.length} Assets
                </span>
              </div>
              <h2 className="text-2xl font-bold text-text dark:text-textDark">
                {station.name}
              </h2>
            </div>
          </div>

          <p className="max-w-md text-xs text-text/70 dark:text-textDark/70">
            {station.description || 'Production station for asset creation and management.'}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white/60 p-4 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between dark:border-white/10 dark:bg-[#3a2d2d]/60">
        <div className="flex flex-1 items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets by title or name..."
            className="w-full max-w-sm rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs text-text outline-none focus:border-accent dark:border-white/10 dark:bg-[#4f3d3d] dark:text-textDark"
          />

          <div className="flex gap-1.5">
            {(['ALL', 'TEXT', 'IMAGE', 'GENERIC'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  typeFilter === type
                    ? 'bg-accent text-backgroundDark'
                    : 'bg-background/80 text-text/70 hover:text-text dark:bg-[#554949] dark:text-textDark/70'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canWrite ? (
            <>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark shadow-sm hover:opacity-90 active:scale-95"
              >
                ✏️ Create Asset
              </button>
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="rounded-xl bg-statusSuccess/30 px-4 py-2 text-xs font-bold text-text shadow-sm hover:bg-statusSuccess/40 active:scale-95 dark:text-textDark"
              >
                📤 Upload File
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Asset Library Component */}
      <AssetLibrary
        selectedStation={station}
        assets={filteredAssets}
        selectedAssetId=""
        assetViewMode={assetViewMode}
        canWrite={canWrite}
        onSelectAsset={(id) => navigate(`/assets/${id}`)}
        onChangeViewMode={setAssetViewMode}
        onOpenCreateModal={() => setCreateModalOpen(true)}
        onOpenUploadModal={() => setUploadModalOpen(true)}
        onOpenEditModal={(asset) => {
          setSelectedAssetForEdit(asset);
          setEditDraft({
            name: asset.name,
            title: asset.title ?? asset.name,
            content: asset.content ?? '',
            asset_type: (asset.asset_type || 'TEXT').toUpperCase() as 'TEXT' | 'IMAGE' | 'GENERIC',
          });
          setEditMetadataDraft(JSON.stringify(asset.raw_metadata ?? {}, null, 2));
          setEditModalOpen(true);
        }}
        onDeleteAsset={(id) => void deleteAsset(id)}
      />

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#423838] px-5 py-3.5 text-sm font-medium text-[#FFF2C2] shadow-cozy border border-accent/20">
          {toast}
        </div>
      ) : null}

      {/* Create Modal */}
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Create Asset</h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-sm font-semibold text-text/70 dark:text-textDark/70"
              >
                ✕ Close
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCreateAsset();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-bold">
                  <span className="mb-1.5 block">Name</span>
                  <input
                    value={createDraft.name}
                    onChange={(e) => setCreateDraft((c) => ({ ...c, name: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                    required
                  />
                </label>
                <label className="block text-xs font-bold">
                  <span className="mb-1.5 block">Asset Type</span>
                  <select
                    value={createDraft.asset_type}
                    onChange={(e) =>
                      setCreateDraft((c) => ({
                        ...c,
                        asset_type: e.target.value as 'TEXT' | 'IMAGE' | 'GENERIC',
                      }))
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="IMAGE">IMAGE</option>
                    <option value="GENERIC">GENERIC</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Title</span>
                <input
                  value={createDraft.title}
                  onChange={(e) => setCreateDraft((c) => ({ ...c, title: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Content</span>
                <textarea
                  value={createDraft.content}
                  onChange={(e) => setCreateDraft((c) => ({ ...c, content: e.target.value }))}
                  rows={6}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-backgroundDark shadow-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Upload Modal */}
      {isUploadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Upload Asset File</h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-sm font-semibold text-text/70 dark:text-textDark/70"
              >
                ✕ Close
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setUploadDragActive(true);
              }}
              onDragLeave={() => setUploadDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUploadDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void uploadFile(file);
              }}
              className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${
                uploadDragActive
                  ? 'border-accent bg-accent/10'
                  : 'border-black/10 bg-white/60 dark:border-white/10 dark:bg-[#4f3d3d]'
              }`}
            >
              <p className="text-lg font-bold">Drop a file here</p>
              <p className="mt-2 text-xs text-text/70 dark:text-textDark/70">
                Images are supported for the upload flow.
              </p>
              <label className="mt-4 inline-flex cursor-pointer rounded-2xl bg-accent px-5 py-2.5 text-xs font-bold text-backgroundDark shadow-sm">
                Choose file
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
              </label>
            </div>

            {uploadProgress > 0 ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-text/70 dark:text-textDark/70">
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Edit Modal */}
      {isEditModalOpen && selectedAssetForEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-background p-6 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark border border-black/5 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Edit Asset</h3>
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
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-bold">
                  <span className="mb-1.5 block">Name</span>
                  <input
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((c) => ({ ...c, name: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                    required
                  />
                </label>
                <label className="block text-xs font-bold">
                  <span className="mb-1.5 block">Asset Type</span>
                  <select
                    value={editDraft.asset_type}
                    onChange={(e) =>
                      setEditDraft((c) => ({
                        ...c,
                        asset_type: e.target.value as 'TEXT' | 'IMAGE' | 'GENERIC',
                      }))
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="IMAGE">IMAGE</option>
                    <option value="GENERIC">GENERIC</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Title</span>
                <input
                  value={editDraft.title}
                  onChange={(e) => setEditDraft((c) => ({ ...c, title: e.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Content</span>
                <textarea
                  value={editDraft.content}
                  onChange={(e) => setEditDraft((c) => ({ ...c, content: e.target.value }))}
                  rows={6}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <label className="block text-xs font-bold">
                <span className="mb-1.5 block">Metadata JSON (optional)</span>
                <textarea
                  value={editMetadataDraft}
                  onChange={(e) => setEditMetadataDraft(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-xs outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                  placeholder='{"status":"READY"}'
                />
              </label>

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
    </div>
  );
}
