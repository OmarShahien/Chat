import React, { useEffect, useRef, useState } from 'react';
import {
  Ban,
  BarChart2,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Download,
  FileText,
  MoreHorizontal,
  Pause,
  Pencil,
  Pin,
  Play,
  SmilePlus,
  Star,
  Trash2,
} from 'lucide-react';
import type { ChatMessage, ChatRoom, ThemeMode, UserProfile } from '../types';
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  fetchMediaPayload,
  getMessageSummaryText,
  pinMessageInChat,
  toggleMessageReaction,
  toggleStarMessage,
  voteOnPollOption,
} from '../services/chatService';
import { QUICK_REACTIONS } from '../utils/emojis';
import { formatDuration, formatFileSize, formatMessageTime } from '../utils/formatters';

interface MessageBubbleProps {
  message: ChatMessage;
  room: ChatRoom;
  me: UserProfile;
  theme: ThemeMode;
  usersMap: Record<string, UserProfile>;
  highlighted?: boolean;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onScrollToMessage: (messageId: string) => void;
  onOpenLightbox: (src: string, caption?: string) => void;
  onToast: (msg: string) => void;
}

function renderLinkifiedText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, idx) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#53bdeb] underline break-all hover:opacity-90"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  room,
  me,
  theme,
  usersMap,
  highlighted,
  onReply,
  onEdit,
  onForward,
  onScrollToMessage,
  onOpenLightbox,
  onToast,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentSec, setAudioCurrentSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const isLight = theme === 'light';
  const isMine = message.senderId === me.uid;
  const isStarred = Boolean(message.starredBy?.[me.uid]);

  useEffect(() => {
    let active = true;
    if (message.mediaId && !message.deletedForEveryone) {
      fetchMediaPayload(message.chatId, message.mediaId).then((payload) => {
        if (active && payload?.dataUrl) {
          setMediaUrl(payload.dataUrl);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [message.chatId, message.mediaId, message.deletedForEveryone]);

  if (message.deletedFor?.[me.uid]) {
    return null;
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2 px-4">
        <div
          className={`px-3 py-1 rounded-[7.5px] text-[12px] text-center max-w-md shadow-xs ${
            isLight
              ? 'bg-white/90 text-[#54656f]'
              : 'bg-[#182229] text-[#8696a0]'
          }`}
        >
          {message.text}
        </div>
      </div>
    );
  }

  const otherMembers = Object.keys(room.members || {}).filter((u) => u !== me.uid);
  const seenCount = otherMembers.filter((u) => Boolean(message.seenBy?.[u])).length;
  const deliveredCount = otherMembers.filter((u) => Boolean(message.deliveredTo?.[u])).length;

  let receiptStatus: 'sent' | 'delivered' | 'seen' = 'sent';
  if (room.type === 'self') {
    receiptStatus = 'seen';
  } else if (otherMembers.length > 0) {
    if (seenCount >= otherMembers.length) {
      receiptStatus = 'seen';
    } else if (deliveredCount > 0 || seenCount > 0) {
      receiptStatus = 'delivered';
    }
  }

  const reactionGroups: Record<string, string[]> = {};
  Object.entries(message.reactions || {}).forEach(([uid, emoji]) => {
    if (!emoji) return;
    if (!reactionGroups[emoji]) reactionGroups[emoji] = [];
    reactionGroups[emoji].push(uid);
  });
  const hasReactions = Object.keys(reactionGroups).length > 0;

  const toggleVoicePlay = () => {
    if (!mediaUrl) return;
    if (!audioRef.current) {
      const audio = new Audio(mediaUrl);
      audio.playbackRate = playbackRate;
      audio.ontimeupdate = () => {
        setAudioCurrentSec(audio.currentTime);
        const dur = audio.duration || message.mediaMeta?.durationSec || 1;
        setAudioProgress(Math.min(100, (audio.currentTime / dur) * 100));
      };
      audio.onended = () => {
        setPlaying(false);
        setAudioProgress(0);
        setAudioCurrentSec(0);
      };
      audioRef.current = audio;
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const cyclePlaybackRate = () => {
    const next: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const bubbleBg = isMine
    ? isLight
      ? 'bg-[#d9fdd3] text-[#111b21]'
      : 'bg-[#005c4b] text-[#e9edef]'
    : isLight
      ? 'bg-white text-[#111b21]'
      : 'bg-[#202c33] text-[#e9edef]';

  const waveform = message.mediaMeta?.waveform || [
    28, 52, 40, 74, 90, 56, 38, 68, 85, 48, 62, 78, 44, 34, 65, 82, 50, 42, 60, 35,
  ];

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex w-full px-3 sm:px-[7%] ${
        isMine ? 'justify-end' : 'justify-start'
      } ${hasReactions ? 'mb-4' : 'mb-0.5'} transition-colors duration-500 ${
        highlighted ? 'bg-[#00a884]/20 py-1' : ''
      }`}
      onMouseLeave={() => {
        setShowReactions(false);
        setShowMenu(false);
      }}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[65%] min-w-[96px] rounded-[7.5px] px-2.5 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${bubbleBg} ${
          isMine ? 'rounded-tr-none' : 'rounded-tl-none'
        }`}
      >
        {!isMine && room.type === 'group' && (
          <p className="text-[12.5px] font-medium text-[#00a884] mb-0.5 truncate">
            {usersMap[message.senderId]?.displayName || message.senderName}
          </p>
        )}

        {message.forwarded && !message.deletedForEveryone && (
          <div className="flex items-center gap-1 text-[11.5px] italic opacity-70 mb-0.5">
            <CornerUpRight className="w-3 h-3" />
            <span>Forwarded</span>
          </div>
        )}

        {message.replyTo && !message.deletedForEveryone && (
          <div
            onClick={() => onScrollToMessage(message.replyTo!.messageId)}
            className={`mb-1.5 rounded-[5px] px-2.5 py-1.5 border-l-4 border-[#00a884] cursor-pointer text-[12.5px] ${
              isLight ? 'bg-black/5' : 'bg-black/20'
            }`}
          >
            <p className="font-medium text-[#00a884] truncate">
              {message.replyTo.senderId === me.uid ? 'You' : message.replyTo.senderName}
            </p>
            <p className="opacity-80 truncate">{message.replyTo.text || message.replyTo.type}</p>
          </div>
        )}

        {message.deletedForEveryone ? (
          <div className="flex items-center gap-1.5 text-[13.5px] italic opacity-70 py-0.5">
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span>{isMine ? 'You deleted this message' : 'This message was deleted'}</span>
          </div>
        ) : (
          <>
            {message.type === 'image' && (
              <div className="mb-1 overflow-hidden rounded-[6px] bg-black/20">
                {mediaUrl || message.mediaMeta?.previewDataUrl ? (
                  <img
                    src={mediaUrl || message.mediaMeta?.previewDataUrl}
                    alt={message.text || 'Photo'}
                    onClick={() => {
                      if (mediaUrl) onOpenLightbox(mediaUrl, message.text);
                    }}
                    className={`max-h-80 w-full object-cover rounded-[6px] cursor-zoom-in transition ${
                      !mediaUrl ? 'blur-xs scale-105' : ''
                    }`}
                  />
                ) : (
                  <div className="h-44 w-60 flex items-center justify-center text-xs opacity-60">
                    Loading...
                  </div>
                )}
              </div>
            )}

            {message.type === 'voice' && (
              <div className="flex items-center gap-2.5 py-1 min-w-[220px] sm:min-w-[260px]">
                <button
                  onClick={toggleVoicePlay}
                  disabled={!mediaUrl}
                  className="w-9 h-9 rounded-full bg-[#00a884] text-[#111b21] flex items-center justify-center shrink-0 hover:bg-[#06cf9c] disabled:opacity-40 cursor-pointer"
                >
                  {playing ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-[3px] h-6">
                    {waveform.map((bar, idx) => {
                      const pct = ((idx + 1) / waveform.length) * 100;
                      const active = pct <= audioProgress;
                      return (
                        <span
                          key={idx}
                          className={`flex-1 rounded-full transition-colors ${
                            active
                              ? 'bg-[#53bdeb]'
                              : isLight
                                ? 'bg-[#8696a0]/50'
                                : 'bg-white/30'
                          }`}
                          style={{ height: `${Math.max(18, bar)}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] opacity-75">
                    <span>
                      {playing || audioCurrentSec > 0
                        ? formatDuration(audioCurrentSec)
                        : formatDuration(message.mediaMeta?.durationSec || 0)}
                    </span>
                    <button
                      onClick={cyclePlaybackRate}
                      className="px-1.5 rounded bg-black/20 font-medium cursor-pointer"
                    >
                      {playbackRate}x
                    </button>
                  </div>
                </div>
              </div>
            )}

            {message.type === 'file' && (
              <div
                className={`flex items-center justify-between gap-3 rounded-[6px] p-2.5 mb-1 ${
                  isLight ? 'bg-black/5' : 'bg-black/20'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-[#00a884] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">
                      {message.mediaMeta?.fileName || 'Document'}
                    </p>
                    <p className="text-[11px] opacity-70">
                      {formatFileSize(message.mediaMeta?.size)}
                    </p>
                  </div>
                </div>

                {mediaUrl && (
                  <a
                    href={mediaUrl}
                    download={message.mediaMeta?.fileName || 'file'}
                    className="p-1.5 rounded hover:bg-black/15 text-[#00a884]"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {message.type === 'poll' && message.poll && (
              <div className="space-y-2 py-1 min-w-[230px] sm:min-w-[270px]">
                <div className="flex items-start gap-2">
                  <BarChart2 className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14.5px] font-medium">{message.poll.question}</p>
                    <p className="text-[11.5px] opacity-70">
                      {message.poll.allowMultiple ? 'Select one or more' : 'Select one'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {Object.values(message.poll.options || {}).map((opt) => {
                    const allOptions = Object.values(message.poll!.options || {});
                    const totalVotes = allOptions.reduce(
                      (acc, o) => acc + Object.keys(o.votes || {}).length,
                      0
                    );
                    const optVotes = Object.keys(opt.votes || {}).length;
                    const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    const votedByMe = Boolean(opt.votes?.[me.uid]);

                    return (
                      <button
                        key={opt.id}
                        onClick={() => voteOnPollOption(message.chatId, message, me.uid, opt.id)}
                        className={`w-full text-left rounded-[6px] p-2 transition border cursor-pointer ${
                          votedByMe
                            ? 'border-[#00a884] bg-[#00a884]/15'
                            : isLight
                              ? 'border-black/10 bg-black/5 hover:bg-black/10'
                              : 'border-white/10 bg-black/20 hover:bg-black/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[13px] mb-1 gap-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                votedByMe
                                  ? 'border-[#00a884] bg-[#00a884] text-[#111b21]'
                                  : 'border-current opacity-60'
                              }`}
                            >
                              {votedByMe && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            {opt.text}
                          </span>
                          <span className="text-[11.5px] opacity-75 shrink-0">{optVotes}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/20 overflow-hidden">
                          <div
                            className="h-full bg-[#00a884] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {message.text && message.type !== 'poll' && (
              <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
                {renderLinkifiedText(message.text)}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] opacity-65 select-none">
          {isStarred && <Star className="w-3 h-3 fill-current" />}
          {message.editedAt && !message.deletedForEveryone && <span>Edited</span>}
          <span>{formatMessageTime(message.createdAt)}</span>
          {isMine && !message.deletedForEveryone && (
            <span>
              {receiptStatus === 'seen' ? (
                <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
              ) : receiptStatus === 'delivered' ? (
                <CheckCheck className="w-4 h-4" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </div>

        {hasReactions && !message.deletedForEveryone && (
          <div
            className={`absolute -bottom-3.5 ${
              isMine ? 'right-2' : 'left-2'
            } flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-sm text-xs z-10 ${
              isLight
                ? 'bg-white border-[#d1d7db] text-[#111b21]'
                : 'bg-[#202c33] border-[#2a3942] text-[#e9edef]'
            }`}
          >
            {Object.entries(reactionGroups).map(([emoji, uids]) => {
              const mine = uids.includes(me.uid);
              return (
                <button
                  key={emoji}
                  onClick={() =>
                    toggleMessageReaction(
                      message.chatId,
                      message.id,
                      me.uid,
                      mine ? null : emoji
                    )
                  }
                  className={`inline-flex items-center gap-0.5 px-0.5 rounded cursor-pointer ${
                    mine ? 'bg-[#00a884]/20' : ''
                  }`}
                >
                  <span>{emoji}</span>
                  {uids.length > 1 && <span className="text-[10px]">{uids.length}</span>}
                </button>
              );
            })}
          </div>
        )}

        {!message.deletedForEveryone && (
          <div
            className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition absolute top-1 ${
              isMine ? '-left-23' : '-right-23'
            } flex items-center gap-0.5 px-1.5 py-0.5 rounded-full shadow-md border z-20 ${
              isLight
                ? 'bg-white border-[#d1d7db] text-[#54656f]'
                : 'bg-[#233138] border-[#2a3942] text-[#aebac1]'
            }`}
          >
            <button
              onClick={() => {
                setShowReactions(!showReactions);
                setShowMenu(false);
              }}
              title="React"
              className="p-1 rounded-full hover:text-[#00a884] cursor-pointer"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReply(message)}
              title="Reply"
              className="p-1 rounded-full hover:text-[#00a884] cursor-pointer"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowMenu(!showMenu);
                setShowReactions(false);
              }}
              title="More"
              className="p-1 rounded-full hover:text-[#00a884] cursor-pointer"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showReactions && (
          <div
            className={`absolute -top-11 ${
              isMine ? 'right-0' : 'left-0'
            } z-30 flex items-center gap-1 px-2.5 py-1.5 rounded-full shadow-xl border ${
              isLight ? 'bg-white border-[#d1d7db]' : 'bg-[#233138] border-[#2a3942]'
            }`}
          >
            {QUICK_REACTIONS.map((emoji) => {
              const currentMine = message.reactions?.[me.uid] === emoji;
              return (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleMessageReaction(
                      message.chatId,
                      message.id,
                      me.uid,
                      currentMine ? null : emoji
                    );
                    setShowReactions(false);
                  }}
                  className={`text-lg hover:scale-125 transition px-0.5 rounded cursor-pointer ${
                    currentMine ? 'bg-[#00a884]/25' : ''
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}

        {showMenu && (
          <div
            className={`absolute top-8 ${
              isMine ? 'right-0' : 'left-0'
            } z-30 w-44 rounded-[6px] shadow-xl border py-1.5 text-[13px] ${
              isLight
                ? 'bg-white border-[#d1d7db] text-[#3b4a54]'
                : 'bg-[#233138] border-[#2a3942] text-[#d1d7db]'
            }`}
          >
            <button
              onClick={() => {
                onReply(message);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
            >
              <CornerUpLeft className="w-4 h-4" />
              Reply
            </button>

            <button
              onClick={() => {
                onForward(message);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
            >
              <CornerUpRight className="w-4 h-4" />
              Forward
            </button>

            {message.text && (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(message.text);
                  setShowMenu(false);
                  onToast('Copied');
                }}
                className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            )}

            <button
              onClick={() => {
                toggleStarMessage(message.chatId, message.id, me.uid, !isStarred);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
            >
              <Star className="w-4 h-4" />
              {isStarred ? 'Unstar' : 'Star'}
            </button>

            <button
              onClick={() => {
                const alreadyPinned = room.pinnedMessage?.messageId === message.id;
                pinMessageInChat(
                  room.id,
                  alreadyPinned
                    ? null
                    : {
                        messageId: message.id,
                        text: getMessageSummaryText(
                          message.type,
                          message.text,
                          message.mediaMeta,
                          message.poll
                        ),
                        senderName: message.senderName,
                        pinnedBy: me.uid,
                        pinnedAt: Date.now(),
                      }
                );
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
            >
              <Pin className="w-4 h-4" />
              {room.pinnedMessage?.messageId === message.id ? 'Unpin' : 'Pin'}
            </button>

            {isMine && message.type === 'text' && (
              <button
                onClick={() => {
                  onEdit(message);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-black/10 flex items-center gap-2.5 cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}

            <button
              onClick={() => {
                deleteMessageForMe(message.chatId, message.id, me.uid);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-black/10 text-[#f15c6d] flex items-center gap-2.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete for me
            </button>

            {isMine && (
              <button
                onClick={() => {
                  deleteMessageForEveryone(message.chatId, message.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-black/10 text-[#f15c6d] flex items-center gap-2.5 cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                Delete for everyone
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
