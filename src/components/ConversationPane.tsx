import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  BarChart2,
  Check,
  Clock,
  CornerUpLeft,
  FileText,
  Gamepad2,
  Image as ImageIcon,
  Mic,
  Lock,
  MoreVertical,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  ChatRoom,
  FriendRecord,
  MinigameData,
  PollData,
  PresenceState,
  ThemeMode,
  TypingEntry,
  UserChatMeta,
  UserProfile,
} from '../types';
import {
  editChatMessage,
  getMessageSummaryText,
  markChatMessagesRead,
  pinMessageInChat,
  sendChatMessage,
  setChatDisappearingTimer,
  setTypingState,
  sortChatMessages,
  subscribeChatMessages,
} from '../services/chatService';
import { EMOJI_CATEGORIES } from '../utils/emojis';
import {
  formatDateSeparator,
  formatDisappearingDuration,
  formatDuration,
  formatLastSeen,
  isSameDay,
} from '../utils/formatters';
import {
  compressImageFile,
  fileToDataUrl,
  playUiSound,
  type CompressedImageResult,
} from '../utils/media';
import { CHAT_WALLPAPER_STYLE } from '../utils/wallpapers';
import { getMinigameInfo } from '../utils/minigames';
import { Avatar } from './Avatar';
import { GameLauncherModal } from './GameCard';
import { InfoDrawer } from './InfoDrawer';
import { MessageBubble } from './MessageBubble';
import { PollModal } from './Modals';
import { TypingDots } from './TypingDots';

interface ConversationPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  selectedChatId?: string | null;
  room: ChatRoom | null;
  meta?: UserChatMeta;
  usersMap: Record<string, UserProfile>;
  friendsMap: Record<string, FriendRecord>;
  presenceMap: Record<string, PresenceState>;
  typingEntries: Record<string, TypingEntry>;
  blocksMap: Record<string, boolean>;
  onBackMobile: () => void;
  onForwardMessage: (msg: ChatMessage) => void;
  onOpenLightbox: (src: string, caption?: string, isViewOnce?: boolean) => void;
  onToggleLock: (chatId: string) => void;
  onToast: (msg: string) => void;
}

export const ConversationPane: React.FC<ConversationPaneProps> = ({
  me,
  theme,
  selectedChatId,
  room,
  meta,
  usersMap,
  friendsMap,
  presenceMap,
  typingEntries,
  blocksMap,
  onBackMobile,
  onForwardMessage,
  onOpenLightbox,
  onToggleLock,
  onToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [stagedImage, setStagedImage] = useState<CompressedImageResult | null>(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [disappearingModalOpen, setDisappearingModalOpen] = useState(false);
  const [timerTick, setTimerTick] = useState(0);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0].id);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [sending, setSending] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRecordingRef = useRef(false);
  const recordDurationRef = useRef(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const isLight = theme === 'light';
  const soundEnabled = me.privacy?.soundEnabled ?? true;
  const sendReadReceipts = me.privacy?.readReceipts ?? true;

  const hasTimedItems = useMemo(
    () =>
      messages.some((m) => Boolean(m?.expiresAt)) ||
      Object.keys(typingEntries || {}).length > 0,
    [messages, typingEntries]
  );

  // Active timer ticker to trigger disappearance of expired messages and stale typing states in real time
  useEffect(() => {
    if (!room?.id || !hasTimedItems) return;
    const interval = setInterval(() => {
      setTimerTick((t) => (t + 1) % 10000);
    }, 1000);
    return () => clearInterval(interval);
  }, [room?.id, hasTimedItems]);

  useEffect(() => {
    if (!room?.id) {
      setMessages([]);
      return;
    }

    setReplyingTo(null);
    setEditingMsg(null);
    setStagedImage(null);
    setIsViewOnce(false);
    setEmojiOpen(false);
    setAttachOpen(false);
    setPollOpen(false);
    setGameModalOpen(false);
    setDisappearingModalOpen(false);
    setInfoOpen(false);
    setSearchOpen(false);
    setChatSearchQuery('');

    const unsub = subscribeChatMessages(room.id, (list) => {
      setMessages(list);
      markChatMessagesRead(room.id, list, me.uid, sendReadReceipts);
    });

    return () => {
      unsub();
      setTypingState(room.id, me.uid, me.displayName, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, me.uid, sendReadReceipts]);

  useEffect(() => {
    if (!room?.id) return;
    if (!showScrollDown) {
      bottomEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, room?.id, showScrollDown]);

  const visibleMessages = useMemo(() => {
    const clearedAt = meta?.clearedAt || 0;
    const now = Date.now();
    const filtered = messages.filter((m) => {
      if (!m || typeof m !== 'object') return false;
      if ((m.createdAt || 0) <= clearedAt) return false;
      if (m.deletedFor?.[me.uid]) return false;
      if (m.expiresAt && m.expiresAt <= now) return false;
      if (searchOpen && chatSearchQuery.trim()) {
        return (m.text || '').toLowerCase().includes(chatSearchQuery.trim().toLowerCase());
      }
      return true;
    });
    // Strict causal sort guarantees no scrambled ordering
    return sortChatMessages(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, meta?.clearedAt, me.uid, searchOpen, chatSearchQuery, timerTick]);

  const filteredEmojis = useMemo(() => {
    if (emojiSearch.trim()) {
      const q = emojiSearch.trim().toLowerCase();
      return EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter(
        (e) => e.keywords.includes(q) || e.char.includes(q)
      );
    }
    return EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.emojis || [];
  }, [emojiCat, emojiSearch]);

  const activeTypers = useMemo(
    () =>
      Object.entries(typingEntries || {})
        .filter(
          ([uid, entry]) =>
            uid !== me.uid &&
            Boolean(entry) &&
            typeof entry === 'object' &&
            Date.now() - (entry.updatedAt || 0) < 8000
        )
        .map(([uid, entry]) => ({
          uid,
          state: entry.state === 'recording' ? ('recording' as const) : ('typing' as const),
          name:
            typeof entry.name === 'string' && entry.name
              ? entry.name
              : usersMap[uid]?.displayName || 'Someone',
          updatedAt: entry.updatedAt || 0,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typingEntries, me.uid, usersMap, timerTick]
  );

  useEffect(() => {
    if (!room?.id) return;
    if (activeTypers.length > 0 && !showScrollDown) {
      bottomEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room?.id, activeTypers.length, showScrollDown]);

  // Loading or empty state when room is not yet available
  if (!room) {
    if (selectedChatId) {
      return (
        <div
          className={`flex-1 h-full flex flex-col ${
            isLight
              ? 'bg-[#eaf1fc] text-[#0a1630]'
              : 'bg-[#0c1b36] text-[#eaf2ff]'
          }`}
        >
          <header
            className={`h-[59px] px-3 sm:px-4 flex items-center gap-2.5 border-b shrink-0 ${
              isLight
                ? 'bg-[#eaf1fc] border-[#cfdcf0] text-[#0a1630]'
                : 'bg-[#12254a] border-[#1d3764] text-[#eaf2ff]'
            }`}
          >
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 rounded-full text-[#8fa7cc] hover:text-current cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-[14.5px] text-[#8fa7cc]">Opening chat...</span>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
            <p className="text-[13.5px] text-[#8fa7cc]">Loading conversation...</p>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex-1 h-full flex flex-col items-center justify-center p-8 text-center select-none border-b-[6px] border-[#3b82f6] ${
          isLight
            ? 'bg-[#eaf1fc] text-[#3b4f73]'
            : 'bg-[#0c1b36] text-[#eaf2ff]'
        }`}
      >
        <div className="max-w-[460px] space-y-4">
          <h2 className="text-[32px] font-light">Chat Web</h2>
          <p className="text-[14px] text-[#8fa7cc] leading-6">
            Send and receive messages from your browser. Select a conversation on the left or add a contact to begin.
          </p>
        </div>
      </div>
    );
  }

  const peerUid =
    room.type === 'direct'
      ? Object.keys(room.members || {}).find((u) => u !== me.uid)
      : undefined;
  const peerUser = peerUid ? usersMap[peerUid] : undefined;
  const friendRec = peerUid ? friendsMap[peerUid] : undefined;
  const peerPresence = peerUid ? presenceMap[peerUid] : undefined;
  const peerOnline = Boolean(peerPresence?.online && !peerPresence?.hidden);

  const chatTitle =
    room.type === 'self'
      ? `${me.displayName} (You)`
      : room.type === 'group'
        ? room.name || 'Group'
        : friendRec?.nickname || peerUser?.displayName || 'Chat';

  const chatAvatar =
    room.type === 'self'
      ? me.photoURL
      : room.type === 'group'
        ? room.photoURL
        : peerUser?.photoURL;

  let subtitleNode: React.ReactNode = null;
  if (activeTypers.length > 0) {
    const t = activeTypers[0];
    subtitleNode = (
      <span className="text-[#3b82f6] flex items-center gap-1 font-medium">
        <span>
          {room.type === 'group' ? `${t.name} is ` : ''}
          {t.state === 'recording' ? 'recording audio' : 'typing'}
        </span>
        <TypingDots size="sm" />
      </span>
    );
  } else if (room.type === 'self') {
    subtitleNode = <span>Message yourself</span>;
  } else if (room.type === 'group') {
    const names = Object.keys(room.members || {})
      .map((u) => (u === me.uid ? 'You' : usersMap[u]?.displayName || 'Member'))
      .join(', ');
    subtitleNode = <span>{names}</span>;
  } else if (peerOnline) {
    subtitleNode = <span>online</span>;
  } else if (peerPresence?.lastSeen && !peerPresence?.hidden) {
    subtitleNode = <span>{formatLastSeen(peerPresence.lastSeen)}</span>;
  } else if (peerUser) {
    subtitleNode = <span>@{peerUser.username}</span>;
  }

  const notifyTyping = (textVal: string) => {
    if (!room?.id || room.type === 'self') return;
    if (!textVal.trim()) {
      setTypingState(room.id, me.uid, me.displayName, null);
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      setTypingState(room.id, me.uid, me.displayName, 'typing');
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingState(room.id, me.uid, me.displayName, null);
    }, 3500);
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(messageId);
      setTimeout(() => setHighlightedId(null), 1800);
    }
  };

  const handleSend = async () => {
    if (sending) return;

    if (editingMsg) {
      if (!inputText.trim()) return;
      setSending(true);
      try {
        await editChatMessage(room.id, editingMsg.id, inputText);
        setEditingMsg(null);
        setInputText('');
      } catch (err: unknown) {
        onToast((err as Error).message || 'Could not edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!stagedImage && !inputText.trim()) return;

    setSending(true);
    const textToSend = inputText;
    const replySnapshot = replyingTo;
    const imgSnapshot = stagedImage;
    const viewOnceSnapshot = isViewOnce;

    setInputText('');
    setReplyingTo(null);
    setStagedImage(null);
    setIsViewOnce(false);
    setEmojiOpen(false);
    setTypingState(room.id, me.uid, me.displayName, null);

    try {
      await sendChatMessage({
        chatRoom: room,
        sender: me,
        type: imgSnapshot ? 'image' : 'text',
        text: textToSend,
        bubbleTheme: me.bubbleTheme || 'blue',
        viewOnce: imgSnapshot ? viewOnceSnapshot : undefined,
        replyTo: replySnapshot
          ? {
              messageId: replySnapshot.id,
              senderId: replySnapshot.senderId,
              senderName: replySnapshot.senderName,
              text: getMessageSummaryText(
                replySnapshot.type,
                replySnapshot.text,
                replySnapshot.mediaMeta,
                replySnapshot.poll,
                replySnapshot.viewOnce,
                replySnapshot.game
              ),
              type: replySnapshot.type,
            }
          : null,
        mediaDataUrl: imgSnapshot?.dataUrl,
        mediaMeta: imgSnapshot
          ? {
              mimeType: imgSnapshot.mimeType,
              width: imgSnapshot.width,
              height: imgSnapshot.height,
              size: imgSnapshot.size,
              previewDataUrl: imgSnapshot.previewDataUrl,
            }
          : undefined,
      });
      playUiSound('send', soundEnabled);
      setShowScrollDown(false);
      setTimeout(() => bottomEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setStagedImage(compressed);
      setAttachOpen(false);
    } catch {
      onToast('Could not process image');
    }
  };

  const handlePickDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      onToast('Please choose a file under 1.5 MB.');
      return;
    }
    setAttachOpen(false);
    setSending(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await sendChatMessage({
        chatRoom: room,
        sender: me,
        type: 'file',
        text: '',
        mediaDataUrl: dataUrl,
        mediaMeta: {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        },
      });
      playUiSound('send', soundEnabled);
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not send file');
    } finally {
      setSending(false);
    }
  };

  const handleSubmitPoll = async (poll: PollData) => {
    await sendChatMessage({
      chatRoom: room,
      sender: me,
      type: 'poll',
      text: poll.question,
      poll,
    });
    playUiSound('send', soundEnabled);
  };

  const handleLaunchGame = async (gameData: MinigameData) => {
    const info = getMinigameInfo(gameData.kind);
    await sendChatMessage({
      chatRoom: room,
      sender: me,
      type: 'game',
      text: info.title,
      game: gameData,
    });
    playUiSound('send', soundEnabled);
    setShowScrollDown(false);
    setTimeout(() => bottomEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onToast('Microphone not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime, audioBitsPerSecond: 24000 })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recordDurationRef.current = 0;
      setRecordSeconds(0);
      setRecording(true);
      setTypingState(room.id, me.uid, me.displayName, 'recording');

      recordTimerRef.current = setInterval(() => {
        recordDurationRef.current += 1;
        setRecordSeconds(recordDurationRef.current);
      }, 1000);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecording(false);
        setTypingState(room.id, me.uid, me.displayName, null);

        if (discardRecordingRef.current || audioChunksRef.current.length === 0) return;

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const file = new File([blob], 'voice-note.webm', { type: blob.type });
        const dataUrl = await fileToDataUrl(file);
        const waveform = Array.from({ length: 22 }, () => Math.floor(25 + Math.random() * 70));

        await sendChatMessage({
          chatRoom: room,
          sender: me,
          type: 'voice',
          text: '',
          mediaDataUrl: dataUrl,
          mediaMeta: {
            mimeType: blob.type,
            durationSec: Math.max(1, recordDurationRef.current),
            size: blob.size,
            waveform,
          },
        });
        playUiSound('send', soundEnabled);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      onToast('Microphone access unavailable.');
    }
  };

  const stopVoiceRecording = (discard = false) => {
    discardRecordingRef.current = discard;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setRecording(false);
    }
  };

  return (
    <div className="flex-1 h-full flex overflow-hidden relative">
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Header */}
        <header
          className={`h-[59px] px-3 sm:px-4 flex items-center justify-between border-b shrink-0 z-20 ${
            isLight
              ? 'bg-[#eaf1fc] border-[#cfdcf0] text-[#0a1630]'
              : 'bg-[#12254a] border-[#1d3764] text-[#eaf2ff]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 rounded-full text-[#8fa7cc] hover:text-current cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div
              onClick={() => setInfoOpen(!infoOpen)}
              className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
            >
              <Avatar
                name={chatTitle}
                src={chatAvatar}
                size="sm"
                online={peerOnline}
                isSelf={room.type === 'self'}
                isGroup={room.type === 'group'}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15.5px] font-normal truncate">{chatTitle}</h2>
                  {room.disappearingTimer && room.disappearingTimer > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setDisappearingModalOpen(true);
                      }}
                      title={`Disappearing messages: ${formatDisappearingDuration(room.disappearingTimer)}`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] text-[11px] font-mono cursor-pointer"
                    >
                      <Clock className="w-3 h-3 stroke-[2.2]" />
                      <span>{formatDisappearingDuration(room.disappearingTimer)}</span>
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-[#8fa7cc] truncate">{subtitleNode}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setDisappearingModalOpen(true)}
              title={
                room.disappearingTimer && room.disappearingTimer > 0
                  ? `Disappearing messages: ${formatDisappearingDuration(room.disappearingTimer)}`
                  : 'Disappearing messages'
              }
              className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer relative ${
                room.disappearingTimer && room.disappearingTimer > 0
                  ? 'text-[#3b82f6] bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20'
                  : 'text-[#8fa7cc] hover:text-current hover:bg-black/10'
              }`}
            >
              <Clock className="w-[18px] h-[18px]" />
              {room.disappearingTimer && room.disappearingTimer > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#3b82f6]" />
              )}
            </button>

            {meta && (
              <button
                onClick={() => onToggleLock(room.id)}
                title={meta.lockHash ? 'Remove chat lock' : 'Lock chat'}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
                  meta.lockHash
                    ? 'text-[#3b82f6] bg-black/10'
                    : 'text-[#8fa7cc] hover:text-current hover:bg-black/10'
                }`}
              >
                <Lock className="w-[18px] h-[18px]" />
              </button>
            )}

            <button
              onClick={() => {
                setSearchOpen(!searchOpen);
                setChatSearchQuery('');
              }}
              title="Search"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
                searchOpen
                  ? 'text-[#3b82f6] bg-black/10'
                  : 'text-[#8fa7cc] hover:text-current hover:bg-black/10'
              }`}
            >
              <Search className="w-[19px] h-[19px]" />
            </button>

            <button
              onClick={() => setInfoOpen(!infoOpen)}
              title="Menu"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
                infoOpen
                  ? 'text-[#3b82f6] bg-black/10'
                  : 'text-[#8fa7cc] hover:text-current hover:bg-black/10'
              }`}
            >
              <MoreVertical className="w-[19px] h-[19px]" />
            </button>
          </div>
        </header>

        {/* Search Bar */}
        {searchOpen && (
          <div
            className={`px-4 py-2 border-b flex items-center gap-2.5 z-20 ${
              isLight
                ? 'bg-white border-[#cfdcf0] text-[#0a1630]'
                : 'bg-[#0f2040] border-[#1d3764] text-[#eaf2ff]'
            }`}
          >
            <Search className="w-4 h-4 text-[#8fa7cc]" />
            <input
              autoFocus
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Search messages"
              className="flex-1 bg-transparent text-[14px] outline-none"
            />
            <button
              onClick={() => {
                setSearchOpen(false);
                setChatSearchQuery('');
              }}
              className="p-1 text-[#8fa7cc] hover:text-current cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pinned Message */}
        {room.pinnedMessage?.messageId && (
          <div
            onClick={() => scrollToMessage(room.pinnedMessage!.messageId)}
            className={`px-4 py-2 border-b flex items-center justify-between gap-3 cursor-pointer z-10 ${
              isLight
                ? 'bg-[#f3f7fd] border-[#cfdcf0] text-[#0a1630]'
                : 'bg-[#0f2040] border-[#1d3764] text-[#eaf2ff]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Pin className="w-4 h-4 text-[#3b82f6] shrink-0 rotate-45" />
              <p className="text-[13px] truncate">{room.pinnedMessage.text || ''}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                pinMessageInChat(room.id, null);
              }}
              title="Unpin"
              className="p-1 text-[#8fa7cc] hover:text-current cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowScrollDown(distFromBottom > 240);
          }}
          style={CHAT_WALLPAPER_STYLE}
          className="flex-1 overflow-y-auto py-4 space-y-0.5 relative"
        >
          {visibleMessages.map((msg, index) => {
            const prev = index > 0 ? visibleMessages[index - 1] : null;
            const showDateSep =
              !prev || !isSameDay(prev.createdAt || 0, msg.createdAt || 0);

            return (
              <React.Fragment key={msg.id}>
                {showDateSep && msg.createdAt && (
                  <div className="flex justify-center my-3 sticky top-2 z-10 pointer-events-none">
                    <span
                      className={`px-3 py-1 rounded-[7.5px] text-[12px] shadow-xs ${
                        isLight
                          ? 'bg-white/95 text-[#4a5f80]'
                          : 'bg-[#0f2040]/95 text-[#8fa7cc]'
                      }`}
                    >
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}

                <MessageBubble
                  message={msg}
                  room={room}
                  me={me}
                  theme={theme}
                  usersMap={usersMap}
                  highlighted={highlightedId === msg.id}
                  onReply={(m) => {
                    setEditingMsg(null);
                    setReplyingTo(m);
                  }}
                  onEdit={(m) => {
                    setReplyingTo(null);
                    setEditingMsg(m);
                    setInputText(m.text);
                  }}
                  onForward={onForwardMessage}
                  onScrollToMessage={scrollToMessage}
                  onOpenLightbox={onOpenLightbox}
                  onToast={onToast}
                />
              </React.Fragment>
            );
          })}

          {/* Typing Indicator with moving three dots */}
          {activeTypers.length > 0 && (
            <div className="flex items-end gap-2 px-3 sm:px-[7%] py-1.5 my-1">
              <Avatar
                name={activeTypers[0].name}
                src={usersMap[activeTypers[0].uid]?.photoURL}
                size="xs"
              />
              <div
                className={`rounded-[16px] rounded-bl-[4px] px-3.5 py-2 shadow-sm flex items-center gap-2 ${
                  isLight
                    ? 'bg-white border border-[#cfdcf0] text-[#0a1630]'
                    : 'bg-[#1c3a66] border border-[#1d3764] text-[#eaf2ff]'
                }`}
              >
                {room.type === 'group' && (
                  <span className="text-[12px] font-medium text-[#3b82f6]">
                    {activeTypers.map((t) => t.name).join(', ')}
                  </span>
                )}
                <span className="text-[12px] opacity-80">
                  {activeTypers[0].state === 'recording' ? 'recording audio' : 'typing'}
                </span>
                <TypingDots size="md" />
              </div>
            </div>
          )}

          <div ref={bottomEndRef} />
        </div>

        {showScrollDown && (
          <button
            onClick={() => bottomEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className={`absolute right-5 bottom-20 z-20 w-10 h-10 rounded-full shadow-md border flex items-center justify-center cursor-pointer ${
              isLight
                ? 'bg-white border-[#cfdcf0] text-[#4a5f80]'
                : 'bg-[#12254a] border-[#1d3764] text-[#a9bddb]'
            }`}
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        )}

        {/* Staged Photo */}
        {stagedImage && (
          <div
            className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 ${
              isLight ? 'bg-[#eaf1fc] border-[#cfdcf0]' : 'bg-[#0f2040] border-[#1d3764]'
            }`}
          >
            <div className="flex items-center gap-3">
              <img
                src={stagedImage.dataUrl}
                alt="Selected"
                className="w-12 h-12 rounded-[6px] object-cover"
              />
              <div className="text-[12.5px]">
                <span className="text-[#8fa7cc] block">
                  {stagedImage.width}×{stagedImage.height}
                </span>
                {isViewOnce ? (
                  <span className="text-[#3b82f6] font-medium flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center">
                      1
                    </span>
                    View once (1 time picture)
                  </span>
                ) : (
                  <span className="text-[#8fa7cc]">Standard photo</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !isViewOnce;
                  setIsViewOnce(next);
                  onToast(next ? 'Photo set to view once (1 time)' : 'Standard photo');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition cursor-pointer border ${
                  isViewOnce
                    ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-sm'
                    : isLight
                      ? 'bg-white border-[#cfdcf0] text-[#4a5f80] hover:bg-black/5'
                      : 'bg-[#16294d] border-[#1d3764] text-[#cfdcf0] hover:bg-white/10'
                }`}
                title="1-time picture (View once)"
              >
                <span
                  className={`w-4.5 h-4.5 rounded-full border-2 border-dashed flex items-center justify-center font-bold text-[11px] ${
                    isViewOnce ? 'border-white text-white' : 'border-current'
                  }`}
                >
                  1
                </span>
                <span>{isViewOnce ? 'View once' : 'View once off'}</span>
              </button>

              <button
                onClick={() => {
                  setStagedImage(null);
                  setIsViewOnce(false);
                }}
                className="p-1.5 text-[#8fa7cc] hover:text-[#f15c6d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Reply / Edit Bar */}
        {(replyingTo || editingMsg) && (
          <div
            className={`px-4 py-2 border-t flex items-center justify-between gap-3 ${
              isLight ? 'bg-[#eaf1fc] border-[#cfdcf0]' : 'bg-[#0f2040] border-[#1d3764]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 border-l-4 border-[#3b82f6] pl-2.5">
              {editingMsg ? (
                <Pencil className="w-4 h-4 text-[#3b82f6] shrink-0" />
              ) : (
                <CornerUpLeft className="w-4 h-4 text-[#3b82f6] shrink-0" />
              )}
              <div className="min-w-0 text-[12.5px]">
                <p className="font-medium text-[#3b82f6]">
                  {editingMsg
                    ? 'Edit message'
                    : replyingTo?.senderId === me.uid
                      ? 'You'
                      : replyingTo?.senderName}
                </p>
                <p className="truncate text-[#8fa7cc]">
                  {editingMsg
                    ? editingMsg.text
                    : replyingTo
                      ? getMessageSummaryText(
                          replyingTo.type,
                          replyingTo.text,
                          replyingTo.mediaMeta,
                          replyingTo.poll,
                          replyingTo.viewOnce,
                          replyingTo.game
                        )
                      : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setReplyingTo(null);
                if (editingMsg) {
                  setEditingMsg(null);
                  setInputText('');
                }
              }}
              className="p-1 text-[#8fa7cc] hover:text-current cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {emojiOpen && (
          <div
            className={`absolute left-3 bottom-16 z-30 w-80 rounded-[8px] border shadow-xl overflow-hidden ${
              isLight
                ? 'bg-white border-[#cfdcf0] text-[#0a1630]'
                : 'bg-[#12254a] border-[#1d3764] text-[#eaf2ff]'
            }`}
          >
            <div className="p-2.5 border-b border-[#1d3764]/40 space-y-2">
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search emoji"
                className={`w-full px-3 py-1.5 rounded-[6px] text-[13px] outline-none ${
                  isLight ? 'bg-[#eaf1fc]' : 'bg-[#0a1630]'
                }`}
              />
              {!emojiSearch && (
                <div className="flex gap-1">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setEmojiCat(cat.id)}
                      className={`flex-1 py-1 rounded-[6px] text-sm cursor-pointer ${
                        emojiCat === cat.id ? 'bg-[#3b82f6]/20' : 'hover:bg-black/10'
                      }`}
                      title={cat.label}
                    >
                      {cat.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-2 grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
              {filteredEmojis.map((item, i) => (
                <button
                  key={`${item.char}-${i}`}
                  onClick={() => setInputText((prev) => prev + item.char)}
                  className="text-xl p-1 rounded hover:bg-black/15 transition cursor-pointer"
                >
                  {item.char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attach Menu */}
        {attachOpen && (
          <div
            className={`absolute left-12 bottom-16 z-30 w-44 rounded-[8px] border shadow-xl py-1.5 text-[13.5px] ${
              isLight
                ? 'bg-white border-[#cfdcf0] text-[#34476a]'
                : 'bg-[#16294d] border-[#1d3764] text-[#cfdcf0]'
            }`}
          >
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-full px-4 py-2.5 text-left hover:bg-black/10 flex items-center gap-3 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-[#3b82f6]" />
              <span>Photos</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2.5 text-left hover:bg-black/10 flex items-center gap-3 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#53bdeb]" />
              <span>Document</span>
            </button>

            <button
              onClick={() => {
                setAttachOpen(false);
                setPollOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-black/10 flex items-center gap-3 cursor-pointer"
            >
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <span>Poll</span>
            </button>

            <button
              onClick={() => {
                setAttachOpen(false);
                setGameModalOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-black/10 flex items-center gap-3 cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span>Minigames</span>
            </button>
          </div>
        )}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePickImage(f);
            e.target.value = '';
          }}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          onChange={handlePickDocument}
          className="hidden"
        />

        {/* Composer */}
        <footer
          className={`min-h-[62px] px-3 sm:px-4 py-2.5 flex items-end gap-2 z-20 ${
            isLight
              ? 'bg-[#eaf1fc] text-[#0a1630]'
              : 'bg-[#12254a] text-[#eaf2ff]'
          }`}
        >
          {recording ? (
            <div className="flex-1 flex items-center justify-between gap-3 py-1 px-2">
              <button
                onClick={() => stopVoiceRecording(true)}
                title="Delete"
                className="p-2 rounded-full text-[#8fa7cc] hover:text-[#f15c6d] cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f15c6d] animate-pulse" />
                <span className="font-mono text-[14px]">
                  {formatDuration(recordSeconds)}
                </span>
              </div>

              <button
                onClick={() => stopVoiceRecording(false)}
                title="Send"
                className="w-10 h-10 rounded-full bg-[#3b82f6] hover:bg-[#60a5fa] text-white flex items-center justify-center cursor-pointer"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setEmojiOpen(!emojiOpen);
                  setAttachOpen(false);
                }}
                title="Emoji"
                className={`p-2 rounded-full transition cursor-pointer ${
                  emojiOpen ? 'text-[#3b82f6]' : 'text-[#8fa7cc] hover:text-current'
                }`}
              >
                <Smile className="w-6 h-6" />
              </button>

              <button
                onClick={() => {
                  setAttachOpen(!attachOpen);
                  setEmojiOpen(false);
                }}
                title="Attach"
                className={`p-2 rounded-full transition cursor-pointer ${
                  attachOpen ? 'text-[#3b82f6]' : 'text-[#8fa7cc] hover:text-current'
                }`}
              >
                <Plus className="w-6 h-6" />
              </button>

              <button
                onClick={() => {
                  setEmojiOpen(false);
                  setAttachOpen(false);
                  setGameModalOpen(true);
                }}
                title="Play a minigame"
                className={`p-2 rounded-full transition cursor-pointer ${
                  gameModalOpen ? 'text-[#3b82f6]' : 'text-[#8fa7cc] hover:text-[#3b82f6]'
                }`}
              >
                <Gamepad2 className="w-6 h-6" />
              </button>

              <div
                className={`flex-1 rounded-[8px] px-3 py-[9px] flex items-center ${
                  isLight ? 'bg-white' : 'bg-[#1d3764]'
                }`}
              >
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    notifyTyping(e.target.value);
                  }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                          e.preventDefault();
                          handlePickImage(file);
                          break;
                        }
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    } else if (e.key === 'Escape') {
                      setReplyingTo(null);
                      setEditingMsg(null);
                      setEmojiOpen(false);
                      setAttachOpen(false);
                    }
                  }}
                  placeholder={stagedImage ? 'Add a caption' : 'Type a message'}
                  className="w-full bg-transparent outline-none resize-none text-[15px] max-h-32 leading-5 placeholder-[#8fa7cc]"
                />
              </div>

              {inputText.trim() || stagedImage || editingMsg ? (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  title="Send"
                  className="p-2 rounded-full text-[#8fa7cc] hover:text-[#3b82f6] shrink-0 transition cursor-pointer"
                >
                  <Send className="w-6 h-6" />
                </button>
              ) : (
                <button
                  onClick={startVoiceRecording}
                  title="Voice message"
                  className="p-2 rounded-full text-[#8fa7cc] hover:text-current shrink-0 transition cursor-pointer"
                >
                  <Mic className="w-6 h-6" />
                </button>
              )}
            </>
          )}
        </footer>
      </div>

      <InfoDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        me={me}
        theme={theme}
        room={room}
        meta={meta}
        messages={messages}
        usersMap={usersMap}
        friendsMap={friendsMap}
        presenceMap={presenceMap}
        blocksMap={blocksMap}
        onOpenLightbox={onOpenLightbox}
        onLeftGroup={() => {
          setInfoOpen(false);
          onBackMobile();
        }}
        onToggleLock={onToggleLock}
        onToast={onToast}
      />

      <PollModal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onSubmitPoll={handleSubmitPoll}
      />

      <GameLauncherModal
        open={gameModalOpen}
        onClose={() => setGameModalOpen(false)}
        room={room}
        me={me}
        isLight={isLight}
        onLaunchGame={handleLaunchGame}
        onToast={onToast}
      />

      {disappearingModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setDisappearingModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-[14px] p-5 shadow-2xl border ${
              isLight
                ? 'bg-white border-[#cfdcf0] text-[#0a1630]'
                : 'bg-[#12254a] border-[#1d3764] text-[#eaf2ff]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#3b82f6]" />
                <h3 className="text-[17px] font-semibold">Disappearing Messages</h3>
              </div>
              <button
                onClick={() => setDisappearingModalOpen(false)}
                className="p-1 rounded-full text-[#8fa7cc] hover:text-current cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[13px] text-[#8fa7cc] mb-4">
              When turned on, new messages sent in this chat will disappear after the timer ends.
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Off', seconds: 0 },
                { label: '10 seconds (Quick demo)', seconds: 10 },
                { label: '1 minute', seconds: 60 },
                { label: '1 hour', seconds: 3600 },
                { label: '24 hours', seconds: 86400 },
                { label: '7 days', seconds: 604800 },
              ].map((opt) => {
                const current = room.disappearingTimer || 0;
                const isSelected = opt.seconds === 0 ? !room.disappearingTimer : current === opt.seconds;
                return (
                  <button
                    key={opt.seconds}
                    onClick={async () => {
                      try {
                        await setChatDisappearingTimer(me, room, opt.seconds > 0 ? opt.seconds : null);
                        setDisappearingModalOpen(false);
                        onToast(
                          opt.seconds > 0
                            ? `Disappearing messages set to ${opt.label}`
                            : 'Disappearing messages turned off'
                        );
                      } catch (err: unknown) {
                        onToast((err as Error).message || 'Failed to update setting');
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[8px] text-[14px] transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#3b82f6] text-white font-medium'
                        : isLight
                          ? 'hover:bg-black/5 text-[#334155]'
                          : 'hover:bg-white/5 text-[#eaf2ff]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
