import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { get, onValue, ref, type Unsubscribe } from 'firebase/database';
import { auth, db } from './firebase';
import type {
  CallSession,
  ChatMessage,
  ChatRoom,
  FriendRecord,
  FriendRequest,
  PresenceState,
  StatusUpdate,
  ThemeMode,
  TypingEntry,
  UserChatMeta,
  UserProfile,
  WallpaperId,
} from './types';
import {
  bootstrapUserProfile,
  markBackgroundMessagesDelivered,
  setOfflinePresence,
  startPresenceTracking,
  updateMyProfile,
} from './services/chatService';
import {
  answerIncomingVoiceCall,
  declineIncomingVoiceCall,
  startOutgoingVoiceCall,
  type ActiveRtcController,
} from './services/callService';
import { playUiSound } from './utils/media';
import { AuthScreen } from './components/AuthScreen';
import { ChatListPane } from './components/ChatListPane';
import { ConversationPane } from './components/ConversationPane';
import { FriendsPane } from './components/FriendsPane';
import {
  CallOverlay,
  ForwardModal,
  ImageLightbox,
  NewGroupModal,
} from './components/Modals';
import { NavRail, type SidebarTab } from './components/NavRail';
import { SettingsPane } from './components/SettingsPane';
import { StarredPane } from './components/StarredPane';
import { StatusPane } from './components/StatusPane';

export const App: React.FC = () => {
  const [authChecking, setAuthChecking] = useState(true);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [wallpaper, setWallpaper] = useState<WallpaperId>('whatsapp-doodle');

  const [userChats, setUserChats] = useState<Record<string, UserChatMeta>>({});
  const [chatRooms, setChatRooms] = useState<Record<string, ChatRoom>>({});
  const [friendsMap, setFriendsMap] = useState<Record<string, FriendRecord>>({});
  const [incomingRequests, setIncomingRequests] = useState<Record<string, FriendRequest>>({});
  const [outgoingRequests, setOutgoingRequests] = useState<Record<string, FriendRequest>>({});
  const [blocksMap, setBlocksMap] = useState<Record<string, boolean>>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceState>>({});
  const [typingMap, setTypingMap] = useState<Record<string, Record<string, TypingEntry>>>({});
  const [statusesByUser, setStatusesByUser] = useState<Record<string, StatusUpdate[]>>({});
  const [cachedChatMessages, setCachedChatMessages] = useState<Record<string, ChatMessage[]>>({});

  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || params.get('add');
  });

  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const rtcControllerRef = useRef<ActiveRtcController | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

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
        if (profile.wallpaper) setWallpaper(profile.wallpaper);
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

    unsubs.push(
      onValue(ref(db, `userCalls/${me.uid}`), async (snap) => {
        if (!snap.exists()) return;
        const callsObj = snap.val() as Record<string, { callId: string; createdAt: number }>;
        const latest = Object.values(callsObj).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        )[0];
        if (!latest || Date.now() - (latest.createdAt || 0) > 45000) return;

        const callSnap = await get(ref(db, `calls/${latest.callId}`));
        if (!callSnap.exists()) return;
        const sess = callSnap.val() as CallSession;
        if (sess.status === 'ringing' && !rtcControllerRef.current) {
          setCallSession(sess);
          setIsIncomingCall(true);
          playUiSound('ring', me.privacy?.soundEnabled ?? true);
        }
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

  const statusUidsKey = useMemo(() => {
    if (!me?.uid) return '';
    return [me.uid, ...Object.keys(friendsMap)].sort().join(',');
  }, [me?.uid, friendsMap]);

  useEffect(() => {
    if (!me?.uid || !statusUidsKey) return;
    const uids = statusUidsKey.split(',').filter(Boolean);
    const unsubs: Unsubscribe[] = [];

    uids.forEach((u) => {
      unsubs.push(
        onValue(ref(db, `statuses/${u}`), (snap) => {
          const list: StatusUpdate[] = [];
          if (snap.exists()) {
            snap.forEach((child) => {
              list.push(child.val() as StatusUpdate);
            });
          }
          list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          setStatusesByUser((prev) => ({ ...prev, [u]: list }));
        })
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [me?.uid, statusUidsKey]);

  const unreadChatsCount = useMemo(
    () =>
      Object.values(userChats).filter((c) => !c.archived && (c.unreadCount || 0) > 0).length,
    [userChats]
  );

  const incomingRequestsCount = useMemo(
    () => Object.keys(incomingRequests).length,
    [incomingRequests]
  );

  const hasUnseenStatuses = useMemo(() => {
    if (!me?.uid) return false;
    const now = Date.now();
    return Object.entries(statusesByUser).some(([uid, list]) => {
      if (uid === me.uid) return false;
      return list.some((s) => s.expiresAt > now && !s.viewedBy?.[me.uid]);
    });
  }, [statusesByUser, me?.uid]);

  const starredMessages = useMemo(() => {
    if (!me?.uid) return [];
    const all: ChatMessage[] = [];
    Object.values(cachedChatMessages).forEach((list) => {
      list.forEach((m) => {
        if (m.starredBy?.[me.uid] && !m.deletedForEveryone && !m.deletedFor?.[me.uid]) {
          all.push(m);
        }
      });
    });
    return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [cachedChatMessages, me?.uid]);

  const attachRemoteStream = (stream: MediaStream) => {
    if (remoteAudioElRef.current) {
      remoteAudioElRef.current.srcObject = stream;
      remoteAudioElRef.current.play().catch(() => {});
    }
  };

  const handleStartVoiceCall = async (friend: UserProfile) => {
    if (!me) return;
    try {
      setIsIncomingCall(false);
      setCallMuted(false);
      const ctrl = await startOutgoingVoiceCall(me, friend, attachRemoteStream, (sess) => {
        if (!sess || sess.status === 'ended' || sess.status === 'declined') {
          rtcControllerRef.current?.hangup().catch(() => {});
          rtcControllerRef.current = null;
          setCallSession(null);
          if (sess?.status === 'declined') showToast('Call declined');
        } else {
          setCallSession(sess);
        }
      });
      rtcControllerRef.current = ctrl;
    } catch {
      showToast('Microphone access is needed for voice calls.');
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!callSession) return;
    try {
      setIsIncomingCall(false);
      setCallMuted(false);
      const ctrl = await answerIncomingVoiceCall(callSession, attachRemoteStream, (sess) => {
        if (!sess || sess.status === 'ended' || sess.status === 'declined') {
          rtcControllerRef.current?.hangup().catch(() => {});
          rtcControllerRef.current = null;
          setCallSession(null);
        } else {
          setCallSession(sess);
        }
      });
      rtcControllerRef.current = ctrl;
    } catch {
      showToast('Could not access microphone.');
      handleDeclineIncomingCall();
    }
  };

  const handleDeclineIncomingCall = async () => {
    if (me && callSession) {
      await declineIncomingVoiceCall(me.uid, callSession.id);
    }
    setCallSession(null);
    setIsIncomingCall(false);
  };

  const handleHangupCall = async () => {
    await rtcControllerRef.current?.hangup();
    rtcControllerRef.current = null;
    setCallSession(null);
    setIsIncomingCall(false);
  };

  const handleSignOut = async () => {
    if (me) {
      await setOfflinePresence(me.uid, Boolean(me.privacy?.hideOnline));
    }
    await signOut(auth);
    setActiveChatId(null);
  };

  const handleChangeTheme = async (next: ThemeMode) => {
    setTheme(next);
    if (me) {
      updateMyProfile(me, { theme: next }).catch(() => {});
    }
  };

  const handleChangeWallpaper = async (next: WallpaperId) => {
    setWallpaper(next);
    if (me) {
      updateMyProfile(me, { wallpaper: next }).catch(() => {});
    }
  };

  if (authChecking) {
    return (
      <div className="h-screen w-screen bg-[#111b21] text-[#e9edef] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-[#00a884] border-t-transparent animate-spin" />
        <p className="text-[13.5px] text-[#8696a0]">Chat Web</p>
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

  const activeRoom = activeChatId ? chatRooms[activeChatId] || null : null;
  const activeMeta = activeChatId ? userChats[activeChatId] : undefined;
  const isLight = theme === 'light';

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex ${
        isLight ? 'bg-[#f0f2f5] text-[#111b21]' : 'bg-[#0b141a] text-[#e9edef]'
      }`}
    >
      <audio ref={remoteAudioElRef} autoPlay playsInline className="hidden" />

      <div className={`${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        <NavRail
          activeTab={sidebarTab}
          onSelectTab={(t) => setSidebarTab(t)}
          unreadChatsCount={unreadChatsCount}
          incomingRequestsCount={incomingRequestsCount}
          hasUnseenStatuses={hasUnseenStatuses}
          theme={theme}
          onToggleTheme={() => handleChangeTheme(theme === 'dark' ? 'light' : 'dark')}
          me={me}
        />
      </div>

      <div
        className={`${
          activeChatId ? 'hidden md:flex' : 'flex'
        } w-full md:w-[370px] lg:w-[400px] shrink-0 h-full border-r ${
          isLight ? 'border-[#d1d7db]' : 'border-[#2a3942]'
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
            activeChatId={activeChatId}
            onSelectChat={(cId) => setActiveChatId(cId)}
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
              setActiveChatId(cId);
              setSidebarTab('chats');
            }}
            onStartVoiceCall={handleStartVoiceCall}
            onToast={showToast}
          />
        )}

        {sidebarTab === 'status' && (
          <StatusPane
            me={me}
            theme={theme}
            statusesByUser={statusesByUser}
            usersMap={usersMap}
            onToast={showToast}
          />
        )}

        {sidebarTab === 'starred' && (
          <StarredPane
            me={me}
            theme={theme}
            starredMessages={starredMessages}
            chatRooms={chatRooms}
            usersMap={usersMap}
            onOpenChat={(cId) => {
              setActiveChatId(cId);
              setSidebarTab('chats');
            }}
          />
        )}

        {sidebarTab === 'settings' && (
          <SettingsPane
            me={me}
            theme={theme}
            wallpaper={wallpaper}
            onProfileUpdated={(u) => setMe(u)}
            onChangeTheme={handleChangeTheme}
            onChangeWallpaper={handleChangeWallpaper}
            onSignOut={handleSignOut}
            onToast={showToast}
          />
        )}
      </div>

      <div className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0`}>
        <ConversationPane
          me={me}
          theme={theme}
          defaultWallpaper={wallpaper}
          room={activeRoom}
          meta={activeMeta}
          usersMap={usersMap}
          friendsMap={friendsMap}
          presenceMap={presenceMap}
          typingEntries={(activeChatId && typingMap[activeChatId]) || {}}
          blocksMap={blocksMap}
          onBackMobile={() => setActiveChatId(null)}
          onForwardMessage={(m) => setForwardingMsg(m)}
          onOpenLightbox={(src, caption) => setLightbox({ src, caption })}
          onStartVoiceCall={handleStartVoiceCall}
          onMessagesSnapshot={(cId, msgs) =>
            setCachedChatMessages((prev) => ({ ...prev, [cId]: msgs }))
          }
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
        onClose={() => setLightbox(null)}
      />

      <CallOverlay
        session={callSession}
        isIncomingRinging={isIncomingCall}
        muted={callMuted}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
        onHangup={handleHangupCall}
        onToggleMute={() => {
          const next = !callMuted;
          setCallMuted(next);
          rtcControllerRef.current?.toggleMute(next);
        }}
        meUid={me.uid}
      />

      {toastMsg && (
        <div className="fixed bottom-18 md:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[6px] bg-[#202c33] border border-[#2a3942] text-[#e9edef] text-[13px] shadow-xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
