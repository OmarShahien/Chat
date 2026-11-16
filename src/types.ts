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
}

export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'poll' | 'system';

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
  replyTo?: ReplyPreview;
  forwarded?: boolean;
  editedAt?: number;
  deletedForEveryone?: boolean;
  deletedFor?: Record<string, boolean>;
  starredBy?: Record<string, boolean>;
  reactions?: Record<string, string>;
  deliveredTo?: Record<string, number>;
  seenBy?: Record<string, number>;
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

export interface StatusUpdate {
  id: string;
  uid: string;
  userName: string;
  userPhoto: string;
  type: 'text' | 'image';
  text: string;
  bgGradient?: string;
  imageDataUrl?: string;
  createdAt: number;
  expiresAt: number;
  viewedBy?: Record<string, number>;
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto: string;
  calleeId: string;
  calleeName: string;
  calleePhoto: string;
  status: 'ringing' | 'connected' | 'declined' | 'ended';
  offer?: { type: RTCSdpType; sdp: string };
  answer?: { type: RTCSdpType; sdp: string };
  callerCandidates?: Record<string, RTCIceCandidateInit>;
  calleeCandidates?: Record<string, RTCIceCandidateInit>;
  createdAt: number;
  connectedAt?: number;
}
