import React from 'react';
import {
  CircleDot,
  MessageSquareText,
  Moon,
  Settings,
  Star,
  Sun,
  Users,
} from 'lucide-react';
import type { ThemeMode, UserProfile } from '../types';
import { Avatar } from './Avatar';

export type SidebarTab = 'chats' | 'friends' | 'status' | 'starred' | 'settings';

interface NavRailProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  unreadChatsCount: number;
  incomingRequestsCount: number;
  hasUnseenStatuses: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  me: UserProfile;
}

export const NavRail: React.FC<NavRailProps> = ({
  activeTab,
  onSelectTab,
  unreadChatsCount,
  incomingRequestsCount,
  hasUnseenStatuses,
  theme,
  onToggleTheme,
  me,
}) => {
  const isLight = theme === 'light';

  const navItems: Array<{
    id: SidebarTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    dot?: boolean;
  }> = [
    {
      id: 'chats',
      label: 'Chats',
      icon: <MessageSquareText className="w-[21px] h-[21px]" />,
      badge: unreadChatsCount,
    },
    {
      id: 'status',
      label: 'Status',
      icon: <CircleDot className="w-[21px] h-[21px]" />,
      dot: hasUnseenStatuses,
    },
    {
      id: 'friends',
      label: 'Contacts',
      icon: <Users className="w-[21px] h-[21px]" />,
      badge: incomingRequestsCount,
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: <Star className="w-[21px] h-[21px]" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-[21px] h-[21px]" />,
    },
  ];

  return (
    <>
      <aside
        className={`hidden md:flex flex-col items-center justify-between w-[60px] shrink-0 py-2.5 border-r select-none ${
          isLight
            ? 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f]'
            : 'bg-[#202c33] border-[#2a3942] text-[#aebac1]'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5">
          {navItems.slice(0, 4).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={item.label}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
                  active
                    ? isLight
                      ? 'bg-[#d9dbdf] text-[#111b21]'
                      : 'bg-[#374248] text-[#e9edef]'
                    : isLight
                      ? 'hover:bg-[#e9edef]'
                      : 'hover:bg-[#2a3942]'
                }`}
              >
                {item.icon}
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#00a884] text-[#111b21] text-[11px] font-semibold flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : item.dot ? (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00a884]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onToggleTheme}
            title={isLight ? 'Dark mode' : 'Light mode'}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLight ? 'hover:bg-[#e9edef]' : 'hover:bg-[#2a3942]'
            }`}
          >
            {isLight ? <Moon className="w-[20px] h-[20px]" /> : <Sun className="w-[20px] h-[20px]" />}
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            title="Settings"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              activeTab === 'settings'
                ? isLight
                  ? 'bg-[#d9dbdf] text-[#111b21]'
                  : 'bg-[#374248] text-[#e9edef]'
                : isLight
                  ? 'hover:bg-[#e9edef]'
                  : 'hover:bg-[#2a3942]'
            }`}
          >
            <Settings className="w-[20px] h-[20px]" />
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            title={me.displayName}
            className="mt-0.5 rounded-full cursor-pointer"
          >
            <Avatar name={me.displayName} src={me.photoURL} size="sm" />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 z-30 h-[58px] border-t flex items-center justify-around px-1 ${
          isLight
            ? 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f]'
            : 'bg-[#202c33] border-[#2a3942] text-[#aebac1]'
        }`}
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 text-[11px] font-medium transition cursor-pointer ${
                active
                  ? isLight
                    ? 'text-[#008069]'
                    : 'text-[#00a884]'
                  : isLight
                    ? 'text-[#54656f]'
                    : 'text-[#8696a0]'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#00a884] text-[#111b21] text-[10px] font-bold flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : item.dot ? (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#00a884]" />
                ) : null}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
