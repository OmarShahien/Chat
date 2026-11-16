import React, { useRef, useState } from 'react';
import { Camera, LogOut } from 'lucide-react';
import type { ThemeMode, UserProfile, WallpaperId } from '../types';
import { compressAvatarFile } from '../utils/media';
import { WALLPAPER_OPTIONS } from '../utils/wallpapers';
import { updateMyProfile } from '../services/chatService';
import { Avatar } from './Avatar';

interface SettingsPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  wallpaper: WallpaperId;
  onProfileUpdated: (updated: UserProfile) => void;
  onChangeTheme: (t: ThemeMode) => void;
  onChangeWallpaper: (w: WallpaperId) => void;
  onSignOut: () => void;
  onToast: (msg: string) => void;
}

export const SettingsPane: React.FC<SettingsPaneProps> = ({
  me,
  theme,
  wallpaper,
  onProfileUpdated,
  onChangeTheme,
  onChangeWallpaper,
  onSignOut,
  onToast,
}) => {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [about, setAbout] = useState(me.about);
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
        about,
      });
      onProfileUpdated(updated);
      onToast('Profile saved');
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not save profile');
    } finally {
      setSaving(false);
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
        isLight ? 'bg-white text-[#111b21]' : 'bg-[#111b21] text-[#e9edef]'
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
              className="absolute bottom-0 right-0 p-2 rounded-full bg-[#00a884] text-[#111b21] shadow-md hover:bg-[#06cf9c] cursor-pointer"
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
          <p className="text-[13px] text-[#8696a0]">{me.email}</p>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-3.5">
          <div>
            <label className="text-[13px] text-[#00a884]">Your name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className={`mt-1 w-full px-3 py-2 rounded-[8px] text-[14.5px] outline-none ${
                isLight ? 'bg-[#f0f2f5]' : 'bg-[#202c33]'
              }`}
            />
          </div>

          <div>
            <label className="text-[13px] text-[#00a884]">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              className={`mt-1 w-full px-3 py-2 rounded-[8px] text-[14.5px] outline-none ${
                isLight ? 'bg-[#f0f2f5]' : 'bg-[#202c33]'
              }`}
            />
          </div>

          <div>
            <label className="text-[13px] text-[#00a884]">About</label>
            <input
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={120}
              className={`mt-1 w-full px-3 py-2 rounded-[8px] text-[14.5px] outline-none ${
                isLight ? 'bg-[#f0f2f5]' : 'bg-[#202c33]'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 rounded-[8px] bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] font-medium text-[14px] transition cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>

        {/* Privacy */}
        <div className="space-y-3 pt-4 border-t border-[#222d34]">
          <h2 className="text-[13px] font-medium text-[#00a884]">Privacy</h2>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-[14.5px]">Read receipts</p>
              <p className="text-[12.5px] text-[#8696a0]">Show blue checkmarks when messages are read</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.readReceipts}
              onChange={() => togglePrivacyField('readReceipts')}
              className="accent-[#00a884] w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-[14.5px]">Hide online status</p>
              <p className="text-[12.5px] text-[#8696a0]">Hide your online and last seen activity</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.hideOnline}
              onChange={() => togglePrivacyField('hideOnline')}
              className="accent-[#00a884] w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <p className="text-[14.5px]">Notification sounds</p>
              <p className="text-[12.5px] text-[#8696a0]">Play sounds for incoming messages</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.soundEnabled}
              onChange={() => togglePrivacyField('soundEnabled')}
              className="accent-[#00a884] w-4 h-4"
            />
          </label>
        </div>

        {/* Theme & Chat Wallpaper */}
        <div className="space-y-3 pt-4 border-t border-[#222d34]">
          <h2 className="text-[13px] font-medium text-[#00a884]">Theme & wallpaper</h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onChangeTheme('dark')}
              className={`py-2 rounded-[8px] border text-[13.5px] cursor-pointer ${
                theme === 'dark'
                  ? 'border-[#00a884] text-[#00a884] font-medium'
                  : 'border-[#2a3942] text-[#8696a0]'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => onChangeTheme('light')}
              className={`py-2 rounded-[8px] border text-[13.5px] cursor-pointer ${
                theme === 'light'
                  ? 'border-[#008069] text-[#008069] font-medium'
                  : 'border-[#d1d7db] text-[#8696a0]'
              }`}
            >
              Light
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {WALLPAPER_OPTIONS.map((wp) => {
              const selected = wallpaper === wp.id;
              return (
                <button
                  key={wp.id}
                  onClick={() => onChangeWallpaper(wp.id)}
                  className={`rounded-[6px] p-1 border text-left transition cursor-pointer ${
                    selected ? 'border-[#00a884]' : 'border-transparent'
                  }`}
                >
                  <div
                    className="h-9 rounded-[4px] w-full mb-1"
                    style={{ background: wp.previewSwatch }}
                  />
                  <p className="text-[11px] text-[#8696a0] truncate px-0.5">{wp.name}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sign Out */}
        <div className="pt-4 border-t border-[#222d34]">
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
