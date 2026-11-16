import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CallSession,
  ChatMessage,
  ChatRoom,
  FriendRecord,
  PollData,
  UserChatMeta,
  UserProfile,
} from '../types';
import { compressAvatarFile } from '../utils/media';
import { formatDuration } from '../utils/formatters';
import {
  createGroupChat,
  fetchMediaPayload,
  sendChatMessage,
} from '../services/chatService';
import { Avatar } from './Avatar';

/* -------------------- 1. New Group Modal -------------------- */
interface NewGroupModalProps {
  open: boolean;
  onClose: () => void;
  me: UserProfile;
  friendsMap: Record<string, FriendRecord>;
  usersMap: Record<string, UserProfile>;
  onCreated: (chatId: string) => void;
  onToast: (msg: string) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  open,
  onClose,
  me,
  friendsMap,
  usersMap,
  onCreated,
  onToast,
}) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const friends = Object.values(friendsMap);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = Object.keys(selected).filter((u) => selected[u]);
    if (!name.trim()) {
      onToast('Enter a group subject');
      return;
    }
    setCreating(true);
    try {
      const chatId = await createGroupChat(me, name, desc, chosen, photo);
      setName('');
      setDesc('');
      setPhoto('');
      setSelected({});
      onClose();
      onCreated(chatId);
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[8px] bg-[#111b21] border border-[#2a3942] text-[#e9edef] shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <h2 className="font-medium text-[16px]">New group</h2>
          <button onClick={onClose} className="p-1 text-[#8696a0] hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <div
              onClick={() => fileRef.current?.click()}
              className="relative cursor-pointer"
              title="Group icon"
            >
              <Avatar name={name || 'Group'} src={photo} size="lg" isGroup />
              <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#00a884] text-[#111b21]">
                <Camera className="w-3 h-3" />
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await compressAvatarFile(file);
                    setPhoto(url);
                  }
                }}
                className="hidden"
              />
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group subject"
                maxLength={48}
                className="w-full px-3 py-2 rounded-[6px] bg-[#202c33] text-[14px] outline-none"
              />
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (optional)"
                maxLength={100}
                className="w-full px-3 py-1.5 rounded-[6px] bg-[#202c33] text-[13px] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[13px] text-[#8696a0]">
              Add contacts ({Object.values(selected).filter(Boolean).length})
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {friends.length === 0 ? (
                <p className="text-[13px] text-[#8696a0] py-3">
                  No contacts yet. You can add members later.
                </p>
              ) : (
                friends.map((rec) => {
                  const u = usersMap[rec.uid];
                  const isChecked = Boolean(selected[rec.uid]);
                  return (
                    <label
                      key={rec.uid}
                      className="flex items-center justify-between p-2 rounded-[6px] hover:bg-[#202c33] cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u?.displayName || 'Contact'} src={u?.photoURL} size="sm" />
                        <div>
                          <p className="text-[14px]">{u?.displayName || 'Contact'}</p>
                          <p className="text-[12px] text-[#8696a0]">@{u?.username}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setSelected({ ...selected, [rec.uid]: !isChecked })}
                        className="accent-[#00a884] w-4 h-4"
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="w-full py-2 rounded-[6px] bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-50 text-[#111b21] font-medium text-[14px] cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* -------------------- 2. Create Poll Modal -------------------- */
interface PollModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitPoll: (poll: PollData) => Promise<void>;
}

export const PollModal: React.FC<PollModalProps> = ({ open, onClose, onSubmitPoll }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const validOpts = options.map((o) => o.trim()).filter(Boolean);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || validOpts.length < 2) return;
    setSending(true);
    const optMap: PollData['options'] = {};
    validOpts.forEach((text, i) => {
      const id = `opt_${i}`;
      optMap[id] = { id, text };
    });
    await onSubmitPoll({
      question: question.trim(),
      allowMultiple,
      options: optMap,
    });
    setQuestion('');
    setOptions(['', '']);
    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[8px] bg-[#111b21] border border-[#2a3942] text-[#e9edef] shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <h2 className="font-medium text-[16px]">Create poll</h2>
          <button onClick={onClose} className="p-1 text-[#8696a0] hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-5 space-y-4">
          <div>
            <label className="text-[13px] text-[#8696a0]">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask question"
              maxLength={120}
              className="mt-1 w-full px-3 py-2 rounded-[6px] bg-[#202c33] text-[14px] outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] text-[#8696a0]">Options</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const copy = [...options];
                    copy[idx] = e.target.value;
                    setOptions(copy);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={80}
                  className="flex-1 px-3 py-2 rounded-[6px] bg-[#202c33] text-[13.5px] outline-none"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                    className="p-2 text-[#8696a0] hover:text-[#f15c6d] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptions([...options, ''])}
                className="inline-flex items-center gap-1 text-[13px] text-[#00a884] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add option
              </button>
            )}
          </div>

          <label className="flex items-center justify-between text-[13.5px] py-1 cursor-pointer">
            <span>Allow multiple answers</span>
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={() => setAllowMultiple(!allowMultiple)}
              className="accent-[#00a884] w-4 h-4"
            />
          </label>

          <button
            type="submit"
            disabled={sending || !question.trim() || validOpts.length < 2}
            className="w-full py-2 rounded-[6px] bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-50 text-[#111b21] font-medium text-[14px] cursor-pointer"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* -------------------- 3. Forward Message Modal -------------------- */
interface ForwardModalProps {
  message: ChatMessage | null;
  onClose: () => void;
  me: UserProfile;
  userChats: Record<string, UserChatMeta>;
  chatRooms: Record<string, ChatRoom>;
  usersMap: Record<string, UserProfile>;
  onToast: (msg: string) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  message,
  onClose,
  me,
  userChats,
  chatRooms,
  usersMap,
  onToast,
}) => {
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);

  if (!message) return null;

  const chats = Object.values(userChats).sort(
    (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)
  );

  const handleForwardTo = async (targetChatId: string) => {
    const targetRoom = chatRooms[targetChatId];
    if (!targetRoom) return;
    setForwardingTo(targetChatId);
    try {
      let mediaDataUrl: string | undefined;
      if (message.mediaId) {
        const media = await fetchMediaPayload(message.chatId, message.mediaId);
        mediaDataUrl = media?.dataUrl;
      }

      await sendChatMessage({
        chatRoom: targetRoom,
        sender: me,
        type: message.type,
        text: message.text,
        forwarded: true,
        mediaDataUrl,
        mediaMeta: message.mediaMeta,
        poll: message.poll,
      });

      onToast('Forwarded');
      onClose();
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not forward');
    } finally {
      setForwardingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[8px] bg-[#111b21] border border-[#2a3942] text-[#e9edef] shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <h2 className="font-medium text-[16px]">Forward message to</h2>
          <button onClick={onClose} className="p-1 text-[#8696a0] hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 max-h-80 overflow-y-auto space-y-1">
          {chats.map((meta) => {
            const room = chatRooms[meta.chatId];
            if (!room) return null;
            const peerUid =
              room.type === 'direct'
                ? Object.keys(room.members || {}).find((u) => u !== me.uid)
                : undefined;
            const peer = peerUid ? usersMap[peerUid] : undefined;
            const title =
              room.type === 'self'
                ? 'Message yourself'
                : room.type === 'group'
                  ? room.name || 'Group'
                  : peer?.displayName || 'Chat';

            return (
              <button
                key={meta.chatId}
                disabled={forwardingTo === meta.chatId}
                onClick={() => handleForwardTo(meta.chatId)}
                className="w-full p-2.5 rounded-[6px] hover:bg-[#202c33] flex items-center justify-between text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={title}
                    src={room.type === 'self' ? me.photoURL : room.type === 'group' ? room.photoURL : peer?.photoURL}
                    size="sm"
                    isSelf={room.type === 'self'}
                    isGroup={room.type === 'group'}
                  />
                  <span className="text-[14.5px]">{title}</span>
                </div>
                <span className="text-xs text-[#00a884]">
                  {forwardingTo === meta.chatId ? 'Sending...' : <Check className="w-4 h-4" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* -------------------- 4. Image Lightbox -------------------- */
export const ImageLightbox: React.FC<{
  src: string | null;
  caption?: string;
  onClose: () => void;
}> = ({ src, caption, onClose }) => {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-4 sm:p-6"
    >
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <a
          href={src}
          download="chat-web-photo.jpg"
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center my-4">
        <img
          src={src}
          alt={caption || 'Photo'}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[82vh] max-w-[92vw] object-contain"
        />
      </div>

      {caption && (
        <p className="text-center text-[14.5px] text-white/90 max-w-xl mx-auto pb-2">{caption}</p>
      )}
    </div>
  );
};

/* -------------------- 5. Voice Call Overlay -------------------- */
interface CallOverlayProps {
  session: CallSession | null;
  isIncomingRinging: boolean;
  muted: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  meUid: string;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  session,
  isIncomingRinging,
  muted,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  meUid,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (session?.status !== 'connected') {
      setElapsedSec(0);
      return;
    }
    const start = session.connectedAt || Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.status, session?.connectedAt]);

  if (!session) return null;

  const isCaller = session.callerId === meUid;
  const peerName = isCaller ? session.calleeName : session.callerName;
  const peerPhoto = isCaller ? session.calleePhoto : session.callerPhoto;

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col items-center justify-between py-16 px-6 text-white select-none">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-normal">{peerName}</h2>
        <p className="text-[14px] text-[#8696a0]">
          {session.status === 'connected'
            ? formatDuration(elapsedSec)
            : isIncomingRinging
              ? 'Incoming voice call'
              : 'Ringing...'}
        </p>
      </div>

      <Avatar name={peerName} src={peerPhoto} size="xl" />

      <div className="flex items-center gap-6">
        {isIncomingRinging && session.status === 'ringing' ? (
          <>
            <button
              onClick={onDecline}
              className="w-14 h-14 rounded-full bg-[#f15c6d] hover:bg-[#d94455] flex items-center justify-center shadow-lg cursor-pointer"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] flex items-center justify-center shadow-lg cursor-pointer"
              title="Answer"
            >
              <Phone className="w-6 h-6" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggleMute}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition cursor-pointer ${
                muted ? 'bg-white text-[#111b21]' : 'bg-[#202c33] text-white hover:bg-[#2a3942]'
              }`}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={onHangup}
              className="w-14 h-14 rounded-full bg-[#f15c6d] hover:bg-[#d94455] flex items-center justify-center shadow-lg cursor-pointer"
              title="End call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
