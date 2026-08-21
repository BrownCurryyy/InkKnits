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
    void apiFetch<ProjectRecord[]>('/projects').then((data) => {
      setProjects(data);
      setSelectedProjectId((current) => data.some((project) => project.id === current) ? current : data[0]?.id ?? '');
    }).catch(() => setError('Unable to load accessible projects.')).finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setState(null);
      return;
    }
    setLoadingState(true);
    setError('');
    void apiFetch<ProductionState>(`/projects/${selectedProjectId}/production-state`)
      .then(setState)
      .catch(() => setError('Unable to load the current project state.'))
      .finally(() => setLoadingState(false));
  }, [selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const tree = useMemo(() => state ? buildTree(state) : [], [state]);

  if (loadingProjects) return <CozySkeleton rows={5} />;

  return <div className="space-y-6">
    <header className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/90"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Workflow</p><h1 className="mt-2 text-3xl font-bold">Version Tracking</h1><p className="mt-2 text-sm text-text/65 dark:text-textDark/65">Current assembled production state for one accessible project.</p><label className="mt-5 block max-w-md text-xs font-bold">Project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-[#554949]"><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label></header>
    {error ? <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold">{error}</div> : null}
    {loadingState ? <CozySkeleton rows={5} /> : !selectedProject || !state ? <CozyEmptyState icon="⌘" title="No project selected" message="Choose an accessible project to view its current production state." /> : <section className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-cozy dark:border-white/10 dark:bg-[#3a2d2d]/90"><div className="border-b border-black/10 pb-4 dark:border-white/10"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Project</p><h2 className="mt-1 text-2xl font-bold">{selectedProject.title}</h2><p className="mt-1 text-xs text-text/60 dark:text-textDark/60">{state.assets.length} current assets · historical versions omitted</p></div>{tree.length === 0 ? <CozyEmptyState icon="⌘" title="No current assets" message="This project has no visible current production assets." /> : <div className="mt-8 space-y-5">{tree.map((node) => <TreeNodeView key={node.asset.id} node={node} />)}</div>}</section>}
  </div>;
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
  return <div className="relative"><AssetStateCard node={node} />{node.children.length ? <div className="ml-7 border-l-2 border-accent/25 pl-5 pt-4"><div className="mb-3 text-xs font-bold uppercase tracking-wider text-accent">Derived children</div><div className="space-y-4">{node.children.map((child) => <TreeNodeView key={child.asset.id} node={child} />)}</div></div> : null}</div>;
}

function AssetStateCard({ node }: { node: TreeNode }) {
  const { asset, version, parent } = node;
  return <article className="rounded-2xl border border-black/10 bg-background/50 p-4 dark:border-white/10 dark:bg-[#4f3d3d]/60" title={`Current state: ${asset.title || asset.name}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-accent">{asset.asset_type}</p><h3 className="mt-1 text-base font-bold">{asset.title || asset.name}</h3>{parent ? <p className="mt-1 text-xs text-text/60 dark:text-textDark/60">Child derived from: {parent.title || parent.name}</p> : null}</div><span className="rounded-full bg-statusSuccess/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-statusSuccess">v{version.version_number} CURRENT</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text/55 dark:text-textDark/55"><span>Created by: {version.created_by ? version.created_by.slice(0, 8) : 'System'}</span><span>Updated: {formatDate(version.created_at)}</span></div></article>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
