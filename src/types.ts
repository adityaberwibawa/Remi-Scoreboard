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

export interface GameSession {
  id: string;
  title: string;
  createdAt: string;
  status: SessionStatus;
  participants: Participant[];
  rules: SessionRules;
  rounds: Round[];
  winnerPlayerId?: string;
}

export interface RankEntry {
  playerId: string;
  total: number;
  rank: number;
}

export interface GeofenceZone {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
  updatedAt: string;
}

export type GeofenceEventType = 'enter' | 'exit';

export interface GeofenceEvent {
  id: number;
  type: GeofenceEventType;
  latitude: number;
  longitude: number;
  occurredAt: string;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
