import type { BubbleThemeId } from './utils/bubbleThemes';

export type { BubbleThemeId };

export type ThemeMode = 'dark' | 'light';

export type WallpaperId =
  | 'whatsapp-doodle'
  | 'midnight-emerald'
  | 'deep-ocean'
  | 'warm-sand'
  | 'slate-minimal'
  | 'royal-plum';

export interface UserPrivacySettings {
  readReceipts: boolean;
  hideOnline: boolean;
  soundEnabled: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  emailKey: string;
  username: string;
  friendCode: string;
  photoURL: string;
  about: string;
  privacy?: UserPrivacySettings;
  theme?: ThemeMode;
  wallpaper?: WallpaperId;
  bubbleTheme?: BubbleThemeId;
  createdAt: number;
  updatedAt: number;
}

export interface PresenceState {
  online: boolean;
  lastSeen: number | null;
  hidden?: boolean;
  customStatus?: string;
}

export interface FriendRequest {
  fromUid: string;
  fromName: string;
  fromUsername: string;
  fromPhoto: string;
  fromFriendCode?: string;
  toUid: string;
  toName?: string;
  toUsername?: string;
  toPhoto?: string;
  message?: string;
  createdAt: number;
}

export interface FriendRecord {
  uid: string;
  chatId: string;
  addedAt: number;
  nickname?: string;
  favorite?: boolean;
}

export type ChatType = 'self' | 'direct' | 'group';

export interface PinnedMessageSummary {
  messageId: string;
  text: string;
  senderName: string;
  pinnedBy: string;
  pinnedAt: number;
}

export interface ChatRoom {
  id: string;
  type: ChatType;
  members: Record<string, boolean>;
  admins?: Record<string, boolean>;
  name?: string;
  description?: string;
  photoURL?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  pinnedMessage?: PinnedMessageSummary | null;
  bubbleTheme?: BubbleThemeId;
  /** Disappearing messages timer in seconds (e.g. 10, 60, 3600, 86400). 0 or null = off */
  disappearingTimer?: number | null;
}

export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'poll' | 'game' | 'system';

export type MinigameKind =
  | 'tictactoe'
  | 'connect4'
  | 'rps'
  | 'wordle'
  | 'memory'
  | 'mathblitz';

export type MinigameMode = 'pvp' | 'bot' | 'pass' | 'party';

export type RpsThrow = 'rock' | 'paper' | 'scissors';

export interface RpsRoundSummary {
  round: number;
  p1Move: RpsThrow;
  p2Move: RpsThrow;
  winner: 'p1' | 'p2' | 'draw';
}

export interface WordlePlayerState {
  uid: string;
  name: string;
  /** Pipe-delimited uppercase 5-letter guesses, e.g. 'SLATE|CRANE'. Empty string '' when none. */
  guesses: string;
  status: 'playing' | 'won' | 'lost';
  completedAt?: number;
}

export interface MinigameLeaderboardEntry {
  uid: string;
  name: string;
  score: number;
  moves?: number;
  timeMs: number;
  completedAt: number;
}

export interface MinigameData {
  kind: MinigameKind;
  mode: MinigameMode;
  hostUid: string;
  hostName: string;
  guestUid?: string;
  guestName?: string;
  status: 'waiting' | 'active' | 'finished';
  /** 'p1' = host, 'p2' = guest / bot / player 2 */
  turn?: 'p1' | 'p2';
  /** 'p1', 'p2', or 'draw' when finished */
  winner?: 'p1' | 'p2' | 'draw' | '';
  p1Score?: number;
  p2Score?: number;
  roundNumber?: number;

  // Tic-Tac-Toe (9-char string of '.', 'X', 'O') & Connect Four (42-char string of '.', '1', '2')
  board?: string;
  winLine?: string;
  lastMoveIndex?: number;

  // Rock Paper Scissors (Best of 3)
  p1RoundWins?: number;
  p2RoundWins?: number;
  p1Pick?: RpsThrow | '';
  p2Pick?: RpsThrow | '';
  lastRound?: RpsRoundSummary;

  // Word Guess (5-letter Wordle)
  secretWord?: string;
  isCustomWord?: boolean;
  wordPlayers?: Record<string, WordlePlayerState>;

  // Seeded Party Games (Emoji Memory & Math Blitz)
  seed?: number;
  leaderboard?: Record<string, MinigameLeaderboardEntry>;

  updatedAt: number;
}

export interface UserChatMeta {
  chatId: string;
  type: ChatType;
  peerUid?: string;
  unreadCount: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  favorite?: boolean;
  clearedAt?: number;
  wallpaper?: WallpaperId;
  bubbleTheme?: BubbleThemeId;
  disappearingTimer?: number | null;
  /** Salted hash of the chat passcode; present only while the chat is locked. */
  lockHash?: string;
  lastMessageId?: string;
  lastMessageText: string;
  lastMessageAt: number;
  lastMessageSenderId: string;
  lastMessageType: MessageType;
}

export interface ReplyPreview {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: MessageType;
}

export interface MediaMeta {
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  waveform?: number[];
  previewDataUrl?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes?: Record<string, boolean>;
}

export interface PollData {
  question: string;
  allowMultiple: boolean;
  options: Record<string, PollOption>;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  type: MessageType;
  text: string;
  mediaId?: string;
  mediaMeta?: MediaMeta;
  poll?: PollData;
  game?: MinigameData;
  replyTo?: ReplyPreview;
  forwarded?: boolean;
  editedAt?: number;
  deletedForEveryone?: boolean;
  deletedFor?: Record<string, boolean>;
  starredBy?: Record<string, boolean>;
  reactions?: Record<string, string>;
  deliveredTo?: Record<string, number>;
  seenBy?: Record<string, number>;
  bubbleTheme?: BubbleThemeId;
  /** Disappearing message expiration timestamp (epoch ms) */
  expiresAt?: number;
  disappearing?: boolean;
  /** 1-time picture (View once photo) */
  viewOnce?: boolean;
  /** Mapping uid -> timestamp when opened */
  viewedBy?: Record<string, number>;
  createdAt: number;
}

export interface MediaPayload {
  id: string;
  chatId: string;
  uploaderId: string;
  mimeType: string;
  fileName?: string;
  dataUrl: string;
  createdAt: number;
}

export interface TypingEntry {
  state: 'typing' | 'recording';
  name: string;
  updatedAt: number;
}
