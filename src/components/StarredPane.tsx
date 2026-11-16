import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { ChatMessage, ChatRoom, ThemeMode, UserProfile } from '../types';
import { formatChatListTime } from '../utils/formatters';
import { getMessageSummaryText, toggleStarMessage } from '../services/chatService';

interface StarredPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  starredMessages: ChatMessage[];
  chatRooms: Record<string, ChatRoom>;
  usersMap: Record<string, UserProfile>;
  onOpenChat: (chatId: string) => void;
}

export const StarredPane: React.FC<StarredPaneProps> = ({
  me,
  theme,
  starredMessages,
  chatRooms,
  usersMap,
  onOpenChat,
}) => {
  const isLight = theme === 'light';

  const getChatLabel = (chatId: string) => {
    const room = chatRooms[chatId];
    if (!room) return 'Chat';
    if (room.type === 'self') return 'Message yourself';
    if (room.type === 'group') return room.name || 'Group';
    const peerUid = Object.keys(room.members || {}).find((u) => u !== me.uid);
    return (peerUid && usersMap[peerUid]?.displayName) || 'Chat';
  };

  return (
    <div
      className={`flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-6 ${
        isLight ? 'bg-white text-[#111b21]' : 'bg-[#111b21] text-[#e9edef]'
      }`}
    >
      <div className="h-[59px] px-4 flex items-center shrink-0">
        <h1 className="text-[22px] font-bold">Starred messages</h1>
      </div>

      <div className="px-4 space-y-2.5">
        {starredMessages.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[#8696a0]">
            No starred messages
          </p>
        ) : (
          starredMessages.map((msg) => (
            <div
              key={`${msg.chatId}_${msg.id}`}
              onClick={() => onOpenChat(msg.chatId)}
              className={`rounded-[8px] p-3 border space-y-1.5 cursor-pointer transition ${
                isLight
                  ? 'bg-[#f8f9fa] border-[#d1d7db] hover:bg-[#f0f2f5]'
                  : 'bg-[#202c33] border-[#2a3942] hover:bg-[#2a3942]'
              }`}
            >
              <div className="flex items-center justify-between text-[12px] text-[#8696a0]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-medium text-current">{msg.senderName}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{getChatLabel(msg.chatId)}</span>
                </div>
                <span className="shrink-0">{formatChatListTime(msg.createdAt)}</span>
              </div>

              <p className="text-[14px] leading-relaxed break-words">
                {getMessageSummaryText(msg.type, msg.text, msg.mediaMeta, msg.poll)}
              </p>

              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStarMessage(msg.chatId, msg.id, me.uid, false);
                  }}
                  className="text-[12px] text-[#8696a0] hover:text-[#f15c6d] cursor-pointer"
                >
                  Unstar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
