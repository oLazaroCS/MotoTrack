export type UserRole = 'driver' | 'admin';
export type AccountStatus = 'active' | 'inactive' | 'pending';

export interface Team {
  id: string;
  name: string;
  tag: string;
  join_code: string;
  logo_url: string | null;
  created_by: string | null;
}

export interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  driver_code: string;
  role: UserRole;
  account_status: AccountStatus;
  team_id: string | null;
  is_master_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverLocation {
  id: string;
  user_id: string;
  team_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  is_online: boolean;
  captured_at: string;
  updated_at: string;
  last_online_at: string | null;
}

export interface DriverWithLocation extends Profile { location: DriverLocation | null; }
