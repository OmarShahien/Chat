import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  MessageSquare,
  Search,
  UserMinus,
  X,
} from 'lucide-react';
import type {
  FriendRecord,
  FriendRequest,
  PresenceState,
  ThemeMode,
  UserProfile,
} from '../types';
import {
  acceptFriendRequest,
  cancelOutgoingFriendRequest,
  declineFriendRequest,
  ensureDirectChatOpen,
  lookupUserByQuery,
  removeFriend,
  sendFriendRequest,
  setBlockedUser,
} from '../services/chatService';
import { formatLastSeen } from '../utils/formatters';
import { Avatar } from './Avatar';

interface FriendsPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  friendsMap: Record<string, FriendRecord>;
  usersMap: Record<string, UserProfile>;
  presenceMap: Record<string, PresenceState>;
  incomingRequests: Record<string, FriendRequest>;
  outgoingRequests: Record<string, FriendRequest>;
  blocksMap: Record<string, boolean>;
  initialInviteCode?: string | null;
  onConsumeInviteCode?: () => void;
  onOpenChat: (chatId: string) => void;
  onToast: (msg: string) => void;
}

export const FriendsPane: React.FC<FriendsPaneProps> = ({
  me,
  theme,
  friendsMap,
  usersMap,
  presenceMap,
  incomingRequests,
  outgoingRequests,
  blocksMap,
  initialInviteCode,
  onConsumeInviteCode,
  onOpenChat,
  onToast,
}) => {
  const [queryText, setQueryText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const isLight = theme === 'light';

  useEffect(() => {
    if (initialInviteCode) {
      setQueryText(initialInviteCode);
      handleSearch(initialInviteCode);
      onConsumeInviteCode?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInviteCode]);

  const handleSearch = async (override?: string) => {
    const q = (override ?? queryText).trim();
    if (!q) return;
    setSearching(true);
    setFoundUser(null);
    setLookupMessage(null);
    try {
      const user = await lookupUserByQuery(q);
      if (!user) {
        setLookupMessage('No user found with that email, username, or code.');
      } else if (user.uid === me.uid) {
        setLookupMessage('That is your own account.');
      } else {
        setFoundUser(user);
      }
    } catch (err: unknown) {
      setLookupMessage((err as Error).message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!foundUser) return;
    setBusyUid(foundUser.uid);
    try {
      const res = await sendFriendRequest(me, foundUser, noteText);
      if (res === 'auto-accepted') {
        onToast(`Added ${foundUser.displayName}`);
      } else {
        onToast(`Request sent to ${foundUser.displayName}`);
      }
      setFoundUser(null);
      setQueryText('');
      setNoteText('');
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not send request');
    } finally {
      setBusyUid(null);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(me.friendCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    onToast('Code copied');
  };

  const handleCopyInviteLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('invite', me.friendCode);
    await navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onToast('Invite link copied');
  };

  const incomingList = Object.values(incomingRequests)
    .filter((r): r is FriendRequest => Boolean(r && r.fromUid))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const outgoingList = Object.values(outgoingRequests)
    .filter((r): r is FriendRequest => Boolean(r && r.toUid))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const friendRecords = Object.values(friendsMap)
    .filter((r): r is FriendRecord => Boolean(r && r.uid))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const blockedUids = Object.keys(blocksMap).filter((u) => blocksMap[u]);

  return (
    <div
      className={`flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-6 ${
        isLight ? 'bg-white text-[#0a1630]' : 'bg-[#0a1630] text-[#eaf2ff]'
      }`}
    >
      {/* Header */}
      <div className="h-[59px] px-4 flex items-center shrink-0">
        <h1 className="text-[22px] font-bold">Contacts</h1>
      </div>

      <div className="px-4 pb-6 space-y-6">
        {/* Add Contact Search */}
        <div className="space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex gap-2"
          >
            <div
              className={`flex-1 flex items-center gap-2.5 px-3 h-[38px] rounded-[8px] text-[14px] ${
                isLight ? 'bg-[#eaf1fc]' : 'bg-[#12254a]'
              }`}
            >
              <Search className="w-4 h-4 text-[#8fa7cc] shrink-0" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Add by email, @username, or code"
                className="w-full bg-transparent outline-none text-[14px] placeholder-[#8fa7cc]"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !queryText.trim()}
              className="px-4 h-[38px] rounded-[8px] bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-50 text-white text-[13.5px] font-medium transition cursor-pointer shrink-0"
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>

          {/* My Shareable Details */}
          <div className="flex items-center justify-between text-[12.5px] text-[#8fa7cc] px-0.5 pt-0.5">
            <span>
              Your code: <strong className="text-current font-mono">{me.friendCode}</strong> · @{me.username}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-[#3b82f6] hover:underline cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
              <button
                onClick={handleCopyInviteLink}
                className="inline-flex items-center gap-1 text-[#3b82f6] hover:underline cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                Invite link
              </button>
            </div>
          </div>

          {lookupMessage && (
            <p className="text-[13px] text-[#f15c6d] px-0.5">{lookupMessage}</p>
          )}

          {foundUser && (
            <div
              className={`rounded-[8px] p-3.5 border space-y-3 ${
                isLight ? 'bg-[#eaf1fc] border-[#cfdcf0]' : 'bg-[#12254a] border-[#1d3764]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar name={foundUser.displayName} src={foundUser.photoURL} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px] truncate">{foundUser.displayName}</p>
                  <p className="text-[13px] text-[#8fa7cc] truncate">@{foundUser.username}</p>
                </div>
              </div>

              {friendsMap[foundUser.uid] ? (
                <button
                  onClick={async () => {
                    try {
                      const cId = await ensureDirectChatOpen(me, foundUser.uid);
                      onOpenChat(cId);
                    } catch (err: unknown) {
                      onToast((err as Error).message || 'Could not open chat');
                    }
                  }}
                  className="w-full py-2 rounded-[6px] bg-[#3b82f6] text-white text-[13.5px] font-medium cursor-pointer"
                >
                  Open chat
                </button>
              ) : outgoingRequests[foundUser.uid] ? (
                <p className="text-[13px] text-[#8fa7cc] text-center py-1">Request pending</p>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a message (optional)"
                    className={`w-full px-3 py-2 rounded-[6px] text-[13px] outline-none border ${
                      isLight ? 'bg-white border-[#cfdcf0]' : 'bg-[#0a1630] border-[#1d3764]'
                    }`}
                  />
                  <button
                    onClick={handleSendRequest}
                    disabled={busyUid === foundUser.uid}
                    className="w-full py-2 rounded-[6px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[13.5px] font-medium transition cursor-pointer"
                  >
                    {busyUid === foundUser.uid ? 'Sending...' : 'Add friend'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Incoming Requests */}
        {incomingList.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-[#3b82f6]">
              Friend requests ({incomingList.length})
            </h2>
            <div className="space-y-2">
              {incomingList.map((req) => (
                <div
                  key={req.fromUid}
                  className={`rounded-[8px] p-3 border flex items-center justify-between gap-3 ${
                    isLight ? 'bg-[#eaf1fc] border-[#cfdcf0]' : 'bg-[#12254a] border-[#1d3764]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={req.fromName} src={req.fromPhoto} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-medium truncate">{req.fromName}</p>
                      <p className="text-[12.5px] text-[#8fa7cc] truncate">@{req.fromUsername}</p>
                      {req.message && (
                        <p className="text-[12.5px] text-[#8fa7cc] mt-0.5 truncate">
                          "{req.message}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={async () => {
                        setBusyUid(req.fromUid);
                        try {
                          const chatId = await acceptFriendRequest(me, req);
                          onOpenChat(chatId);
                        } catch (e: unknown) {
                          onToast((e as Error).message || 'Could not accept');
                        } finally {
                          setBusyUid(null);
                        }
                      }}
                      disabled={busyUid === req.fromUid}
                      className="px-3 py-1.5 rounded-[6px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[13px] font-medium cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineFriendRequest(me.uid, req.fromUid)}
                      title="Decline"
                      className="p-1.5 rounded-[6px] text-[#8fa7cc] hover:text-[#f15c6d] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent Requests */}
        {outgoingList.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-[13px] font-medium text-[#8fa7cc]">
              Sent ({outgoingList.length})
            </h2>
            {outgoingList.map((req) => (
              <div
                key={req.toUid}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={req.toName || 'User'} src={req.toPhoto} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[14.5px] truncate">{req.toName || 'User'}</p>
                    <p className="text-[12.5px] text-[#8fa7cc] truncate">Pending</p>
                  </div>
                </div>
                <button
                  onClick={() => cancelOutgoingFriendRequest(me.uid, req.toUid)}
                  className="text-[13px] text-[#8fa7cc] hover:text-[#f15c6d] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Contacts List */}
        <div className="space-y-1">
          <h2 className="text-[13px] font-medium text-[#3b82f6] pb-1">
            Contacts ({friendRecords.length})
          </h2>

          {friendRecords.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-[#8fa7cc]">
              No contacts yet
            </p>
          ) : (
            friendRecords.map((rec) => {
              const friend = usersMap[rec.uid];
              const pres = presenceMap[rec.uid];
              const isOnline = Boolean(pres?.online && !pres?.hidden);
              const name = rec.nickname || friend?.displayName || 'Contact';

              return (
                <div
                  key={rec.uid}
                  className={`rounded-[8px] p-2 flex items-center justify-between gap-2 transition ${
                    isLight ? 'hover:bg-[#f1f6fd]' : 'hover:bg-[#12254a]'
                  }`}
                >
                  <div
                    onClick={async () => {
                      try {
                        const chatId = await ensureDirectChatOpen(me, rec.uid);
                        onOpenChat(chatId);
                      } catch (err: unknown) {
                        onToast((err as Error).message || 'Could not open chat');
                      }
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <Avatar
                      name={name}
                      src={friend?.photoURL}
                      size="md"
                      online={isOnline}
                    />
                    <div className="min-w-0">
                      <p className="text-[15px] truncate">{name}</p>
                      <p className="text-[13px] text-[#8fa7cc] truncate">
                        {isOnline ? (
                          <span className="text-[#3b82f6]">online</span>
                        ) : pres?.hidden ? (
                          `@${friend?.username || ''}`
                        ) : pres?.lastSeen ? (
                          formatLastSeen(pres.lastSeen)
                        ) : (
                          `@${friend?.username || ''}`
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={async () => {
                        try {
                          const chatId = await ensureDirectChatOpen(me, rec.uid);
                          onOpenChat(chatId);
                        } catch (err: unknown) {
                          onToast((err as Error).message || 'Could not open chat');
                        }
                      }}
                      title="Message"
                      className="p-2 rounded-full text-[#8fa7cc] hover:text-[#3b82f6] cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      onClick={async () => {
                        if (window.confirm(`Remove ${name} from contacts?`)) {
                          await removeFriend(me.uid, rec.uid);
                          onToast(`Removed ${name}`);
                        }
                      }}
                      title="Remove"
                      className="p-2 rounded-full text-[#8fa7cc] hover:text-[#f15c6d] cursor-pointer"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Blocked Contacts */}
        {blockedUids.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-[#17294d]">
            <h2 className="text-[13px] font-medium text-[#8fa7cc]">
              Blocked ({blockedUids.length})
            </h2>
            {blockedUids.map((bUid) => {
              const u = usersMap[bUid];
              return (
                <div key={bUid} className="flex items-center justify-between text-[13.5px] py-1.5">
                  <span>{u?.displayName || bUid}</span>
                  <button
                    onClick={async () => {
                      await setBlockedUser(me.uid, bUid, false);
                      onToast('Unblocked');
                    }}
                    className="text-[#3b82f6] hover:underline cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
