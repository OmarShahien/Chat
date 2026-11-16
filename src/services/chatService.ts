import { type User as FirebaseUser } from 'firebase/auth';
import {
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  increment,
  query,
  orderByChild,
  limitToLast,
  type Unsubscribe,
} from 'firebase/database';
import { db } from '../firebase';
import type {
  UserProfile,
  PresenceState,
  FriendRequest,
  FriendRecord,
  ChatRoom,
  UserChatMeta,
  ChatMessage,
  MessageType,
  ReplyPreview,
  MediaMeta,
  MediaPayload,
  PollData,
  PinnedMessageSummary,
  TypingEntry,
} from '../types';
import {
  encodeEmailKey,
  normalizeUsername,
  normalizeFriendCode,
  generateFriendCode,
  getDirectChatId,
  getSelfChatId,
} from '../utils/formatters';

const mediaMemoryCache = new Map<string, MediaPayload>();

export async function bootstrapUserProfile(fbUser: FirebaseUser): Promise<UserProfile> {
  const uid = fbUser.uid;
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const now = Date.now();

  const email = (fbUser.email || '').trim().toLowerCase();
  const emailKey = email ? encodeEmailKey(email) : '';

  if (snap.exists()) {
    const existing = snap.val() as UserProfile;
    let username = existing.username;
    let friendCode = existing.friendCode;

    if (!username) {
      username = await reserveUniqueUsername(uid, fbUser.displayName || email.split('@')[0] || 'user');
    } else {
      await set(ref(db, `usernames/${username}`), uid).catch(() => {});
    }

    if (!friendCode) {
      friendCode = await reserveUniqueFriendCode(uid);
    } else {
      await set(ref(db, `friendCodes/${friendCode}`), uid).catch(() => {});
    }

    if (emailKey) {
      await set(ref(db, `emailIndex/${emailKey}`), uid).catch(() => {});
    }

    const updated: UserProfile = {
      ...existing,
      uid,
      displayName: existing.displayName || fbUser.displayName || 'User',
      email: email || existing.email || '',
      emailKey: emailKey || existing.emailKey || '',
      username,
      friendCode,
      photoURL: existing.photoURL || fbUser.photoURL || '',
      about: existing.about ? existing.about.replace(/Chatt\b/g, 'Chat Web') : 'Hey there! I am using Chat Web.',
      privacy: existing.privacy || {
        readReceipts: true,
        hideOnline: false,
        soundEnabled: true,
      },
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };

    await set(userRef, updated);
    await ensureSelfChat(updated);
    return updated;
  }

  const baseHandle = fbUser.displayName || email.split('@')[0] || 'user';
  const username = await reserveUniqueUsername(uid, baseHandle);
  const friendCode = await reserveUniqueFriendCode(uid);

  const newProfile: UserProfile = {
    uid,
    displayName: fbUser.displayName || email.split('@')[0] || 'User',
    email,
    emailKey,
    username,
    friendCode,
    photoURL: fbUser.photoURL || '',
    about: 'Hey there! I am using Chat Web.',
    privacy: {
      readReceipts: true,
      hideOnline: false,
      soundEnabled: true,
    },
    theme: 'dark',
    wallpaper: 'whatsapp-doodle',
    createdAt: now,
    updatedAt: now,
  };

  await set(userRef, newProfile);
  if (emailKey) {
    await set(ref(db, `emailIndex/${emailKey}`), uid);
  }
  await ensureSelfChat(newProfile);
  return newProfile;
}

async function reserveUniqueUsername(uid: string, rawBase: string): Promise<string> {
  let base = normalizeUsername(rawBase);
  if (base.length < 3) {
    base = `user_${uid.slice(0, 5).toLowerCase()}`;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate =
      attempt === 0
        ? base
        : `${base.slice(0, 18)}_${Math.floor(100 + Math.random() * 900)}`;
    const handleRef = ref(db, `usernames/${candidate}`);
    const snap = await get(handleRef);
    if (!snap.exists() || snap.val() === uid) {
      await set(handleRef, uid);
      return candidate;
    }
  }

  const fallback = `u_${uid.slice(0, 10).toLowerCase()}`;
  await set(ref(db, `usernames/${fallback}`), uid);
  return fallback;
}

async function reserveUniqueFriendCode(uid: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateFriendCode();
    const codeRef = ref(db, `friendCodes/${code}`);
    const snap = await get(codeRef);
    if (!snap.exists() || snap.val() === uid) {
      await set(codeRef, uid);
      return code;
    }
  }
  const fallback = uid.slice(0, 6).toUpperCase();
  await set(ref(db, `friendCodes/${fallback}`), uid);
  return fallback;
}

export async function ensureSelfChat(profile: UserProfile): Promise<void> {
  const selfChatId = getSelfChatId(profile.uid);
  const chatRef = ref(db, `chats/${selfChatId}`);
  const snap = await get(chatRef);
  const now = Date.now();

  if (!snap.exists()) {
    const selfRoom: ChatRoom = {
      id: selfChatId,
      type: 'self',
      members: { [profile.uid]: true },
      admins: { [profile.uid]: true },
      name: 'Message yourself',
      description: 'Personal notes and saved messages',
      createdBy: profile.uid,
      createdAt: now,
      updatedAt: now,
    };
    await set(chatRef, selfRoom);

    const userChatMeta: UserChatMeta = {
      chatId: selfChatId,
      type: 'self',
      unreadCount: 0,
      pinned: true,
      lastMessageText: 'Message yourself',
      lastMessageAt: now,
      lastMessageSenderId: profile.uid,
      lastMessageType: 'system',
    };

    await set(ref(db, `userChats/${profile.uid}/${selfChatId}`), userChatMeta);
  }
}

export function startPresenceTracking(uid: string, hideOnline = false): Unsubscribe {
  const connectedRef = ref(db, '.info/connected');
  const presenceRef = ref(db, `presence/${uid}`);

  return onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      if (hideOnline) {
        onDisconnect(presenceRef).set({
          online: false,
          lastSeen: null,
          hidden: true,
        });
        set(presenceRef, {
          online: false,
          lastSeen: null,
          hidden: true,
        }).catch(() => {});
      } else {
        onDisconnect(presenceRef).set({
          online: false,
          lastSeen: serverTimestamp(),
          hidden: false,
        });
        set(presenceRef, {
          online: true,
          lastSeen: serverTimestamp(),
          hidden: false,
        }).catch(() => {});
      }
    }
  });
}

export async function setOfflinePresence(uid: string, hideOnline = false): Promise<void> {
  const presenceRef = ref(db, `presence/${uid}`);
  await set(presenceRef, {
    online: false,
    lastSeen: hideOnline ? null : Date.now(),
    hidden: hideOnline,
  }).catch(() => {});
}

export async function updateMyProfile(
  current: UserProfile,
  patch: Partial<Pick<UserProfile, 'displayName' | 'username' | 'about' | 'photoURL' | 'privacy' | 'theme' | 'wallpaper'>>
): Promise<UserProfile> {
  const uid = current.uid;
  let nextUsername = current.username;

  if (patch.username !== undefined) {
    const cleaned = normalizeUsername(patch.username);
    if (cleaned.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (cleaned !== current.username) {
      const existingSnap = await get(ref(db, `usernames/${cleaned}`));
      if (existingSnap.exists() && existingSnap.val() !== uid) {
        throw new Error(`@${cleaned} is already taken.`);
      }
      await set(ref(db, `usernames/${cleaned}`), uid);
      if (current.username) {
        await remove(ref(db, `usernames/${current.username}`)).catch(() => {});
      }
      nextUsername = cleaned;
    }
  }

  const updated: UserProfile = {
    ...current,
    ...patch,
    displayName: (patch.displayName ?? current.displayName).trim() || current.displayName,
    username: nextUsername,
    updatedAt: Date.now(),
  };

  await set(ref(db, `users/${uid}`), updated);
  return updated;
}

export async function lookupUserByQuery(rawQuery: string): Promise<UserProfile | null> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;

  let resolvedUid: string | null = null;

  // 1. Email address
  if (trimmed.includes('@') && trimmed.includes('.') && !trimmed.startsWith('@')) {
    const emailSnap = await get(ref(db, `emailIndex/${encodeEmailKey(trimmed)}`));
    if (emailSnap.exists()) {
      resolvedUid = emailSnap.val() as string;
    }
  }

  // 2. Friend code
  if (!resolvedUid && !trimmed.startsWith('@')) {
    const maybeCode = normalizeFriendCode(trimmed);
    if (maybeCode.length >= 4 && maybeCode.length <= 14) {
      const codeSnap = await get(ref(db, `friendCodes/${maybeCode}`));
      if (codeSnap.exists()) {
        resolvedUid = codeSnap.val() as string;
      }
    }
  }

  // 3. Username
  if (!resolvedUid) {
    const handle = normalizeUsername(trimmed);
    if (handle.length >= 3) {
      const handleSnap = await get(ref(db, `usernames/${handle}`));
      if (handleSnap.exists()) {
        resolvedUid = handleSnap.val() as string;
      }
    }
  }

  if (!resolvedUid) return null;

  const userSnap = await get(ref(db, `users/${resolvedUid}`));
  if (!userSnap.exists()) return null;
  return userSnap.val() as UserProfile;
}

export async function sendFriendRequest(
  me: UserProfile,
  target: UserProfile,
  note = ''
): Promise<'sent' | 'auto-accepted'> {
  if (me.uid === target.uid) {
    throw new Error('You cannot add yourself.');
  }

  const existingFriend = await get(ref(db, `friends/${me.uid}/${target.uid}`));
  if (existingFriend.exists()) {
    throw new Error(`You and ${target.displayName} are already friends.`);
  }

  const [blockedByTarget, blockedByMe] = await Promise.all([
    get(ref(db, `blocks/${target.uid}/${me.uid}`)),
    get(ref(db, `blocks/${me.uid}/${target.uid}`)),
  ]);
  if (blockedByTarget.exists()) {
    throw new Error('Unable to send request.');
  }
  if (blockedByMe.exists()) {
    throw new Error('Unblock this contact first.');
  }

  const reverseReqSnap = await get(ref(db, `friendRequests/incoming/${me.uid}/${target.uid}`));
  if (reverseReqSnap.exists()) {
    const req = reverseReqSnap.val() as FriendRequest;
    await acceptFriendRequest(me, req);
    return 'auto-accepted';
  }

  const now = Date.now();
  const payload: FriendRequest = {
    fromUid: me.uid,
    fromName: me.displayName,
    fromUsername: me.username,
    fromPhoto: me.photoURL || '',
    fromFriendCode: me.friendCode,
    toUid: target.uid,
    toName: target.displayName,
    toUsername: target.username,
    toPhoto: target.photoURL || '',
    message: note.trim().slice(0, 140),
    createdAt: now,
  };

  await update(ref(db), {
    [`friendRequests/incoming/${target.uid}/${me.uid}`]: payload,
    [`friendRequests/outgoing/${me.uid}/${target.uid}`]: payload,
  });
  return 'sent';
}

export async function acceptFriendRequest(me: UserProfile, req: FriendRequest): Promise<string> {
  const friendUid = req.fromUid;
  const chatId = getDirectChatId(me.uid, friendUid);
  const now = Date.now();

  const chatRef = ref(db, `chats/${chatId}`);
  const existingChatSnap = await get(chatRef);

  if (!existingChatSnap.exists()) {
    const newChat: ChatRoom = {
      id: chatId,
      type: 'direct',
      members: {
        [me.uid]: true,
        [friendUid]: true,
      },
      createdBy: me.uid,
      createdAt: now,
      updatedAt: now,
    };
    await set(chatRef, newChat);
  } else {
    const existingChat = existingChatSnap.val() as ChatRoom;
    await update(chatRef, {
      members: {
        ...(existingChat.members || {}),
        [me.uid]: true,
        [friendUid]: true,
      },
      updatedAt: now,
    });
  }

  const greetingText = 'Messages are private';

  const myChatMeta: UserChatMeta = {
    chatId,
    type: 'direct',
    peerUid: friendUid,
    unreadCount: 0,
    lastMessageText: greetingText,
    lastMessageAt: now,
    lastMessageSenderId: me.uid,
    lastMessageType: 'system',
  };

  const friendChatMeta: UserChatMeta = {
    chatId,
    type: 'direct',
    peerUid: me.uid,
    unreadCount: 1,
    lastMessageText: greetingText,
    lastMessageAt: now,
    lastMessageSenderId: me.uid,
    lastMessageType: 'system',
  };

  const myFriendRecord: FriendRecord = {
    uid: friendUid,
    chatId,
    addedAt: now,
  };

  const peerFriendRecord: FriendRecord = {
    uid: me.uid,
    chatId,
    addedAt: now,
  };

  const sysMsgRef = push(ref(db, `messages/${chatId}`));
  const sysMsgId = sysMsgRef.key!;
  const sysMsg: ChatMessage = {
    id: sysMsgId,
    chatId,
    senderId: me.uid,
    senderName: me.displayName,
    type: 'system',
    text: `${me.displayName} accepted the request`,
    createdAt: now,
    deliveredTo: { [me.uid]: now },
    seenBy: { [me.uid]: now },
  };

  await update(ref(db), {
    [`friends/${me.uid}/${friendUid}`]: myFriendRecord,
    [`friends/${friendUid}/${me.uid}`]: peerFriendRecord,
    [`friendRequests/incoming/${me.uid}/${friendUid}`]: null,
    [`friendRequests/outgoing/${friendUid}/${me.uid}`]: null,
    [`userChats/${me.uid}/${chatId}`]: myChatMeta,
    [`userChats/${friendUid}/${chatId}`]: friendChatMeta,
    [`messages/${chatId}/${sysMsgId}`]: sysMsg,
  });

  return chatId;
}

export async function declineFriendRequest(myUid: string, senderUid: string): Promise<void> {
  await update(ref(db), {
    [`friendRequests/incoming/${myUid}/${senderUid}`]: null,
    [`friendRequests/outgoing/${senderUid}/${myUid}`]: null,
  });
}

export async function cancelOutgoingFriendRequest(myUid: string, targetUid: string): Promise<void> {
  await update(ref(db), {
    [`friendRequests/incoming/${targetUid}/${myUid}`]: null,
    [`friendRequests/outgoing/${myUid}/${targetUid}`]: null,
  });
}

export async function removeFriend(myUid: string, friendUid: string): Promise<void> {
  await update(ref(db), {
    [`friends/${myUid}/${friendUid}`]: null,
    [`friends/${friendUid}/${myUid}`]: null,
  });
}

export async function setBlockedUser(myUid: string, targetUid: string, blocked: boolean): Promise<void> {
  if (blocked) {
    await update(ref(db), {
      [`blocks/${myUid}/${targetUid}`]: true,
      [`friendRequests/incoming/${myUid}/${targetUid}`]: null,
      [`friendRequests/outgoing/${myUid}/${targetUid}`]: null,
    });
  } else {
    await remove(ref(db, `blocks/${myUid}/${targetUid}`));
  }
}

export async function ensureDirectChatOpen(me: UserProfile, friendUid: string): Promise<string> {
  const chatId = getDirectChatId(me.uid, friendUid);
  const chatRef = ref(db, `chats/${chatId}`);
  const snap = await get(chatRef);
  const now = Date.now();

  if (!snap.exists()) {
    await set(chatRef, {
      id: chatId,
      type: 'direct',
      members: { [me.uid]: true, [friendUid]: true },
      createdBy: me.uid,
      createdAt: now,
      updatedAt: now,
    } satisfies ChatRoom);
  }

  const myUserChatRef = ref(db, `userChats/${me.uid}/${chatId}`);
  const myMetaSnap = await get(myUserChatRef);
  if (!myMetaSnap.exists()) {
    await set(myUserChatRef, {
      chatId,
      type: 'direct',
      peerUid: friendUid,
      unreadCount: 0,
      lastMessageText: '',
      lastMessageAt: now,
      lastMessageSenderId: me.uid,
      lastMessageType: 'system',
    } satisfies UserChatMeta);
  } else if (myMetaSnap.val()?.archived) {
    await update(myUserChatRef, { archived: false });
  }

  return chatId;
}

export async function createGroupChat(
  me: UserProfile,
  name: string,
  description: string,
  friendUids: string[],
  photoURL = ''
): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Enter a group subject.');
  }

  const newChatRef = push(ref(db, 'chats'));
  const chatId = `grp_${newChatRef.key}`;
  const now = Date.now();

  const members: Record<string, boolean> = { [me.uid]: true };
  for (const fUid of friendUids) {
    members[fUid] = true;
  }

  const room: ChatRoom = {
    id: chatId,
    type: 'group',
    members,
    admins: { [me.uid]: true },
    name: trimmedName,
    description: description.trim(),
    photoURL,
    createdBy: me.uid,
    createdAt: now,
    updatedAt: now,
  };

  await set(ref(db, `chats/${chatId}`), room);

  const sysMsgRef = push(ref(db, `messages/${chatId}`));
  const sysMsgId = sysMsgRef.key!;
  const sysText = `${me.displayName} created group "${trimmedName}"`;

  const updates: Record<string, unknown> = {
    [`messages/${chatId}/${sysMsgId}`]: {
      id: sysMsgId,
      chatId,
      senderId: me.uid,
      senderName: me.displayName,
      type: 'system',
      text: sysText,
      createdAt: now,
      deliveredTo: { [me.uid]: now },
      seenBy: { [me.uid]: now },
    } satisfies ChatMessage,
  };

  Object.keys(members).forEach((memberUid) => {
    updates[`userChats/${memberUid}/${chatId}`] = {
      chatId,
      type: 'group',
      unreadCount: memberUid === me.uid ? 0 : 1,
      lastMessageId: sysMsgId,
      lastMessageText: sysText,
      lastMessageAt: now,
      lastMessageSenderId: me.uid,
      lastMessageType: 'system',
    } satisfies UserChatMeta;
  });

  await update(ref(db), updates);
  return chatId;
}

export async function addMembersToGroup(
  me: UserProfile,
  room: ChatRoom,
  newFriendUids: string[]
): Promise<void> {
  if (!newFriendUids.length) return;
  const now = Date.now();
  const nextMembers = { ...room.members };
  newFriendUids.forEach((u) => {
    nextMembers[u] = true;
  });

  await update(ref(db, `chats/${room.id}`), {
    members: nextMembers,
    updatedAt: now,
  });

  const sysMsgRef = push(ref(db, `messages/${room.id}`));
  const sysMsgId = sysMsgRef.key!;
  const sysText = `${me.displayName} added ${newFriendUids.length} member${newFriendUids.length > 1 ? 's' : ''}`;

  const updates: Record<string, unknown> = {
    [`messages/${room.id}/${sysMsgId}`]: {
      id: sysMsgId,
      chatId: room.id,
      senderId: me.uid,
      senderName: me.displayName,
      type: 'system',
      text: sysText,
      createdAt: now,
    } satisfies ChatMessage,
  };

  newFriendUids.forEach((u) => {
    updates[`userChats/${u}/${room.id}`] = {
      chatId: room.id,
      type: 'group',
      unreadCount: 1,
      lastMessageId: sysMsgId,
      lastMessageText: sysText,
      lastMessageAt: now,
      lastMessageSenderId: me.uid,
      lastMessageType: 'system',
    } satisfies UserChatMeta;
  });

  await update(ref(db), updates);
}

export async function leaveGroupChat(me: UserProfile, room: ChatRoom): Promise<void> {
  const now = Date.now();
  const sysMsgRef = push(ref(db, `messages/${room.id}`));
  const sysMsgId = sysMsgRef.key!;

  await set(ref(db, `messages/${room.id}/${sysMsgId}`), {
    id: sysMsgId,
    chatId: room.id,
    senderId: me.uid,
    senderName: me.displayName,
    type: 'system',
    text: `${me.displayName} left`,
    createdAt: now,
  } satisfies ChatMessage);

  const nextMembers = { ...room.members };
  delete nextMembers[me.uid];

  await update(ref(db, `chats/${room.id}`), {
    members: nextMembers,
    updatedAt: now,
  });
  await remove(ref(db, `userChats/${me.uid}/${room.id}`));
}

export interface SendMessageOptions {
  chatRoom: ChatRoom;
  sender: UserProfile;
  type: MessageType;
  text: string;
  replyTo?: ReplyPreview | null;
  forwarded?: boolean;
  mediaDataUrl?: string;
  mediaMeta?: MediaMeta;
  poll?: PollData;
}

export async function sendChatMessage(opts: SendMessageOptions): Promise<ChatMessage> {
  const { chatRoom, sender, type, text, replyTo, forwarded, mediaDataUrl, mediaMeta, poll } = opts;
  const chatId = chatRoom.id;
  const now = Date.now();

  if (chatRoom.type === 'direct') {
    const peerUid = Object.keys(chatRoom.members).find((u) => u !== sender.uid);
    if (peerUid) {
      const [blockedByPeer, blockedByMe] = await Promise.all([
        get(ref(db, `blocks/${peerUid}/${sender.uid}`)),
        get(ref(db, `blocks/${sender.uid}/${peerUid}`)),
      ]);
      if (blockedByPeer.exists()) {
        throw new Error('Could not deliver message.');
      }
      if (blockedByMe.exists()) {
        throw new Error('Unblock this contact to send a message.');
      }
    }
  }

  let mediaId: string | undefined;
  if (mediaDataUrl) {
    const mediaRef = push(ref(db, `media/${chatId}`));
    mediaId = mediaRef.key!;
    const mediaItem: MediaPayload = {
      id: mediaId,
      chatId,
      uploaderId: sender.uid,
      mimeType: mediaMeta?.mimeType || 'application/octet-stream',
      fileName: mediaMeta?.fileName,
      dataUrl: mediaDataUrl,
      createdAt: now,
    };
    await set(mediaRef, mediaItem);
    mediaMemoryCache.set(`${chatId}/${mediaId}`, mediaItem);
  }

  const msgRef = push(ref(db, `messages/${chatId}`));
  const messageId = msgRef.key!;

  const message: ChatMessage = {
    id: messageId,
    chatId,
    senderId: sender.uid,
    senderName: sender.displayName,
    senderPhoto: sender.photoURL || '',
    type,
    text: text.trim(),
    ...(mediaId ? { mediaId } : {}),
    ...(mediaMeta ? { mediaMeta } : {}),
    ...(poll ? { poll } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(forwarded ? { forwarded: true } : {}),
    deliveredTo: { [sender.uid]: now },
    seenBy: { [sender.uid]: now },
    createdAt: now,
  };

  const previewText = getMessageSummaryText(type, text.trim(), mediaMeta, poll);

  const updates: Record<string, unknown> = {
    [`messages/${chatId}/${messageId}`]: message,
    [`chats/${chatId}/updatedAt`]: now,
  };

  const memberUids = Object.keys(chatRoom.members || {}).filter((u) => chatRoom.members[u]);
  for (const uid of memberUids) {
    const isSender = uid === sender.uid;
    const peerUid =
      chatRoom.type === 'direct' ? memberUids.find((m) => m !== uid) : undefined;

    updates[`userChats/${uid}/${chatId}/chatId`] = chatId;
    updates[`userChats/${uid}/${chatId}/type`] = chatRoom.type;
    if (peerUid) {
      updates[`userChats/${uid}/${chatId}/peerUid`] = peerUid;
    }
    updates[`userChats/${uid}/${chatId}/lastMessageId`] = messageId;
    updates[`userChats/${uid}/${chatId}/lastMessageText`] = previewText;
    updates[`userChats/${uid}/${chatId}/lastMessageAt`] = now;
    updates[`userChats/${uid}/${chatId}/lastMessageSenderId`] = sender.uid;
    updates[`userChats/${uid}/${chatId}/lastMessageType`] = type;
    updates[`userChats/${uid}/${chatId}/unreadCount`] = isSender ? 0 : increment(1);
  }

  await update(ref(db), updates);
  return message;
}

export function getMessageSummaryText(
  type: MessageType,
  text: string,
  mediaMeta?: MediaMeta,
  poll?: PollData
): string {
  if (type === 'image') return text || 'Photo';
  if (type === 'voice') {
    const dur = mediaMeta?.durationSec
      ? ` (${Math.floor(mediaMeta.durationSec / 60)}:${String(Math.floor(mediaMeta.durationSec % 60)).padStart(2, '0')})`
      : '';
    return `Voice message${dur}`;
  }
  if (type === 'file') return mediaMeta?.fileName || 'Document';
  if (type === 'poll') return poll?.question || text || 'Poll';
  return text;
}

export async function fetchMediaPayload(chatId: string, mediaId: string): Promise<MediaPayload | null> {
  const key = `${chatId}/${mediaId}`;
  if (mediaMemoryCache.has(key)) {
    return mediaMemoryCache.get(key)!;
  }
  const snap = await get(ref(db, `media/${chatId}/${mediaId}`));
  if (!snap.exists()) return null;
  const data = snap.val() as MediaPayload;
  mediaMemoryCache.set(key, data);
  return data;
}

export async function toggleMessageReaction(
  chatId: string,
  messageId: string,
  uid: string,
  emoji: string | null
): Promise<void> {
  await set(ref(db, `messages/${chatId}/${messageId}/reactions/${uid}`), emoji);
}

export async function editChatMessage(
  chatId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed) return;
  await update(ref(db, `messages/${chatId}/${messageId}`), {
    text: trimmed,
    editedAt: Date.now(),
  });
}

export async function deleteMessageForEveryone(chatId: string, messageId: string): Promise<void> {
  await update(ref(db, `messages/${chatId}/${messageId}`), {
    deletedForEveryone: true,
    text: '',
    mediaId: null,
    mediaMeta: null,
    poll: null,
  });
}

export async function deleteMessageForMe(
  chatId: string,
  messageId: string,
  uid: string
): Promise<void> {
  await set(ref(db, `messages/${chatId}/${messageId}/deletedFor/${uid}`), true);
}

export async function pinMessageInChat(
  chatId: string,
  summary: PinnedMessageSummary | null
): Promise<void> {
  await set(ref(db, `chats/${chatId}/pinnedMessage`), summary);
}

export async function voteOnPollOption(
  chatId: string,
  message: ChatMessage,
  uid: string,
  optionId: string
): Promise<void> {
  if (!message.poll) return;
  const options = message.poll.options || {};
  const currentlyVoted = Boolean(options[optionId]?.votes?.[uid]);
  const updates: Record<string, unknown> = {};

  if (!message.poll.allowMultiple && !currentlyVoted) {
    Object.keys(options).forEach((id) => {
      if (id !== optionId && options[id]?.votes?.[uid]) {
        updates[`messages/${chatId}/${message.id}/poll/options/${id}/votes/${uid}`] = null;
      }
    });
  }

  updates[`messages/${chatId}/${message.id}/poll/options/${optionId}/votes/${uid}`] =
    currentlyVoted ? null : true;

  await update(ref(db), updates);
}

export async function markChatMessagesRead(
  chatId: string,
  messages: ChatMessage[],
  uid: string,
  sendReadReceipts = true
): Promise<void> {
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`userChats/${uid}/${chatId}/unreadCount`]: 0,
  };

  for (const m of messages) {
    if (m.senderId === uid) continue;
    if (!m.deliveredTo?.[uid]) {
      updates[`messages/${chatId}/${m.id}/deliveredTo/${uid}`] = now;
    }
    if (sendReadReceipts && !m.seenBy?.[uid]) {
      updates[`messages/${chatId}/${m.id}/seenBy/${uid}`] = now;
    }
  }

  await update(ref(db), updates).catch(() => {});
}

export async function markBackgroundMessagesDelivered(
  chatId: string,
  uid: string
): Promise<void> {
  const q = query(ref(db, `messages/${chatId}`), orderByChild('createdAt'), limitToLast(20));
  const snap = await get(q);
  if (!snap.exists()) return;
  const now = Date.now();
  const updates: Record<string, unknown> = {};
  snap.forEach((child) => {
    const msg = child.val() as ChatMessage;
    if (msg.senderId !== uid && !msg.deliveredTo?.[uid]) {
      updates[`messages/${chatId}/${msg.id}/deliveredTo/${uid}`] = now;
    }
  });
  if (Object.keys(updates).length > 0) {
    await update(ref(db), updates).catch(() => {});
  }
}

export async function setTypingState(
  chatId: string,
  uid: string,
  name: string,
  state: 'typing' | 'recording' | null
): Promise<void> {
  const typingRef = ref(db, `typing/${chatId}/${uid}`);
  if (!state) {
    await remove(typingRef).catch(() => {});
    return;
  }
  const entry: TypingEntry = {
    state,
    name,
    updatedAt: Date.now(),
  };
  onDisconnect(typingRef).remove().catch(() => {});
  await set(typingRef, entry).catch(() => {});
}

export async function updateUserChatFlags(
  uid: string,
  chatId: string,
  flags: Partial<Pick<UserChatMeta, 'pinned' | 'muted' | 'archived' | 'favorite' | 'clearedAt' | 'wallpaper'>>
): Promise<void> {
  await update(ref(db, `userChats/${uid}/${chatId}`), flags);
}

export async function setChatLock(
  uid: string,
  chatId: string,
  lockHash: string | null
): Promise<void> {
  await update(ref(db, `userChats/${uid}/${chatId}`), { lockHash });
}

export function subscribeChatMessages(
  chatId: string,
  onMessages: (msgs: ChatMessage[]) => void
): Unsubscribe {
  const q = query(ref(db, `messages/${chatId}`), orderByChild('createdAt'), limitToLast(150));
  return onValue(q, (snap) => {
    const list: ChatMessage[] = [];
    snap.forEach((child) => {
      list.push(child.val() as ChatMessage);
    });
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    onMessages(list);
  });
}
