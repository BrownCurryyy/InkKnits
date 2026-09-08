import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../api/client';
import { CozyEmptyState, CozySkeleton } from './UIStates';
import type { AssetLinkRecord, AssetRecord, AssetVersionRecord, ProjectRecord } from '../types';

interface ProductionAsset {
  asset: AssetRecord;
  current_version: AssetVersionRecord;
  is_active: boolean;
}

interface ProductionState {
  project_id: string;
  assets: ProductionAsset[];
  links: AssetLinkRecord[];
}

interface ProjectLineageRecord {
  project_id: string;
  assets: AssetRecord[];
  links: AssetLinkRecord[];
}

interface TreeNode {
  asset: AssetRecord;
  version: AssetVersionRecord;
  children: TreeNode[];
  parent?: AssetRecord;
}

export function VersionTrackingPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [state, setState] = useState<ProductionState | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingState, setLoadingState] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiFetch<ProjectRecord[]>('/projects')
      .then((data) => {
        setProjects(data);
        setSelectedProjectId((current) => data.some((project) => project.id === current) ? current : data[0]?.id ?? '');
      })
      .catch(() => setError('Unable to load accessible projects.'))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setState(null);
      return;
    }
    setLoadingState(true);
    setError('');
    let active = true;
    const projectId = selectedProjectId;
    void apiFetch<ProjectLineageRecord>(`/projects/${projectId}/lineage`)
      .then((lineage) => {
        if (!active) return;
        setState({ project_id: projectId, assets: [], links: lineage.links });
        lineage.assets.forEach((asset) => {
          void apiFetch<AssetVersionRecord[]>(`/versions/${asset.id}`)
            .then((versions) => {
              if (!active) return;
              const currentVersion = [...versions].sort((left, right) => right.version_number - left.version_number)[0];
              if (!currentVersion) return;
              setState((current) => current && current.project_id === projectId && !current.assets.some((item) => item.asset.id === asset.id)
                ? { ...current, assets: [...current.assets, { asset, current_version: currentVersion, is_active: true }] }
                : current);
            })
            .catch(() => undefined);
        });
      })
      .catch(() => {
        if (active) setError('Unable to load the current project state.');
      })
      .finally(() => {
        if (active) setLoadingState(false);
      });
    return () => { active = false; };
  }, [selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const tree = useMemo(() => (state ? buildTree(state) : []), [state]);

  if (loadingProjects) return <CozySkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <header className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Workflow</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text dark:text-textDark">Version tracking</h1>
            <p className="mt-2 text-sm leading-6 text-text/65 dark:text-textDark/70">
              Current assembled production state for one accessible project.
            </p>
          </div>

          <label className="block max-w-md text-[10px] font-semibold uppercase tracking-[0.14em] text-text/55 dark:text-textDark/60">
            Project
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-2 w-full rounded-[12px] border border-[#D9D6CF] bg-[#F5F3EE] px-3 py-2 text-sm text-text dark:border-[#292929] dark:bg-[#1A1A1A] dark:text-textDark"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error ? <div className="rounded-[16px] border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error}</div> : null}

      {loadingState ? (
        <CozySkeleton rows={5} />
      ) : !selectedProject || !state ? (
        <CozyEmptyState icon="•" title="No project selected" message="Choose an accessible project to view its current production state." />
      ) : (
        <section className="rounded-[20px] border border-[#D9D6CF] bg-[#F5F3EE]/90 p-5 shadow-[0_12px_28px_rgba(13,13,13,0.05)] dark:border-[#292929] dark:bg-[#151515]/90">
          <div className="border-b border-[#D9D6CF] pb-4 dark:border-[#292929]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Current production state</p>
            <h2 className="mt-1 text-2xl font-semibold text-text dark:text-textDark">{selectedProject.title}</h2>
            <p className="mt-1 text-xs text-text/60 dark:text-textDark/65">{state.assets.length} active assets in the current project build · historical versions omitted</p>
          </div>

          {tree.length === 0 ? (
            <CozyEmptyState icon="•" title="No current assets" message="This project has no visible current production assets." />
          ) : (
            <div className="mt-8 space-y-5">
              {tree.map((node) => (
                <TreeNodeView key={node.asset.id} node={node} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function buildTree(state: ProductionState): TreeNode[] {
  const nodes = new Map<string, TreeNode>(state.assets.filter((item) => item.is_active).map((item) => [item.asset.id, { asset: item.asset, version: item.current_version, children: [] }]));
  const childIds = new Set<string>();
  state.links.forEach((link) => {
    const parent = nodes.get(link.parent_asset_id);
    const child = nodes.get(link.child_asset_id);
    if (!parent || !child) return;
    child.parent = parent.asset;
    parent.children.push(child);
    childIds.add(child.asset.id);
  });
  return [...nodes.values()].filter((node) => !childIds.has(node.asset.id));
}

function TreeNodeView({ node }: { node: TreeNode }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full border-2 border-accent bg-[#F5F3EE] dark:bg-[#151515]" />
        {node.parent ? <div className="h-px w-6 bg-[#E53935]/60" /> : null}
        <div className="flex-1">
          <AssetStateCard node={node} />
        </div>
      </div>
      {node.children.length ? (
        <div className="ml-7 border-l-2 border-[#E53935]/40 pl-5 pt-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Derived children</div>
          <div className="space-y-4">
            {node.children.map((child) => (
              <TreeNodeView key={child.asset.id} node={child} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssetStateCard({ node }: { node: TreeNode }) {
  const { asset, version, parent } = node;
  return (
    <article className="rounded-[16px] border border-[#D9D6CF] bg-[#F5F3EE] p-4 dark:border-[#292929] dark:bg-[#1A1A1A]/80" title={`Current state: ${asset.title || asset.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{asset.asset_type}</p>
          <h3 className="mt-1 text-base font-semibold text-text dark:text-textDark">{asset.title || asset.name}</h3>
          {parent ? <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Child derived from: {parent.title || parent.name}</p> : null}
        </div>
        <span className="rounded-full bg-statusSuccess/20 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-statusSuccess">
          v{version.version_number} current
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text/55 dark:text-textDark/60">
        <span>Created by: {version.created_by ? version.created_by.slice(0, 8) : 'System'}</span>
        <span>Updated: {formatDate(version.created_at)}</span>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

