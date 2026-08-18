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

export type JwtPayload = {
  sub?: string;
  email?: string;
  organization_id?: string;
  roles?: string[];
  exp?: number;
  iat?: number;
};
