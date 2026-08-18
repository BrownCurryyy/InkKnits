import { useEffect, useMemo, useState } from 'react';

import { API_BASE_URL, apiFetch, getAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type {
  ActivityRecord,
  AssetRecord,
  AssetVersionRecord,
  OrganizationRecord,
  ProjectRecord,
  StationDashboardRecord,
  StationRecord,
  UserRecord,
} from '../types';

const assetTypeStyles: Record<string, string> = {
  IMAGE: 'bg-statusSuccess/30 text-statusSuccess',
  TEXT: 'bg-accent/20 text-accent',
  GENERIC: 'bg-statusPending/30 text-statusPending',
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
    if (message.includes('403') || message.includes('forbidden') || message.includes('permission') || message.includes('requires')) {
      return "You don't have permission for this.";
    }
    return error.message;
  }
  return fallback;
}

export function Dashboard() {
  const { user, roles } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [stationMetrics, setStationMetrics] = useState<Record<string, number>>({});
  const [assetVersions, setAssetVersions] = useState<AssetVersionRecord[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityRecord[]>([]);
  const [detailTab, setDetailTab] = useState<'metadata' | 'versions' | 'activity'>('metadata');
  const [assetViewMode, setAssetViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isApprovalModalOpen, setApprovalModalOpen] = useState(false);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createDraft, setCreateDraft] = useState({ name: '', title: '', content: '', asset_type: 'TEXT' as 'TEXT' | 'IMAGE' | 'GENERIC' });
  const [editDraft, setEditDraft] = useState({ name: '', title: '', content: '', asset_type: 'TEXT' as 'TEXT' | 'IMAGE' | 'GENERIC' });
  const [editMetadataDraft, setEditMetadataDraft] = useState('{}');
  const [approvalAssignee, setApprovalAssignee] = useState<string>('');
  const [approvalDeadline, setApprovalDeadline] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [orgMembers, setOrgMembers] = useState<UserRecord[]>([]);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const canWrite = roles.some((role) => ['ADMIN', 'EDITOR'].includes(role.toUpperCase()));

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const loadAssets = async () => {
    if (!selectedStationId) {
      setAssets([]);
      return;
    }

    try {
      const allAssets = await apiFetch<AssetRecord[]>('/assets');
      const stationAssets = allAssets.filter((asset) => asset.station_id === selectedStationId);
      setAssets(stationAssets);
      if (!stationAssets.some((asset) => asset.id === selectedAssetId)) {
        setSelectedAssetId(stationAssets[0]?.id ?? '');
      }
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load assets'));
    }
  };

  const loadVersions = async (assetId: string) => {
    if (!assetId) return;
    try {
      const versions = await apiFetch<AssetVersionRecord[]>(`/versions/${assetId}`);
      const sorted = [...versions].sort((a, b) => a.version_number - b.version_number);
      setAssetVersions(sorted);
      if (!selectedVersionId && sorted[0]) {
        setSelectedVersionId(sorted[0].id);
      }
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load versions'));
    }
  };

  const loadDetail = async (assetId: string) => {
    if (!assetId) {
      setSelectedAsset(null);
      return;
    }

    try {
      const asset = await apiFetch<AssetRecord>(`/assets/${assetId}`);
      setSelectedAsset(asset);
      setEditDraft({
        name: asset.name,
        title: asset.title ?? asset.name,
        content: asset.content ?? '',
        asset_type: (asset.asset_type || 'TEXT').toUpperCase() as 'TEXT' | 'IMAGE' | 'GENERIC',
      });
      setEditMetadataDraft(JSON.stringify(asset.raw_metadata ?? {}, null, 2));
    } catch (err) {
      setError(getPermissionMessage(err, 'Unable to load asset detail'));
    }
  };

  const restoreVersion = async (version: AssetVersionRecord) => {
    if (!selectedAssetId) return;
    const confirmed = window.confirm(`Restore version ${version.version_number}? This will overwrite the current asset state.`);
    if (!confirmed) return;

    try {
      await apiFetch(`/versions/${selectedAssetId}/restore`, {
        method: 'POST',
        body: { version_id: version.id },
      });
      await loadDetail(selectedAssetId);
      await loadVersions(selectedAssetId);
      showToast(`Version ${version.version_number} restored.`);
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to restore version.'));
    }
  };

  const submitCreateAsset = async () => {
    if (!selectedStationId || !user) return;
    try {
      await apiFetch('/assets', {
        method: 'POST',
        body: {
          organization_id: selectedOrgId || user.organization_id,
          station_id: selectedStationId,
          owner_id: user.id,
          name: createDraft.name,
          title: createDraft.title || createDraft.name,
          content: createDraft.content,
          asset_type: createDraft.asset_type,
        },
      });
      setCreateModalOpen(false);
      setCreateDraft({ name: '', title: '', content: '', asset_type: 'TEXT' });
      await loadAssets();
      showToast('Asset created.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to create asset.'));
    }
  };

  const uploadFile = async (file: File) => {
    if (!selectedStationId || !user) return;
    const form = new FormData();
    form.append('organization_id', selectedOrgId || user.organization_id);
    form.append('station_id', selectedStationId);
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
        await loadAssets();
        showToast('Asset uploaded.');
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
    if (!selectedAssetId || !selectedAsset) return;

    try {
      await apiFetch(`/assets/${selectedAssetId}`, {
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
          await apiFetch(`/assets/${selectedAssetId}/metadata`, {
            method: 'PATCH',
            body: { raw_metadata: parsedMetadata },
          });
        } catch {
          showToast('Content updated, but metadata JSON was invalid.');
          return;
        }
      }

      setEditModalOpen(false);
      await loadDetail(selectedAssetId);
      await loadVersions(selectedAssetId);
      await loadAssets();
      showToast('Asset updated. A new version entry was created.');
    } catch (err) {
      showToast(getPermissionMessage(err, 'Unable to update asset.'));
    }
  };

  const deleteAsset = async (assetId: string) => {
    const confirmed = window.confirm('Delete this asset? It will be soft-deleted and disappear from the library.');
    if (!confirmed) return;

    try {
      await apiFetch(`/assets/${assetId}`, { method: 'DELETE' });
      setSelectedAssetId('');
      setSelectedAsset(null);
      await loadAssets();
      showToast('Asset deleted.');
    } catch (err) {
      showToast(getPermissionMessage(err, "You don't have permission for this."));
    }
  };

  const openApprovalModal = async () => {
    if (!selectedOrgId || !selectedAsset) return;
    setApprovalAssignee('');
    setApprovalDeadline('');
    setApprovalComment('');

    // Load org members for assignee picker
    try {
      const members = await apiFetch<UserRecord[]>(`/organizations/${selectedOrgId}/members`);
      setOrgMembers(members);
    } catch (err) {
      showToast('Unable to load organization members.');
    }

    setApprovalModalOpen(true);
  };

  const submitApprovalRequest = async () => {
    if (!selectedAsset || !approvalAssignee) {
      showToast('Please select an assignee.');
      return;
    }

    setIsSubmittingApproval(true);
    try {
      await apiFetch('/approvals/tasks', {
        method: 'POST',
        body: {
          asset_id: selectedAsset.id,
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

  useEffect(() => {
    if (!user) return;

    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const orgs = await apiFetch<OrganizationRecord[]>('/organizations');
        setOrganizations(orgs);

        const preferredOrg = user.organization_id || orgs[0]?.id || '';
        const orgToUse = orgs.length === 1 ? orgs[0].id : preferredOrg;
        setSelectedOrgId(orgToUse);
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load organization list'));
      } finally {
        setLoading(false);
      }
    };

    void loadOrganizations();
  }, [user]);

  useEffect(() => {
    if (!selectedOrgId) return;

    const loadProjects = async () => {
      try {
        const allProjects = await apiFetch<ProjectRecord[]>('/projects');
        const orgProjects = allProjects.filter((project) => project.organization_id === selectedOrgId);
        setProjects(orgProjects);

        if (orgProjects.length === 1) {
          setSelectedProjectId(orgProjects[0].id);
          return;
        }

        if (!orgProjects.some((project) => project.id === selectedProjectId)) {
          setSelectedProjectId(orgProjects[0]?.id ?? '');
        }
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load projects'));
      }
    };

    void loadProjects();
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedProjectId) return;

    const loadStations = async () => {
      try {
        const allStations = await apiFetch<StationRecord[]>('/stations');
        const projectStations = allStations.filter((station) => station.project_id === selectedProjectId);
        setStations(projectStations);

        if (projectStations.length === 1) {
          setSelectedStationId(projectStations[0].id);
          return;
        }

        if (!projectStations.some((station) => station.id === selectedStationId)) {
          setSelectedStationId(projectStations[0]?.id ?? '');
        }
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load stations'));
      }
    };

    void loadStations();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!stations.length) {
      setStationMetrics({});
      return;
    }

    const loadMetrics = async () => {
      try {
        const results = await Promise.all(
          stations.map(async (station) => {
            const dashboard = await apiFetch<StationDashboardRecord>(`/stations/${station.id}/dashboard`);
            return [station.id, dashboard.metrics.total_assets] as const;
          }),
        );

        setStationMetrics(Object.fromEntries(results));
      } catch (err) {
        setError(getPermissionMessage(err, 'Unable to load station metrics'));
      }
    };

    void loadMetrics();
  }, [stations]);

  useEffect(() => {
    void loadAssets();
  }, [selectedStationId]);

  useEffect(() => {
    void loadDetail(selectedAssetId);
  }, [selectedAssetId]);

  useEffect(() => {
    void loadVersions(selectedAssetId);
  }, [selectedAssetId]);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const globalFeed = await apiFetch<ActivityRecord[]>('/activities');
        if (!selectedAssetId) {
          setActivityFeed(globalFeed.slice(0, 8));
          return;
        }
        const assetActivity = globalFeed.filter((item) => item.asset_id === selectedAssetId);
        setActivityFeed(assetActivity.length ? assetActivity : globalFeed.filter((item) => item.asset_id === selectedAssetId || !item.asset_id).slice(0, 8));
      } catch {
        setActivityFeed([]);
      }
    };

    void loadActivity();
  }, [selectedAssetId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? null,
    [stations, selectedStationId],
  );

  const selectedVersion = useMemo(
    () => assetVersions.find((version) => version.id === selectedVersionId) ?? assetVersions[0] ?? null,
    [assetVersions, selectedVersionId],
  );

  if (loading) {
    return (
      <CozySkeleton rows={5} />
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text/60 dark:text-textDark/60">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">Station Board</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {organizations.length > 1 ? (
              <select
                value={selectedOrgId}
                onChange={(event) => setSelectedOrgId(event.target.value)}
                className="rounded-xl border border-black/5 bg-background px-3 py-2 text-sm text-text outline-none dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : null}

            {projects.length > 1 ? (
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="rounded-xl border border-black/5 bg-background px-3 py-2 text-sm text-text outline-none dark:border-white/10 dark:bg-[#554949] dark:text-textDark"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Stations</h3>
          {selectedProject ? <span className="text-sm text-text/60 dark:text-textDark/60">{selectedProject.title}</span> : null}
        </div>

        {stations.length === 0 ? <CozyEmptyState icon="⌂" title="Your studio is waiting" message="Create a project and station to give your first assets a cozy home." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stations.map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => setSelectedStationId(station.id)}
              className={`rounded-cozy border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-cozy ${
                selectedStationId === station.id
                  ? 'border-accent bg-accent/10 shadow-cozy'
                  : 'border-transparent bg-background/40 hover:bg-background/70 dark:bg-[#4f3d3d]/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-sm font-medium text-accent">
                    {station.icon ?? 'S'}
                  </div>
                  <h4 className="text-lg font-semibold">{station.name}</h4>
                </div>
                <span className="rounded-full bg-statusPending/30 px-2 py-1 text-xs font-medium text-statusPending">
                  {stationMetrics[station.id] ?? 0} assets
                </span>
              </div>
              <p className="mt-3 text-sm text-text/70 dark:text-textDark/70">{station.description || 'Station overview'}</p>
            </button>
          ))}
        </div>}
      </div>

      {selectedStation ? (
        <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text/60 dark:text-textDark/60">Asset Library</p>
              <h3 className="mt-2 text-xl font-semibold">{selectedStation.name}</h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-xl bg-background p-1 dark:bg-[#554949]">
                {(['grid', 'list'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAssetViewMode(mode)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide transition ${
                      assetViewMode === mode ? 'bg-accent text-backgroundDark' : 'text-text/70 dark:text-textDark/70'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {canWrite ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCreateModalOpen(true)} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-backgroundDark">Create asset</button>
                  <button type="button" onClick={() => setUploadModalOpen(true)} className="rounded-xl bg-statusSuccess/30 px-4 py-2 text-sm font-medium text-text dark:text-textDark">Upload asset</button>
                </div>
              ) : null}
            </div>
          </div>

          {assets.length === 0 ? (
            <CozyEmptyState icon="✎" title="A blank canvas, how exciting" message="This station has no assets yet. Add a draft, upload an image, or let the AI lend a hand." />
          ) : (
            <div className={assetViewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
              {assets.map((asset) => {
                const status = (asset.raw_metadata && typeof asset.raw_metadata.status === 'string' ? asset.raw_metadata.status : 'READY') as string;
                const type = (asset.asset_type || 'GENERIC').toUpperCase();

                return (
                  <div key={asset.id} className={`rounded-cozy border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-cozy ${selectedAssetId === asset.id ? 'border-accent bg-accent/10' : 'border-transparent bg-background/50 dark:bg-[#4f3d3d]/60'}`}>
                    <button type="button" onClick={() => setSelectedAssetId(asset.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${assetTypeStyles[type] || assetTypeStyles.GENERIC}`}>
                            {type === 'IMAGE' ? 'IMG' : type === 'TEXT' ? 'TXT' : 'DOC'}
                          </div>
                          <div>
                            <h4 className="font-semibold">{asset.title || asset.name}</h4>
                            <p className="text-xs text-text/60 dark:text-textDark/60">{asset.name}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-statusSuccess/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-statusSuccess">
                          {status}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-text/60 dark:text-textDark/60">
                        <span>{type}</span>
                        <span>{formatDate(asset.updated_at || asset.created_at)}</span>
                      </div>
                    </button>

                    {canWrite ? (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => { setSelectedAssetId(asset.id); setEditModalOpen(true); }} className="rounded-lg bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text dark:bg-[#554949] dark:text-textDark">Edit</button>
                        <button type="button" onClick={() => void deleteAsset(asset.id)} className="rounded-lg bg-statusError/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text dark:text-textDark">Delete</button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {selectedAsset ? (
        <div className="rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text/60 dark:text-textDark/60">Asset Detail</p>
              <h3 className="mt-2 text-2xl font-semibold">{selectedAsset.title || selectedAsset.name}</h3>
            </div>
            <div className="flex gap-2">
              {canWrite ? (
                <>
                  <button type="button" onClick={() => setEditModalOpen(true)} className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-backgroundDark">Edit</button>
                  <button type="button" onClick={() => void openApprovalModal()} className="rounded-xl bg-[#d4a373] px-3 py-2 text-sm font-medium text-backgroundDark">Request Approval</button>
                  <button type="button" onClick={() => void deleteAsset(selectedAsset.id)} className="rounded-xl bg-statusError/30 px-3 py-2 text-sm font-medium text-text dark:text-textDark">Delete</button>
                </>
              ) : null}
              <button type="button" onClick={() => setSelectedAssetId('')} className="rounded-xl bg-background px-3 py-2 text-sm font-medium text-text dark:bg-[#554949] dark:text-textDark">Close</button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="rounded-cozy bg-background/50 p-5 dark:bg-[#4f3d3d]/60">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                  {selectedAsset.asset_type}
                </span>
                <span className="text-xs text-text/60 dark:text-textDark/60">Updated {formatDate(selectedAsset.updated_at || selectedAsset.created_at)}</span>
              </div>

              <div className="rounded-xl bg-white/70 p-4 text-sm leading-7 text-text dark:bg-[#2d2222] dark:text-textDark">
                {selectedAsset.content ? (
                  <pre className="whitespace-pre-wrap font-sans">{selectedAsset.content}</pre>
                ) : (
                  <div>
                    <p className="font-medium">No text content available.</p>
                    <p className="mt-2 text-text/60 dark:text-textDark/60">This asset is stored from the connected source but does not expose inline content in the API payload.</p>
                  </div>
                )}
              </div>
            </div>

            <aside className="rounded-cozy bg-background/50 p-4 dark:bg-[#4f3d3d]/60">
              <div className="mb-4 flex gap-2 rounded-xl bg-white/60 p-1 dark:bg-[#2d2222]">
                {(['metadata', 'versions', 'activity'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                      detailTab === tab ? 'bg-accent text-backgroundDark' : 'text-text/70 dark:text-textDark/70'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {detailTab === 'metadata' ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-text/60 dark:text-textDark/60">Name</p>
                    <p className="font-medium">{selectedAsset.name}</p>
                  </div>
                  <div>
                    <p className="text-text/60 dark:text-textDark/60">Type</p>
                    <p className="font-medium">{selectedAsset.asset_type}</p>
                  </div>
                  <div>
                    <p className="text-text/60 dark:text-textDark/60">Storage path</p>
                    <p className="break-all font-medium">{selectedAsset.storage_path || '—'}</p>
                  </div>
                  <div>
                    <p className="text-text/60 dark:text-textDark/60">Metadata</p>
                    <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-white/60 p-2 text-xs dark:bg-[#2d2222]">
                      {JSON.stringify(selectedAsset.raw_metadata ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}

              {detailTab === 'versions' ? (
                <div className="space-y-4">
                  {assetVersions.length === 0 ? (
                    <p className="text-sm text-text/70 dark:text-textDark/70">No versions available yet.</p>
                  ) : (
                    <div className="relative pl-5">
                      <div className="absolute left-[7px] top-0 h-full w-px bg-accent/50" />
                      {assetVersions.map((version) => (
                        <div key={version.id} className="relative mb-4 rounded-xl border border-transparent bg-white/60 p-3 dark:bg-[#2d2222]">
                          <button
                            type="button"
                            onClick={() => setSelectedVersionId(version.id)}
                            className={`relative block w-full text-left ${
                              selectedVersionId === version.id ? 'text-accent' : 'text-text dark:text-textDark'
                            }`}
                          >
                            <span className="absolute -left-[18px] top-4 h-3 w-3 rounded-full bg-accent" />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">v{version.version_number}</span>
                              <span className="text-[10px] uppercase tracking-wide text-text/60 dark:text-textDark/60">{formatDate(version.created_at)}</span>
                            </div>
                            <p className="mt-2 text-xs text-text/70 dark:text-textDark/70">Created by: {version.created_by ?? 'system'}</p>
                          </button>
                          {version.id !== selectedVersion?.id && canWrite ? (
                            <button
                              type="button"
                              onClick={() => void restoreVersion(version)}
                              className="mt-3 rounded-lg bg-statusEscalated/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-statusEscalated"
                            >
                              Restore this version
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedVersion ? (
                    <div className="mt-4 rounded-xl bg-white/60 p-3 dark:bg-[#2d2222]">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold">Preview · v{selectedVersion.version_number}</span>
                        <span className="text-[10px] uppercase tracking-wide text-text/60 dark:text-textDark/60">{formatDate(selectedVersion.created_at)}</span>
                      </div>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-6 text-text dark:text-textDark">
                        {JSON.stringify(selectedVersion.raw_metadata ?? { snapshot_path: selectedVersion.snapshot_path }, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {detailTab === 'activity' ? (
                <div className="space-y-3">
                  {activityFeed.length === 0 ? (
                    <p className="text-sm text-text/70 dark:text-textDark/70">No recent activity.</p>
                  ) : (
                    activityFeed.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-xl bg-white/60 p-3 dark:bg-[#2d2222]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-accent">{item.activity_type}</span>
                          <span className="text-[10px] text-text/60 dark:text-textDark/60">{formatDate(item.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm">{item.description}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#423838] px-4 py-3 text-sm text-[#FFF2C2] shadow-cozy">
          {toast}
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-xl rounded-cozy bg-background p-5 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Create asset</h3>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="text-sm text-text/70 dark:text-textDark/70">Close</button>
            </div>

            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitCreateAsset(); }}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block">Name</span>
                  <input value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]" required />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block">Asset type</span>
                  <select value={createDraft.asset_type} onChange={(event) => setCreateDraft((current) => ({ ...current, asset_type: event.target.value as 'TEXT' | 'IMAGE' | 'GENERIC' }))} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]">
                    <option value="TEXT">TEXT</option>
                    <option value="IMAGE">IMAGE</option>
                    <option value="GENERIC">GENERIC</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-2 block">Title</span>
                <input value={createDraft.title} onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]" />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block">Content</span>
                <textarea value={createDraft.content} onChange={(event) => setCreateDraft((current) => ({ ...current, content: event.target.value }))} rows={8} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]" />
              </label>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-text dark:bg-[#554949] dark:text-textDark">Cancel</button>
                <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-backgroundDark">Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUploadModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-xl rounded-cozy bg-background p-5 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Upload asset</h3>
              <button type="button" onClick={() => setUploadModalOpen(false)} className="text-sm text-text/70 dark:text-textDark/70">Close</button>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setUploadDragActive(true);
              }}
              onDragLeave={() => setUploadDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setUploadDragActive(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  void uploadFile(file);
                }
              }}
              className={`rounded-cozy border-2 border-dashed p-8 text-center transition ${uploadDragActive ? 'border-accent bg-accent/10' : 'border-black/10 bg-white/60 dark:border-white/10 dark:bg-[#4f3d3d]'}`}
            >
              <p className="text-lg font-medium">Drop a file here</p>
              <p className="mt-2 text-sm text-text/70 dark:text-textDark/70">Images are supported for the upload flow.</p>
              <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-accent px-4 py-2 font-medium text-backgroundDark">
                Choose file
                <input type="file" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadFile(file);
                  }
                }} />
              </label>
            </div>

            {uploadProgress > 0 ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-text/70 dark:text-textDark/70">
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isEditModalOpen && selectedAsset ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-2xl rounded-cozy bg-background p-5 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Edit asset</h3>
              <button type="button" onClick={() => setEditModalOpen(false)} className="text-sm text-text/70 dark:text-textDark/70">Close</button>
            </div>

            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitAssetEdit(); }}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block">Name</span>
                  <input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]" required />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block">Asset type</span>
                  <select value={editDraft.asset_type} onChange={(event) => setEditDraft((current) => ({ ...current, asset_type: event.target.value as 'TEXT' | 'IMAGE' | 'GENERIC' }))} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]">
                    <option value="TEXT">TEXT</option>
                    <option value="IMAGE">IMAGE</option>
                    <option value="GENERIC">GENERIC</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-2 block">Title</span>
                <input value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]" />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block">Content</span>
                <textarea value={editDraft.content} onChange={(event) => setEditDraft((current) => ({ ...current, content: event.target.value }))} rows={8} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]" />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block">Metadata JSON (optional)</span>
                <textarea value={editMetadataDraft} onChange={(event) => setEditMetadataDraft(event.target.value)} rows={5} className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 font-mono outline-none dark:border-white/10 dark:bg-[#4f3d3d]" placeholder='{"status":"READY"}' />
              </label>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditModalOpen(false)} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-text dark:bg-[#554949] dark:text-textDark">Cancel</button>
                <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-backgroundDark">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isApprovalModalOpen && selectedAsset ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-xl rounded-cozy bg-background p-5 text-text shadow-cozy dark:bg-[#2d2222] dark:text-textDark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Request Approval</h3>
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                className="text-sm text-text/70 dark:text-textDark/70"
              >
                Close
              </button>
            </div>

            <p className="mb-4 text-sm text-text/70 dark:text-textDark/70">
              Asset: <span className="font-medium">{selectedAsset.name}</span>
            </p>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitApprovalRequest();
              }}
            >
              <label className="block text-sm">
                <span className="mb-2 block">Assign to</span>
                <select
                  value={approvalAssignee}
                  onChange={(event) => setApprovalAssignee(event.target.value)}
                  className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
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

              <label className="block text-sm">
                <span className="mb-2 block">Deadline (optional)</span>
                <input
                  type="datetime-local"
                  value={approvalDeadline}
                  onChange={(event) => setApprovalDeadline(event.target.value)}
                  className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block">Comment (optional)</span>
                <textarea
                  value={approvalComment}
                  onChange={(event) => setApprovalComment(event.target.value)}
                  rows={4}
                  placeholder="Add any notes or context for the reviewer…"
                  className="w-full rounded-xl border border-black/5 bg-white px-3 py-2 outline-none dark:border-white/10 dark:bg-[#4f3d3d]"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-text dark:bg-[#554949] dark:text-textDark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApproval}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-backgroundDark disabled:opacity-50"
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
