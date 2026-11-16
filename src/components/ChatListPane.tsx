import React, { useMemo, useState } from 'react';
import {
  Archive,
  BellOff,
  CheckCheck,
  Clock,
  Heart,
  Lock,
  LockOpen,
  MoreVertical,
  Pin,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  ChatRoom,
  FriendRecord,
  PresenceState,
  ThemeMode,
  TypingEntry,
  UserChatMeta,
  UserProfile,
} from '../types';
import { formatChatListTime } from '../utils/formatters';
import { updateUserChatFlags } from '../services/chatService';
import { Avatar } from './Avatar';
import { TypingDots } from './TypingDots';

interface ChatListPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  userChats: Record<string, UserChatMeta>;
  chatRooms: Record<string, ChatRoom>;
  usersMap: Record<string, UserProfile>;
  friendsMap: Record<string, FriendRecord>;
  presenceMap: Record<string, PresenceState>;
  typingMap: Record<string, Record<string, TypingEntry>>;
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenAddFriend: () => void;
  onOpenNewGroup: () => void;
  onToggleLock: (chatId: string) => void;
}

type ChatFilter = 'all' | 'unread' | 'favorites' | 'groups' | 'archived';

export const ChatListPane: React.FC<ChatListPaneProps> = ({
  me,
  theme,
  userChats,
  chatRooms,
  usersMap,
  friendsMap,
  presenceMap,
  typingMap,
  activeChatId,
  onSelectChat,
  onOpenAddFriend,
  onOpenNewGroup,
  onToggleLock,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [menuChatId, setMenuChatId] = useState<string | null>(null);

  const isLight = theme === 'light';

  const archivedCount = useMemo(
    () => Object.values(userChats).filter((c) => Boolean(c && c.archived)).length,
    [userChats]
  );

  const items = useMemo(() => {
    const list = Object.values(userChats)
      .filter((meta): meta is UserChatMeta => Boolean(meta && meta.chatId))
      .map((meta) => {
        const room = chatRooms[meta.chatId];
        const peerUid =
          meta.peerUid ||
          (room?.type === 'direct'
            ? Object.keys(room.members || {}).find((u) => u !== me.uid)
            : undefined);
        const peerUser = peerUid ? usersMap[peerUid] : undefined;
        const friendRec = peerUid ? friendsMap[peerUid] : undefined;

        let title = 'Chat';
        let avatar = '';
        if (meta.type === 'self' || room?.type === 'self') {
          title = `${me.displayName} (You)`;
          avatar = me.photoURL;
        } else if (meta.type === 'group' || room?.type === 'group') {
          title = room?.name || 'Group';
          avatar = room?.photoURL || '';
        } else if (peerUser) {
          title = friendRec?.nickname || peerUser.displayName || peerUser.username || 'Chat';
          avatar = peerUser.photoURL || '';
        }

        const online = Boolean(
          peerUid &&
            presenceMap[peerUid]?.online &&
            !presenceMap[peerUid]?.hidden
        );

        const roomTyping = typingMap[meta.chatId] || {};
        const activeTypers = Object.entries(roomTyping)
          .filter(
            ([uid, entry]) =>
              uid !== me.uid &&
              Boolean(entry) &&
              typeof entry === 'object' &&
              Date.now() - (entry.updatedAt || 0) < 8000
          )
          .map(([, entry]) => entry);

        return {
          meta,
          room,
          peerUid,
          peerUser,
          title,
          avatar,
          online,
          activeTypers,
        };
      });

    return list
      .filter((item) => {
        if (filter === 'archived') {
          if (!item.meta.archived) return false;
        } else if (item.meta.archived) {
          return false;
        }

        if (filter === 'unread' && !(item.meta.unreadCount > 0)) return false;
        if (filter === 'favorites' && !item.meta.favorite) return false;
        if (filter === 'groups' && item.meta.type !== 'group') return false;

        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchLast =
            !item.meta.lockHash &&
            (item.meta.lastMessageText || '').toLowerCase().includes(q);
          const matchUsername = (item.peerUser?.username || '').toLowerCase().includes(q);
          return matchTitle || matchLast || matchUsername;
        }

        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.meta.pinned) !== Boolean(b.meta.pinned)) {
          return a.meta.pinned ? -1 : 1;
        }
        return (b.meta.lastMessageAt || 0) - (a.meta.lastMessageAt || 0);
      });
  }, [userChats, chatRooms, usersMap, friendsMap, presenceMap, typingMap, me, filter, search]);

  const filters: Array<{ id: ChatFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'groups', label: 'Groups' },
    ...(archivedCount > 0 || filter === 'archived'
      ? [{ id: 'archived' as ChatFilter, label: `Archived (${archivedCount})` }]
      : []),
  ];

  return (
    <div
      className={`flex flex-col h-full w-full select-none ${
        isLight ? 'bg-white text-[#0a1630]' : 'bg-[#0a1630] text-[#eaf2ff]'
      }`}
    >
      {/* Header */}
      <div className="h-[59px] px-4 flex items-center justify-between shrink-0">
        <h1 className="text-[22px] font-bold">Chats</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenAddFriend}
            title="Add contact"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLight
                ? 'hover:bg-[#eaf1fc] text-[#4a5f80]'
                : 'hover:bg-[#12254a] text-[#a9bddb]'
            }`}
          >
            <UserPlus className="w-[20px] h-[20px]" />
          </button>

          <button
            onClick={onOpenNewGroup}
            title="New group"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLight
                ? 'hover:bg-[#eaf1fc] text-[#4a5f80]'
                : 'hover:bg-[#12254a] text-[#a9bddb]'
            }`}
          >
            <Users className="w-[20px] h-[20px]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div
          className={`flex items-center gap-3 px-3 h-[35px] rounded-[8px] text-[14px] ${
            isLight ? 'bg-[#eaf1fc] text-[#0a1630]' : 'bg-[#12254a] text-[#eaf2ff]'
          }`}
        >
          <Search className="w-4 h-4 text-[#8fa7cc] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent outline-none placeholder-[#8fa7cc] text-[14px]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#8fa7cc] hover:text-current cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-full text-[13px] whitespace-nowrap transition cursor-pointer ${
                active
                  ? isLight
                    ? 'bg-[#dbeafe] text-[#1d4ed8] font-medium'
                    : 'bg-[#14336b] text-[#3b82f6] font-medium'
                  : isLight
                    ? 'bg-[#eaf1fc] text-[#4a5f80] hover:bg-[#dde8f8]'
                    : 'bg-[#12254a] text-[#8fa7cc] hover:bg-[#1d3764]'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Chat Rows */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {items.length === 0 ? (
          <div className="px-6 py-14 text-center space-y-3">
            <p className="text-[14px] text-[#8fa7cc]">
              {search ? 'No chats found' : 'No chats yet'}
            </p>
            {!search && (
              <button
                onClick={onOpenAddFriend}
                className="text-[14px] text-[#3b82f6] hover:underline font-medium cursor-pointer"
              >
                Add a friend to start chatting
              </button>
            )}
          </div>
        ) : (
          items.map((item) => {
            const selected = activeChatId === item.meta.chatId;
            const unread = item.meta.unreadCount || 0;
            const isOutgoingLast = item.meta.lastMessageSenderId === me.uid;
            const typer = item.activeTypers[0];

            return (
              <div
                key={item.meta.chatId}
                onClick={() => onSelectChat(item.meta.chatId)}
                className={`group relative pl-3 pr-0 flex items-center gap-3 cursor-pointer transition ${
                  selected
                    ? isLight
                      ? 'bg-[#eaf1fc]'
                      : 'bg-[#1d3764]'
                    : isLight
                      ? 'hover:bg-[#f1f6fd]'
                      : 'hover:bg-[#12254a]'
                }`}
              >
                <Avatar
                  name={item.title}
                  src={item.avatar}
                  size="md"
                  online={item.online}
                  isSelf={item.meta.type === 'self'}
                  isGroup={item.meta.type === 'group'}
                />

                <div
                  className={`flex-1 min-w-0 py-3 pr-3.5 border-b ${
                    selected
                      ? 'border-transparent'
                      : isLight
                        ? 'border-[#dde8f8]'
                        : 'border-[#17294d]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[16px] font-normal truncate">{item.title}</span>
                    <span
                      className={`text-[12px] shrink-0 ${
                        unread > 0 ? 'text-[#3b82f6] font-medium' : 'text-[#8fa7cc]'
                      }`}
                    >
                      {formatChatListTime(item.meta.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="text-[13.5px] truncate flex items-center gap-1 min-w-0">
                      {item.meta.lockHash ? (
                        <span className="text-[#8fa7cc] truncate flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          Locked chat
                        </span>
                      ) : typer ? (
                        <span className="text-[#3b82f6] flex items-center gap-1 font-medium">
                          <span>
                            {item.meta.type === 'group' ? `${typer.name}: ` : ''}
                            {typer.state === 'recording' ? 'recording audio' : 'typing'}
                          </span>
                          <TypingDots size="xs" />
                        </span>
                      ) : (
                        <>
                          {isOutgoingLast && item.meta.lastMessageType !== 'system' && (
                            <CheckCheck className="w-4 h-4 shrink-0 text-[#53bdeb]" />
                          )}
                          <span className="text-[#8fa7cc] truncate">
                            {item.meta.lastMessageText || ''}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {Boolean(item.meta.disappearingTimer) && (
                        <Clock className="w-3.5 h-3.5 text-[#8fa7cc]" />
                      )}
                      {item.meta.favorite && (
                        <Heart className="w-3.5 h-3.5 text-[#8fa7cc] fill-[#8fa7cc]" />
                      )}
                      {item.meta.muted && <BellOff className="w-3.5 h-3.5 text-[#8fa7cc]" />}
                      {item.meta.pinned && <Pin className="w-3.5 h-3.5 text-[#8fa7cc] rotate-45" />}
                      {unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#3b82f6] text-white text-[11.5px] font-semibold flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuChatId(menuChatId === item.meta.chatId ? null : item.meta.chatId);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#8fa7cc] hover:text-current transition cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {menuChatId === item.meta.chatId && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseLeave={() => setMenuChatId(null)}
                    className={`absolute right-3 top-12 z-30 w-48 rounded-[6px] border shadow-lg py-1.5 text-[13.5px] ${
                      isLight
                        ? 'bg-white border-[#cfdcf0] text-[#34476a]'
                        : 'bg-[#16294d] border-[#1d3764] text-[#cfdcf0]'
                    }`}
                  >
                    <button
                      onClick={() => {
                        onToggleLock(item.meta.chatId);
                        setMenuChatId(null);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
                    >
                      {item.meta.lockHash ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      {item.meta.lockHash ? 'Remove lock' : 'Lock chat'}
                    </button>
                    <button
                      onClick={() => {
                        updateUserChatFlags(me.uid, item.meta.chatId, {
                          pinned: !item.meta.pinned,
                        });
                        setMenuChatId(null);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Pin className="w-4 h-4" />
                      {item.meta.pinned ? 'Unpin chat' : 'Pin chat'}
                    </button>
                    <button
                      onClick={() => {
                        updateUserChatFlags(me.uid, item.meta.chatId, {
                          favorite: !item.meta.favorite,
                        });
                        setMenuChatId(null);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Heart className="w-4 h-4" />
                      {item.meta.favorite ? 'Remove favorite' : 'Add to favorites'}
                    </button>
                    <button
                      onClick={() => {
                        updateUserChatFlags(me.uid, item.meta.chatId, {
                          muted: !item.meta.muted,
                        });
                        setMenuChatId(null);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
                    >
                      <BellOff className="w-4 h-4" />
                      {item.meta.muted ? 'Unmute' : 'Mute'}
                    </button>
                    {item.meta.type !== 'self' && (
                      <button
                        onClick={() => {
                          updateUserChatFlags(me.uid, item.meta.chatId, {
                            archived: !item.meta.archived,
                          });
                          setMenuChatId(null);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Archive className="w-4 h-4" />
                        {item.meta.archived ? 'Unarchive' : 'Archive'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
