/** Model data PentungScore (mirroring PRD §5). */

export type Suit = '♠' | '♥' | '♦' | '♣';
export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export type SuitName = 'Spd' | 'Hrt' | 'Dia' | 'Clb';
export const SUIT_NAMES: Record<Suit, SuitName> = {
  '♠': 'Spd',
  '♥': 'Hrt',
  '♦': 'Dia',
  '♣': 'Clb',
};

export type AvatarColorStyle = 'emerald' | 'gold' | 'crimson' | 'slate';
export type Avatar =
  | { type: 'initials'; colorStyle: AvatarColorStyle }
  | { type: 'photo'; photoUri: string };

export interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  suit: Suit;
  gamesPlayed: number;
  wins: number;
  isDealer: boolean;
  createdAt: string;
}

export type SessionStatus = 'ongoing' | 'completed';

export interface Participant {
  playerId: string;
  seatOrder: number;
  isDealer: boolean;
  isActive: boolean;
}

export interface Round {
  roundNumber: number;
  scores: Record<string, number>;
}

export interface SessionRules {
  targetScoreEnabled: boolean;
  targetScore: number;
}

/** Lokasi tempat sesi permainan dimulai. */
export interface SessionLocation {
  latitude: number;
  longitude: number;
  /** Radius akurasi GPS dalam meter (null bila perangkat tidak melaporkan). */
  accuracy: number | null;
  /** Alamat hasil reverse geocoding (null bila tidak tersedia). */
  address: string | null;
  capturedAt: string;
}

export interface GameSession {
  id: string;
  title: string;
  createdAt: string;
  status: SessionStatus;
  participants: Participant[];
  rules: SessionRules;
  rounds: Round[];
  winnerPlayerId?: string;
  location?: SessionLocation;
}

/** Arena tetap yang dipakai sebagai pusat geofence. */
export interface Arena {
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  address: string | null;
  monitoring: boolean;
  updatedAt: string;
}

export type GeofenceEventType = 'enter' | 'exit';

export interface GeofenceEvent {
  type: GeofenceEventType;
  arenaName: string;
  at: string;
}

export interface RankEntry {
  playerId: string;
  total: number;
  rank: number;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
