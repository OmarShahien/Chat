import React, { useRef, useState } from 'react';
import { Camera, Check, LogOut } from 'lucide-react';
import type { ThemeMode, UserProfile } from '../types';
import { compressAvatarFile } from '../utils/media';
import { updateMyProfile } from '../services/chatService';
import { BUBBLE_THEMES, type BubbleThemeId } from '../utils/bubbleThemes';
import { Avatar } from './Avatar';

interface SettingsPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  onProfileUpdated: (updated: UserProfile) => void;
  onChangeTheme: (t: ThemeMode) => void;
  onSignOut: () => void;
  onToast: (msg: string) => void;
}

export const SettingsPane: React.FC<SettingsPaneProps> = ({
  me,
  theme,
  onProfileUpdated,
  onChangeTheme,
  onSignOut,
  onToast,
}) => {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLight = theme === 'light';

  const privacy = me.privacy || {
    readReceipts: true,
    hideOnline: false,
    soundEnabled: true,
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAvatarFile(file);
      const updated = await updateMyProfile(me, { photoURL: dataUrl });
      onProfileUpdated(updated);
      onToast('Photo updated');
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not update photo');
    }
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMyProfile(me, {
        displayName,
        username,
      });
      onProfileUpdated(updated);
      onToast('Profile saved');
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectBubbleTheme = async (themeId: BubbleThemeId) => {
    try {
      const updated = await updateMyProfile(me, { bubbleTheme: themeId });
      onProfileUpdated(updated);
      onToast(`Bubble theme set to ${BUBBLE_THEMES[themeId].name}`);
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not update bubble theme');
    }
  };

  const togglePrivacyField = async (key: 'readReceipts' | 'hideOnline' | 'soundEnabled') => {
    const nextPrivacy = {
      ...privacy,
      [key]: !privacy[key],
    };
    try {
      const updated = await updateMyProfile(me, { privacy: nextPrivacy });
      onProfileUpdated(updated);
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not update setting');
    }
  };

  return (
    <div
      className={`flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-6 ${
        isLight ? 'bg-white text-[#0a1630]' : 'bg-[#0a1630] text-[#eaf2ff]'
      }`}
    >
      <div className="h-[59px] px-4 flex items-center shrink-0">
        <h1 className="text-[22px] font-bold">Settings</h1>
      </div>

      <div className="px-4 pb-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="relative">
            <Avatar name={me.displayName} src={me.photoURL} size="xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Change photo"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-[#3b82f6] text-white shadow-md hover:bg-[#60a5fa] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <p className="text-[13px] text-[#8fa7cc]">{me.email}</p>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-3.5">
          <div>
            <label className="text-[13px] text-[#3b82f6]">Your name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className={`mt-1 w-full px-3 py-2 rounded-[8px] text-[14.5px] outline-none ${
                isLight ? 'bg-[#eaf1fc]' : 'bg-[#12254a]'
              }`}
            />
          </div>

          <div>
            <label className="text-[13px] text-[#3b82f6]">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              className={`mt-1 w-full px-3 py-2 rounded-[8px] text-[14.5px] outline-none ${
                isLight ? 'bg-[#eaf1fc]' : 'bg-[#12254a]'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 rounded-[8px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white font-medium text-[14px] transition cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>

        {/* Privacy */}
        <div className="space-y-3 pt-4 border-t border-[#17294d]">
          <h2 className="text-[13px] font-medium text-[#3b82f6]">Privacy</h2>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-[14.5px]">Read receipts</p>
              <p className="text-[12.5px] text-[#8fa7cc]">Show blue checkmarks when messages are read</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.readReceipts}
              onChange={() => togglePrivacyField('readReceipts')}
              className="accent-[#3b82f6] w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-[14.5px]">Hide online status</p>
              <p className="text-[12.5px] text-[#8fa7cc]">Hide your online and last seen activity</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.hideOnline}
              onChange={() => togglePrivacyField('hideOnline')}
              className="accent-[#3b82f6] w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-[14.5px]">Notification sounds</p>
              <p className="text-[12.5px] text-[#8fa7cc]">Play sounds for incoming messages</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.soundEnabled}
              onChange={() => togglePrivacyField('soundEnabled')}
              className="accent-[#3b82f6] w-4 h-4"
            />
          </label>
        </div>

        {/* Theme */}
        <div className="space-y-3 pt-4 border-t border-[#17294d]">
          <h2 className="text-[13px] font-medium text-[#3b82f6]">Theme</h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onChangeTheme('dark')}
              className={`py-2 rounded-[8px] border text-[13.5px] cursor-pointer ${
                theme === 'dark'
                  ? 'border-[#3b82f6] text-[#3b82f6] font-medium'
                  : 'border-[#1d3764] text-[#8fa7cc]'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => onChangeTheme('light')}
              className={`py-2 rounded-[8px] border text-[13.5px] cursor-pointer ${
                theme === 'light'
                  ? 'border-[#1d4ed8] text-[#1d4ed8] font-medium'
                  : 'border-[#cfdcf0] text-[#8fa7cc]'
              }`}
            >
              Light
            </button>
          </div>
        </div>

        {/* Bubble Theme */}
        <div className="space-y-3 pt-4 border-t border-[#17294d]">
          <div>
            <h2 className="text-[13px] font-medium text-[#3b82f6]">Bubble Theme</h2>
            <p className="text-[12.5px] text-[#8fa7cc] mt-0.5">
              Choose your message bubble style. Other users will see this theme on your messages!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.values(BUBBLE_THEMES).map((bt) => {
              const isSelected = (me.bubbleTheme || 'blue') === bt.id;
              return (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() => handleSelectBubbleTheme(bt.id)}
                  className={`p-3 rounded-[10px] border text-left transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'border-[#3b82f6] bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]'
                      : isLight
                        ? 'border-[#cfdcf0] bg-[#f8fafc] hover:bg-[#f1f5f9]'
                        : 'border-[#1d3764] bg-[#0c1b36] hover:bg-[#12254a]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: bt.previewColor }}
                      />
                      <div>
                        <span className="text-[13.5px] font-medium block leading-tight">{bt.name}</span>
                        <span className="text-[11px] text-[#8fa7cc] block">{bt.description}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#3b82f6] shrink-0" />}
                  </div>

                  <div className={`rounded-[12px] rounded-br-[3px] px-3 py-1.5 text-[12px] shadow-xs ${bt.outgoingBg}`}>
                    <span>Hey there! Love this bubble style</span>
                    <div className={`flex justify-end text-[10px] ${bt.outgoingTime} mt-0.5`}>
                      <span>10:42 AM</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sign Out */}
        <div className="pt-4 border-t border-[#17294d]">
          <button
            onClick={onSignOut}
            className="w-full py-2.5 px-4 rounded-[8px] text-[#f15c6d] hover:bg-[#f15c6d]/10 text-[14px] font-medium flex items-center gap-2.5 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};
