// ─── User & Profile ───────────────────────────────────────────────────────────

export type VehicleType = 'petrol' | 'diesel' | 'ev' | 'suv' | 'moto';
export type FuelType = 'petrol_95' | 'petrol_98' | 'diesel' | 'lpg' | 'electric';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_color: string;
  lang: 'nl' | 'en' | 'fr' | 'tr';
  created_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  label: string;
  type: VehicleType;
  fuel_type: FuelType;
  consumption: number;       // L/100km or kWh/100km for EV
  tank_size: number;         // litres or kWh
  icon_color: string;        // hex
  is_ev: boolean;
}

// ─── Convoy ───────────────────────────────────────────────────────────────────

export type ConvoyStatus = 'preparation' | 'driving' | 'paused' | 'ended';
export type MemberRole = 'leader' | 'co_leader' | 'member';
export type MemberStatus = 'online' | 'offline' | 'weak_signal';

export interface Convoy {
  id: string;
  created_by: string;
  title: string;
  invite_code: string;
  status: ConvoyStatus;
  starts_at: string;
  expires_at: string;
  ended_at?: string;
}

export interface ConvoyMember {
  id: string;
  convoy_id: string;
  user_id: string;
  vehicle_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  // Joined fields (from view)
  display_name?: string;
  avatar_color?: string;
  vehicle?: Vehicle;
}

// ─── Live Position ────────────────────────────────────────────────────────────

export interface LivePosition {
  id: string;
  convoy_member_id: string;
  lat: number;
  lng: number;
  speed: number;             // km/h
  heading: number;           // 0-360 degrees
  recorded_at: string;
  is_interpolated: boolean;
}

// ─── Stops ───────────────────────────────────────────────────────────────────

export type StopType = 'fuel' | 'food' | 'rest' | 'overnight' | 'sightseeing' | 'emergency';
export type StopStatus = 'proposed' | 'confirmed' | 'passed' | 'cancelled';
export type VoteReaction = 'approve' | 'decline' | 'neutral';

export interface Stop {
  id: string;
  convoy_id: string;
  proposed_by: string;
  type: StopType;
  name: string;
  lat: number;
  lng: number;
  duration_min: number;
  status: StopStatus;
  confirmed_at?: string;
  // Joined
  votes?: StopVote[];
  arrivals?: StopArrival[];
}

export interface StopVote {
  id: string;
  stop_id: string;
  convoy_member_id: string;
  reaction: VoteReaction;
  voted_at: string;
}

export interface StopArrival {
  id: string;
  stop_id: string;
  convoy_member_id: string;
  arrived_at: string;
}

// ─── Status Events ────────────────────────────────────────────────────────────

export type StatusEventType =
  | 'departed'
  | 'running_late'
  | 'emergency_stop'
  | 'fuel_stop'
  | 'break_needed'
  | 'technical_issue';

export interface StatusEvent {
  id: string;
  convoy_member_id: string;
  type: StatusEventType;
  lat?: number;
  lng?: number;
  note?: string;
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'stop_proposed'
  | 'stop_confirmed'
  | 'stop_cancelled'
  | 'leader_changed'
  | 'emergency'
  | 'convoy_started'
  | 'convoy_ended'
  | 'member_joined';

export interface Notification {
  id: string;
  convoy_id: string;
  recipient_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  is_read: boolean;
  sent_at: string;
}

// ─── Navigation params ────────────────────────────────────────────────────────

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  CreateConvoy: undefined;
  JoinConvoy: { code?: string };
  ConvoyLobby: { convoyId: string };
  LiveMap: { convoyId: string };
  StopPlanner: { convoyId: string };
  StopDetail: { stopId: string };
  FuelPrices: { convoyId: string };
  Settings: undefined;
};
