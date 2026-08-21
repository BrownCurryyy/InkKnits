export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type UserRecord = {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  status: string;
};

export type OrganizationRosterMemberRecord = {
  user: UserRecord;
  role: 'ADMIN' | 'MANAGER' | 'EDITOR' | 'REVIEWER' | 'PUBLISHER' | 'VIEWER';
  project_names: string[];
  station_names: string[];
};

export type JwtPayload = {
  sub?: string;
  email?: string;
  organization_id?: string;
  roles?: string[];
  exp?: number;
  iat?: number;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  description?: string | null;
  logo_path?: string | null;
};

export type ProjectRecord = {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  status: string;
  deadline?: string | null;
};

export type StationRecord = {
  id: string;
  project_id: string;
  name: string;
  station_type: 'WRITING' | 'GENERATION' | 'VIEWING' | 'IMAGE';
  description?: string | null;
};

export type AssetRecord = {
  id: string;
  organization_id: string;
  station_id: string;
  owner_id?: string | null;
  name: string;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  asset_type: string;
  storage_path?: string | null;
  raw_metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type AssetLinkRecord = {
  id: string;
  parent_asset_id: string;
  child_asset_id: string;
  relationship_type: string;
  created_at: string;
};

export type AssetLineageRecord = {
  asset: AssetRecord;
  parents: AssetRecord[];
  children: AssetRecord[];
  links: AssetLinkRecord[];
};

export type AssetVersionRecord = {
  id: string;
  asset_id: string;
  version_number: number;
  snapshot_path: string;
  raw_metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};


export type ActivityRecord = {
  id: string;
  organization_id?: string | null;
  project_id?: string | null;
  asset_id?: string | null;
  user_id?: string | null;
  activity_type: string;
  description: string;
  raw_metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type ApprovalTaskRecord = {
  id: string;
  asset_id: string;
  assigned_to: string;
  assigned_by: string;
  status: string;
  deadline?: string | null;
  escalated_to?: string | null;
  comments?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type AIJobStatusRecord = {
  task_id: string;
  job_type: string;
  project_id?: string | null;
  station_id?: string | null;
  asset_id?: string | null;
  created_by?: string;
  priority: number;
  status: string;
  queue_position?: number | null;
  result?: string | Record<string, unknown> | null;
  result_available?: boolean;
  error?: string | null;
  prompt?: string;
  model?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
};

