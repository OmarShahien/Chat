import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { auth, db } from './firebase';
import type {
  ChatMessage,
  ChatRoom,
  FriendRecord,
  FriendRequest,
  PresenceState,
  ThemeMode,
  TypingEntry,
  UserChatMeta,
  UserProfile,
} from './types';
import {
  bootstrapUserProfile,
  markBackgroundMessagesDelivered,
  setChatLock,
  setOfflinePresence,
  startPresenceTracking,
  updateMyProfile,
} from './services/chatService';
import { hashChatPasscode } from './utils/chatLock';
import { playUiSound } from './utils/media';
import { AuthScreen } from './components/AuthScreen';
import { ChatListPane } from './components/ChatListPane';
import { ConversationPane } from './components/ConversationPane';
import { FriendsPane } from './components/FriendsPane';
import {
  ForwardModal,
  ImageLightbox,
  LockDialog,
  NewGroupModal,
  type LockDialogMode,
} from './components/Modals';
import { NavRail, type SidebarTab } from './components/NavRail';
import { SettingsPane } from './components/SettingsPane';

export const App: React.FC = () => {
  const [authChecking, setAuthChecking] = useState(true);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  const [userChats, setUserChats] = useState<Record<string, UserChatMeta>>({});
  const [chatRooms, setChatRooms] = useState<Record<string, ChatRoom>>({});
  const [friendsMap, setFriendsMap] = useState<Record<string, FriendRecord>>({});
  const [incomingRequests, setIncomingRequests] = useState<Record<string, FriendRequest>>({});
  const [outgoingRequests, setOutgoingRequests] = useState<Record<string, FriendRequest>>({});
  const [blocksMap, setBlocksMap] = useState<Record<string, boolean>>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceState>>({});
  const [typingMap, setTypingMap] = useState<Record<string, Record<string, TypingEntry>>>({});

  const [lockDialog, setLockDialog] = useState<{ chatId: string; mode: LockDialogMode } | null>(null);
  // Chats the user has unlocked in this session. A chat re-locks as soon as it is closed.
  const [unlockedChats, setUnlockedChats] = useState<Record<string, boolean>>({});

  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string; isViewOnce?: boolean } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || params.get('add');
  });

  const prevLastMsgIdMapRef = useRef<Record<string, string>>({});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setMe(null);
        setAuthChecking(false);
        return;
      }

      try {
        setBootError(null);
        const profile = await bootstrapUserProfile(fbUser);
        setMe(profile);
        if (profile.theme) setTheme(profile.theme);
      } catch {
        setBootError('Could not load your account. Check your connection and try again.');
        await signOut(auth).catch(() => {});
        setMe(null);
      } finally {
        setAuthChecking(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (me && pendingInviteCode) {
      setSidebarTab('friends');
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('add');
      window.history.replaceState({}, '', url.toString());
    }
  }, [me, pendingInviteCode]);

  useEffect(() => {
    if (!me?.uid) return;
    const unsub = startPresenceTracking(me.uid, Boolean(me.privacy?.hideOnline));
    return () => unsub();
  }, [me?.uid, me?.privacy?.hideOnline]);

  useEffect(() => {
    if (!me?.uid) {
      setUserChats({});
      setFriendsMap({});
      setIncomingRequests({});
      setOutgoingRequests({});
      setBlocksMap({});
      return;
    }

    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      onValue(ref(db, `users/${me.uid}`), (snap) => {
        if (snap.exists()) {
          setMe(snap.val() as UserProfile);
        }
      })
    );

    unsubs.push(
      onValue(ref(db, `userChats/${me.uid}`), (snap) => {
        const map: Record<string, UserChatMeta> = snap.exists() ? snap.val() : {};
        setUserChats(map);

        Object.values(map).forEach((meta) => {
          const prevId = prevLastMsgIdMapRef.current[meta.chatId];
          if (
            meta.lastMessageId &&
            prevId &&
            prevId !== meta.lastMessageId &&
            meta.lastMessageSenderId !== me.uid
          ) {
            if (!meta.muted) {
              playUiSound('receive', me.privacy?.soundEnabled ?? true);
            }
            if (activeChatId !== meta.chatId) {
              markBackgroundMessagesDelivered(meta.chatId, me.uid);
            }
          }
          if (meta.lastMessageId) {
            prevLastMsgIdMapRef.current[meta.chatId] = meta.lastMessageId;
          }
        });
      })
    );

    unsubs.push(
      onValue(ref(db, `friends/${me.uid}`), (snap) => {
        setFriendsMap(snap.exists() ? snap.val() : {});
      })
    );

    unsubs.push(
      onValue(ref(db, `friendRequests/incoming/${me.uid}`), (snap) => {
        setIncomingRequests(snap.exists() ? snap.val() : {});
      })
    );

    unsubs.push(
      onValue(ref(db, `friendRequests/outgoing/${me.uid}`), (snap) => {
        setOutgoingRequests(snap.exists() ? snap.val() : {});
      })
    );

    unsubs.push(
      onValue(ref(db, `blocks/${me.uid}`), (snap) => {
        setBlocksMap(snap.exists() ? snap.val() : {});
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.uid]);

  const chatIdListKey = useMemo(() => Object.keys(userChats).sort().join(','), [userChats]);
  useEffect(() => {
    if (!me?.uid || !chatIdListKey) return;
    const ids = chatIdListKey.split(',').filter(Boolean);
    const unsubs: Unsubscribe[] = [];

    ids.forEach((cId) => {
      unsubs.push(
        onValue(ref(db, `chats/${cId}`), (snap) => {
          if (snap.exists()) {
            setChatRooms((prev) => ({ ...prev, [cId]: snap.val() as ChatRoom }));
          }
        })
      );

      unsubs.push(
        onValue(ref(db, `typing/${cId}`), (snap) => {
          setTypingMap((prev) => ({
            ...prev,
            [cId]: snap.exists() ? snap.val() : {},
          }));
        })
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [me?.uid, chatIdListKey]);

  const relevantPeerUidsKey = useMemo(() => {
    if (!me?.uid) return '';
    const set = new Set<string>();
    Object.keys(friendsMap).forEach((u) => set.add(u));
    Object.keys(blocksMap).forEach((u) => set.add(u));
    Object.values(userChats).forEach((m) => {
      if (m.peerUid) set.add(m.peerUid);
    });
    Object.values(chatRooms).forEach((r) => {
      Object.keys(r.members || {}).forEach((u) => {
        if (u !== me.uid) set.add(u);
      });
    });
    set.delete(me.uid);
    return Array.from(set).sort().join(',');
  }, [me?.uid, friendsMap, blocksMap, userChats, chatRooms]);

  useEffect(() => {
    if (!me?.uid || !relevantPeerUidsKey) return;
    const uids = relevantPeerUidsKey.split(',').filter(Boolean);
    const unsubs: Unsubscribe[] = [];

    uids.forEach((u) => {
      unsubs.push(
        onValue(ref(db, `users/${u}`), (snap) => {
          if (snap.exists()) {
            setUsersMap((prev) => ({ ...prev, [u]: snap.val() as UserProfile }));
          }
        })
      );
      unsubs.push(
        onValue(ref(db, `presence/${u}`), (snap) => {
          if (snap.exists()) {
            setPresenceMap((prev) => ({ ...prev, [u]: snap.val() as PresenceState }));
          }
        })
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [me?.uid, relevantPeerUidsKey]);

  // Re-lock every chat other than the one currently open.
  useEffect(() => {
    setUnlockedChats((prev) => {
      const keys = Object.keys(prev).filter((k) => prev[k] && k !== activeChatId);
      if (keys.length === 0) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }, [activeChatId]);

  const unreadChatsCount = useMemo(
    () =>
      Object.values(userChats).filter((c) => !c.archived && (c.unreadCount || 0) > 0).length,
    [userChats]
  );

  const incomingRequestsCount = useMemo(
    () => Object.keys(incomingRequests).length,
    [incomingRequests]
  );

  const isChatLocked = (chatId: string) =>
    Boolean(userChats[chatId]?.lockHash) && !unlockedChats[chatId];

  const chatTitleFor = (chatId: string) => {
    const meta = userChats[chatId];
    const room = chatRooms[chatId];
    if (meta?.type === 'self' || room?.type === 'self') return 'your notes';
    if (meta?.type === 'group' || room?.type === 'group') return room?.name || 'this group';
    const peerUid = meta?.peerUid;
    const nick = peerUid ? friendsMap[peerUid]?.nickname : undefined;
    return nick || (peerUid ? usersMap[peerUid]?.displayName : undefined) || 'this chat';
  };

  const openChat = (chatId: string) => {
    if (isChatLocked(chatId)) {
      setLockDialog({ chatId, mode: 'unlock' });
      return;
    }
    setActiveChatId(chatId);
  };

  const handleToggleLock = (chatId: string) => {
    setLockDialog({ chatId, mode: userChats[chatId]?.lockHash ? 'remove' : 'set' });
  };

  const handleLockSubmit = async (
    mode: LockDialogMode,
    passcode: string
  ): Promise<string | null> => {
    if (!me || !lockDialog) return null;
    const { chatId } = lockDialog;
    try {
      const hash = await hashChatPasscode(passcode, me.uid, chatId);
      if (mode === 'set') {
        await setChatLock(me.uid, chatId, hash);
        setUnlockedChats((prev) => ({ ...prev, [chatId]: true }));
        showToast('Chat locked');
      } else {
        if (hash !== userChats[chatId]?.lockHash) return 'Wrong passcode. Try again.';
        if (mode === 'remove') {
          await setChatLock(me.uid, chatId, null);
          showToast('Chat lock removed');
        } else {
          setUnlockedChats((prev) => ({ ...prev, [chatId]: true }));
          setActiveChatId(chatId);
        }
      }
      setLockDialog(null);
      return null;
    } catch {
      return 'Could not update the chat lock. Please try again.';
    }
  };

  const handleSignOut = async () => {
    if (me) {
      await setOfflinePresence(me.uid, Boolean(me.privacy?.hideOnline));
    }
    await signOut(auth);
    setActiveChatId(null);
    setUnlockedChats({});
  };

  const handleChangeTheme = async (next: ThemeMode) => {
    setTheme(next);
    if (me) {
      updateMyProfile(me, { theme: next }).catch(() => {});
    }
  };

  if (authChecking) {
    return (
      <div className="h-screen w-screen bg-[#0a1630] text-[#eaf2ff] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
        <p className="text-[13.5px] text-[#8fa7cc]">Chat Web</p>
      </div>
    );
  }

  if (!me) {
    return (
      <AuthScreen
        pendingInviteCode={pendingInviteCode}
        externalError={bootError}
      />
    );
  }

  // Never show a locked chat that has not been unlocked in this session.
  const visibleChatId =
    activeChatId && !isChatLocked(activeChatId) ? activeChatId : null;
  const activeRoom = visibleChatId ? chatRooms[visibleChatId] || null : null;
  const activeMeta = visibleChatId ? userChats[visibleChatId] : undefined;
  const isLight = theme === 'light';

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex ${
        isLight ? 'bg-[#eaf1fc] text-[#0a1630]' : 'bg-[#08122a] text-[#eaf2ff]'
      }`}
    >
      <div className={`${visibleChatId ? 'hidden md:flex' : 'flex'}`}>
        <NavRail
          activeTab={sidebarTab}
          onSelectTab={(t) => setSidebarTab(t)}
          unreadChatsCount={unreadChatsCount}
          incomingRequestsCount={incomingRequestsCount}
          theme={theme}
          onToggleTheme={() => handleChangeTheme(theme === 'dark' ? 'light' : 'dark')}
          me={me}
        />
      </div>

      <div
        className={`${
          visibleChatId ? 'hidden md:flex' : 'flex'
        } w-full md:w-[370px] lg:w-[400px] shrink-0 h-full border-r ${
          isLight ? 'border-[#cfdcf0]' : 'border-[#1d3764]'
        }`}
      >
        {sidebarTab === 'chats' && (
          <ChatListPane
            me={me}
            theme={theme}
            userChats={userChats}
            chatRooms={chatRooms}
            usersMap={usersMap}
            friendsMap={friendsMap}
            presenceMap={presenceMap}
            typingMap={typingMap}
            activeChatId={visibleChatId}
            onSelectChat={openChat}
            onToggleLock={handleToggleLock}
            onOpenAddFriend={() => setSidebarTab('friends')}
            onOpenNewGroup={() => setNewGroupOpen(true)}
          />
        )}

        {sidebarTab === 'friends' && (
          <FriendsPane
            me={me}
            theme={theme}
            friendsMap={friendsMap}
            usersMap={usersMap}
            presenceMap={presenceMap}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            blocksMap={blocksMap}
            initialInviteCode={pendingInviteCode}
            onConsumeInviteCode={() => setPendingInviteCode(null)}
            onOpenChat={(cId) => {
              openChat(cId);
              setSidebarTab('chats');
            }}
            onToast={showToast}
          />
        )}

        {sidebarTab === 'settings' && (
          <SettingsPane
            me={me}
            theme={theme}
            onProfileUpdated={(u) => setMe(u)}
            onChangeTheme={handleChangeTheme}
            onSignOut={handleSignOut}
            onToast={showToast}
          />
        )}
      </div>

      <div className={`${visibleChatId ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0`}>
        <ConversationPane
          me={me}
          theme="dark"
          room={activeRoom}
          meta={activeMeta}
          usersMap={usersMap}
          friendsMap={friendsMap}
          presenceMap={presenceMap}
          typingEntries={(visibleChatId && typingMap[visibleChatId]) || {}}
          blocksMap={blocksMap}
          onBackMobile={() => setActiveChatId(null)}
          onToggleLock={handleToggleLock}
          onForwardMessage={(m) => setForwardingMsg(m)}
          onOpenLightbox={(src, caption, isViewOnce) => setLightbox({ src, caption, isViewOnce })}
          onToast={showToast}
        />
      </div>

      <NewGroupModal
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        me={me}
        friendsMap={friendsMap}
        usersMap={usersMap}
        onCreated={(cId) => {
          setActiveChatId(cId);
          setSidebarTab('chats');
        }}
        onToast={showToast}
      />

      <LockDialog
        mode={lockDialog?.mode ?? null}
        chatTitle={lockDialog ? chatTitleFor(lockDialog.chatId) : ''}
        onClose={() => setLockDialog(null)}
        onSubmit={handleLockSubmit}
      />

      <ForwardModal
        message={forwardingMsg}
        onClose={() => setForwardingMsg(null)}
        me={me}
        userChats={userChats}
        chatRooms={chatRooms}
        usersMap={usersMap}
        onToast={showToast}
      />

      <ImageLightbox
        src={lightbox?.src || null}
        caption={lightbox?.caption}
        isViewOnce={lightbox?.isViewOnce}
        onClose={() => setLightbox(null)}
      />

      {toastMsg && (
        <div className="fixed bottom-18 md:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[6px] bg-[#12254a] border border-[#1d3764] text-[#eaf2ff] text-[13px] shadow-xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
