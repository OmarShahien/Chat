import React, { useEffect, useState } from 'react';
import { ref, update } from 'firebase/database';
import {
  Ban,
  BellOff,
  Check,
  Heart,
  Lock,
  LockOpen,
  LogOut,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import type {
  ChatMessage,
  ChatRoom,
  FriendRecord,
  PresenceState,
  ThemeMode,
  UserChatMeta,
  UserProfile,
} from '../types';
import {
  addMembersToGroup,
  fetchMediaPayload,
  leaveGroupChat,
  setBlockedUser,
  updateUserChatFlags,
} from '../services/chatService';
import { formatLastSeen } from '../utils/formatters';
import { Avatar } from './Avatar';

interface InfoDrawerProps {
  open: boolean;
  onClose: () => void;
  me: UserProfile;
  theme: ThemeMode;
  room: ChatRoom;
  meta?: UserChatMeta;
  messages: ChatMessage[];
  usersMap: Record<string, UserProfile>;
  friendsMap: Record<string, FriendRecord>;
  presenceMap: Record<string, PresenceState>;
  blocksMap: Record<string, boolean>;
  onOpenLightbox: (src: string, caption?: string) => void;
  onLeftGroup: () => void;
  onToggleLock: (chatId: string) => void;
  onToast: (msg: string) => void;
}

export const InfoDrawer: React.FC<InfoDrawerProps> = ({
  open,
  onClose,
  me,
  theme,
  room,
  meta,
  messages,
  usersMap,
  friendsMap,
  presenceMap,
  blocksMap,
  onOpenLightbox,
  onLeftGroup,
  onToggleLock,
  onToast,
}) => {
  const peerUid =
    room.type === 'direct'
      ? Object.keys(room.members || {}).find((u) => u !== me.uid)
      : undefined;
  const peer = peerUid ? usersMap[peerUid] : undefined;
  const friendRec = peerUid ? friendsMap[peerUid] : undefined;

  const [nickname, setNickname] = useState(friendRec?.nickname || '');
  const [addingMembers, setAddingMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<Record<string, boolean>>({});
  const [sharedThumbs, setSharedThumbs] = useState<Array<{ id: string; url: string; caption?: string }>>([]);

  const isLight = theme === 'light';

  useEffect(() => {
    setNickname(friendRec?.nickname || '');
  }, [friendRec?.nickname, room.id]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const imgMsgs = messages
      .filter((m) => m.type === 'image' && m.mediaId && !m.deletedForEveryone && !m.deletedFor?.[me.uid])
      .slice(-9)
      .reverse();

    Promise.all(
      imgMsgs.map(async (m) => {
        const payload = await fetchMediaPayload(room.id, m.mediaId!);
        return payload ? { id: m.id, url: payload.dataUrl, caption: m.text } : null;
      })
    ).then((items) => {
      if (active) {
        setSharedThumbs(items.filter(Boolean) as Array<{ id: string; url: string; caption?: string }>);
      }
    });

    return () => {
      active = false;
    };
  }, [open, messages, room.id, me.uid]);

  if (!open) return null;

  const isOnline = Boolean(peerUid && presenceMap[peerUid]?.online && !presenceMap[peerUid]?.hidden);
  const isBlocked = Boolean(peerUid && blocksMap[peerUid]);

  const title =
    room.type === 'self'
      ? `${me.displayName} (You)`
      : room.type === 'group'
        ? room.name || 'Group'
        : friendRec?.nickname || peer?.displayName || 'Contact';

  const avatarSrc =
    room.type === 'self'
      ? me.photoURL
      : room.type === 'group'
        ? room.photoURL
        : peer?.photoURL;

  const nonGroupFriends = Object.values(friendsMap).filter(
    (f) => !room.members?.[f.uid]
  );

  const handleSaveNickname = async () => {
    if (!peerUid || !friendsMap[peerUid]) return;
    await update(ref(db, `friends/${me.uid}/${peerUid}`), {
      nickname: nickname.trim() || null,
    });
    onToast('Nickname saved');
  };

  return (
    <div
      className={`w-full sm:w-[340px] shrink-0 border-l h-full flex flex-col z-20 overflow-y-auto ${
        isLight
          ? 'bg-white border-[#cfdcf0] text-[#0a1630]'
          : 'bg-[#0a1630] border-[#1d3764] text-[#eaf2ff]'
      }`}
    >
      <div
        className={`h-[59px] px-4 flex items-center gap-4 border-b shrink-0 ${
          isLight ? 'bg-[#eaf1fc] border-[#cfdcf0]' : 'bg-[#12254a] border-[#1d3764]'
        }`}
      >
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-[#8fa7cc] hover:text-current cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="font-medium text-[16px]">
          {room.type === 'group' ? 'Group info' : 'Contact info'}
        </span>
      </div>

      <div className="p-5 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2.5">
          <Avatar
            name={title}
            src={avatarSrc}
            size="xl"
            online={isOnline}
            isSelf={room.type === 'self'}
            isGroup={room.type === 'group'}
          />
          <div>
            <h2 className="text-[19px] font-normal">{title}</h2>
            {room.type === 'direct' && peer && (
              <>
                <p className="text-[13.5px] text-[#8fa7cc]">@{peer.username}</p>
                <p className="text-[12.5px] text-[#8fa7cc] mt-0.5">
                  {isOnline
                    ? 'online'
                    : presenceMap[peer.uid]?.lastSeen
                      ? formatLastSeen(presenceMap[peer.uid]?.lastSeen)
                      : ''}
                </p>
              </>
            )}
            {room.type === 'group' && (
              <p className="text-[13px] text-[#8fa7cc]">
                Group · {Object.keys(room.members || {}).length} members
              </p>
            )}
          </div>
        </div>

        {room.type === 'group' && (
          <div className="space-y-1 pt-2 border-t border-[#17294d]">
            <p className="text-[13px] text-[#8fa7cc]">Description</p>
            <p className="text-[14.5px]">{room.description || 'No group description'}</p>
          </div>
        )}

        {room.type === 'direct' && peerUid && friendsMap[peerUid] && (
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#8fa7cc]">Nickname</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={peer?.displayName || 'Nickname'}
                className={`flex-1 px-3 py-2 rounded-[8px] text-[13.5px] outline-none ${
                  isLight ? 'bg-[#eaf1fc]' : 'bg-[#12254a]'
                }`}
              />
              <button
                onClick={handleSaveNickname}
                className="px-3 py-2 rounded-[8px] bg-[#3b82f6] text-white cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Shared Media */}
        <div className="space-y-2 pt-2 border-t border-[#17294d]">
          <div className="flex items-center justify-between text-[13px] text-[#8fa7cc]">
            <span>Media</span>
            <span>{sharedThumbs.length}</span>
          </div>

          {sharedThumbs.length === 0 ? (
            <p className="text-[13px] text-[#8fa7cc] py-1">No media shared</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {sharedThumbs.map((item) => (
                <img
                  key={item.id}
                  src={item.url}
                  alt="Shared"
                  onClick={() => onOpenLightbox(item.url, item.caption)}
                  className="aspect-square w-full object-cover rounded-[4px] cursor-zoom-in hover:opacity-90 transition"
                />
              ))}
            </div>
          )}
        </div>

        {/* Group Members */}
        {room.type === 'group' && (
          <div className="space-y-2.5 pt-2 border-t border-[#17294d]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#8fa7cc]">
                {Object.keys(room.members || {}).length} members
              </span>
              {nonGroupFriends.length > 0 && (
                <button
                  onClick={() => setAddingMembers(!addingMembers)}
                  className="text-[13px] text-[#3b82f6] flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add member
                </button>
              )}
            </div>

            {addingMembers && (
              <div
                className={`rounded-[8px] p-3 space-y-2 ${
                  isLight ? 'bg-[#eaf1fc]' : 'bg-[#12254a]'
                }`}
              >
                {nonGroupFriends.map((f) => {
                  const u = usersMap[f.uid];
                  const checked = Boolean(selectedNewMembers[f.uid]);
                  return (
                    <label
                      key={f.uid}
                      className="flex items-center justify-between text-[13.5px] py-1 cursor-pointer"
                    >
                      <span>{u?.displayName || f.uid}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedNewMembers({ ...selectedNewMembers, [f.uid]: !checked })
                        }
                        className="accent-[#3b82f6]"
                      />
                    </label>
                  );
                })}
                <button
                  onClick={async () => {
                    const uids = Object.keys(selectedNewMembers).filter(
                      (u) => selectedNewMembers[u]
                    );
                    if (!uids.length) return;
                    await addMembersToGroup(me, room, uids);
                    setSelectedNewMembers({});
                    setAddingMembers(false);
                    onToast('Added to group');
                  }}
                  className="w-full py-1.5 rounded-[6px] bg-[#3b82f6] text-white text-[13px] font-medium cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              {Object.keys(room.members || {}).map((mUid) => {
                const u = mUid === me.uid ? me : usersMap[mUid];
                const isAdmin = Boolean(room.admins?.[mUid]);
                const mOnline = Boolean(
                  mUid === me.uid
                    ? !me.privacy?.hideOnline
                    : presenceMap[mUid]?.online && !presenceMap[mUid]?.hidden
                );
                return (
                  <div key={mUid} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={u?.displayName || 'Member'} src={u?.photoURL} size="xs" online={mOnline} />
                      <span className="text-[14px] truncate">
                        {mUid === me.uid ? 'You' : u?.displayName || 'Member'}
                      </span>
                    </div>
                    {isAdmin && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#3b82f6]/15 text-[#3b82f6]">
                        Group admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-1 pt-2 border-t border-[#17294d]">
          {meta && (
            <>
              <button
                onClick={() => updateUserChatFlags(me.uid, room.id, { favorite: !meta.favorite })}
                className="w-full py-2.5 px-2 rounded-[6px] text-[14px] flex items-center gap-3 hover:bg-black/10 cursor-pointer"
              >
                <Heart className="w-4 h-4 text-[#8fa7cc]" />
                {meta.favorite ? 'Remove from favorites' : 'Add to favorites'}
              </button>

              <button
                onClick={() => onToggleLock(room.id)}
                className="w-full py-2.5 px-2 rounded-[6px] text-[14px] flex items-center gap-3 hover:bg-black/10 cursor-pointer"
              >
                {meta.lockHash ? (
                  <LockOpen className="w-4 h-4 text-[#8fa7cc]" />
                ) : (
                  <Lock className="w-4 h-4 text-[#8fa7cc]" />
                )}
                {meta.lockHash ? 'Remove chat lock' : 'Lock chat'}
              </button>

              <button
                onClick={() => updateUserChatFlags(me.uid, room.id, { muted: !meta.muted })}
                className="w-full py-2.5 px-2 rounded-[6px] text-[14px] flex items-center gap-3 hover:bg-black/10 cursor-pointer"
              >
                <BellOff className="w-4 h-4 text-[#8fa7cc]" />
                {meta.muted ? 'Unmute notifications' : 'Mute notifications'}
              </button>

              <button
                onClick={() => {
                  if (window.confirm('Clear messages in this chat?')) {
                    updateUserChatFlags(me.uid, room.id, { clearedAt: Date.now() });
                    onToast('Chat cleared');
                  }
                }}
                className="w-full py-2.5 px-2 rounded-[6px] text-[14px] flex items-center gap-3 text-[#f15c6d] hover:bg-[#f15c6d]/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Clear chat
              </button>
            </>
          )}

          {room.type === 'direct' && peerUid && (
            <button
              onClick={async () => {
                await setBlockedUser(me.uid, peerUid, !isBlocked);
                onToast(isBlocked ? 'Unblocked' : 'Blocked');
              }}
              className="w-full py-2.5 px-2 rounded-[6px] text-[14px] flex items-center gap-3 text-[#f15c6d] hover:bg-[#f15c6d]/10 cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              {isBlocked ? `Unblock ${title}` : `Block ${title}`}
            </button>
          )}

          {room.type === 'group' && (
            <button
              onClick={async () => {
                if (window.confirm(`Exit group "${room.name}"?`)) {
                  await leaveGroupChat(me, room);
                  onLeftGroup();
                }
              }}
              className="w-full py-2.5 px-2 rounded-[6px] text-[14px] flex items-center gap-3 text-[#f15c6d] hover:bg-[#f15c6d]/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Exit group
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
