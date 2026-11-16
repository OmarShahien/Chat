import React, { useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  Palette,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type { StatusUpdate, ThemeMode, UserProfile } from '../types';
import { compressImageFile } from '../utils/media';
import { formatChatListTime } from '../utils/formatters';
import { STATUS_GRADIENTS } from '../utils/wallpapers';
import {
  deleteMyStatus,
  markStatusViewed,
  postStatusUpdate,
} from '../services/chatService';
import { Avatar } from './Avatar';

interface StatusPaneProps {
  me: UserProfile;
  theme: ThemeMode;
  statusesByUser: Record<string, StatusUpdate[]>;
  usersMap: Record<string, UserProfile>;
  onToast: (msg: string) => void;
}

export const StatusPane: React.FC<StatusPaneProps> = ({
  me,
  theme,
  statusesByUser,
  usersMap,
  onToast,
}) => {
  const [composerMode, setComposerMode] = useState<'text' | 'image' | null>(null);
  const [statusText, setStatusText] = useState('');
  const [gradientIdx, setGradientIdx] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLight = theme === 'light';

  const now = Date.now();
  const myStatuses = (statusesByUser[me.uid] || []).filter((s) => s.expiresAt > now);

  const friendEntries = Object.entries(statusesByUser)
    .filter(([uid]) => uid !== me.uid)
    .map(([uid, list]) => {
      const valid = list.filter((s) => s.expiresAt > now);
      const allSeen = valid.every((s) => Boolean(s.viewedBy?.[me.uid]));
      return {
        uid,
        user: usersMap[uid],
        statuses: valid,
        allSeen,
        latestAt: valid[valid.length - 1]?.createdAt || 0,
      };
    })
    .filter((entry) => entry.statuses.length > 0)
    .sort((a, b) => b.latestAt - a.latestAt);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1080, 0.8);
      setImagePreview(compressed.dataUrl);
      setComposerMode('image');
    } catch {
      onToast('Could not load image');
    }
    e.target.value = '';
  };

  const handlePublish = async () => {
    if (composerMode === 'text' && !statusText.trim()) return;
    if (composerMode === 'image' && !imagePreview) return;

    setPosting(true);
    try {
      await postStatusUpdate(me, {
        type: composerMode === 'image' ? 'image' : 'text',
        text: statusText,
        bgGradient: composerMode === 'text' ? STATUS_GRADIENTS[gradientIdx] : undefined,
        imageDataUrl: composerMode === 'image' ? imagePreview || undefined : undefined,
      });
      setComposerMode(null);
      setStatusText('');
      setImagePreview(null);
      onToast('Status shared');
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not post status');
    } finally {
      setPosting(false);
    }
  };

  const openViewer = (uid: string, startIndex = 0) => {
    const list = (statusesByUser[uid] || []).filter((s) => s.expiresAt > now);
    if (!list.length) return;
    setViewingUid(uid);
    setStoryIdx(startIndex);
    const target = list[startIndex];
    if (target && uid !== me.uid) {
      markStatusViewed(uid, target.id, me.uid);
    }
  };

  const activeStories = viewingUid
    ? (statusesByUser[viewingUid] || []).filter((s) => s.expiresAt > now)
    : [];
  const currentStory = activeStories[storyIdx];

  return (
    <div
      className={`flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-6 ${
        isLight ? 'bg-white text-[#111b21]' : 'bg-[#111b21] text-[#e9edef]'
      }`}
    >
      {/* Header */}
      <div className="h-[59px] px-4 flex items-center justify-between shrink-0">
        <h1 className="text-[22px] font-bold">Status</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setComposerMode('text');
              setStatusText('');
            }}
            title="Text status"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLight ? 'hover:bg-[#f0f2f5] text-[#54656f]' : 'hover:bg-[#202c33] text-[#aebac1]'
            }`}
          >
            <Pencil className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Photo status"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLight ? 'hover:bg-[#f0f2f5] text-[#54656f]' : 'hover:bg-[#202c33] text-[#aebac1]'
            }`}
          >
            <Camera className="w-[20px] h-[20px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* My Status */}
        <div
          onClick={() => {
            if (myStatuses.length > 0) {
              openViewer(me.uid, 0);
            } else {
              setComposerMode('text');
            }
          }}
          className="py-2 flex items-center gap-3.5 cursor-pointer"
        >
          <div className="relative">
            <Avatar
              name={me.displayName}
              src={me.photoURL}
              size="md"
              hasRing={myStatuses.length > 0}
              ringSeen={false}
            />
            {myStatuses.length === 0 && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#00a884] text-[#111b21] flex items-center justify-center border-2 border-[#111b21]">
                <Plus className="w-3 h-3 stroke-[3]" />
              </span>
            )}
          </div>
          <div>
            <p className="text-[15.5px] font-normal">My status</p>
            <p className="text-[13px] text-[#8696a0]">
              {myStatuses.length > 0
                ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
                : 'Click to add status update'}
            </p>
          </div>
        </div>

        {/* Friends' Updates */}
        <div className="space-y-1">
          <h2 className="text-[13px] font-medium text-[#00a884] pb-1">Recent</h2>

          {friendEntries.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-[#8696a0]">
              No status updates from your contacts
            </p>
          ) : (
            friendEntries.map((entry) => {
              const latest = entry.statuses[entry.statuses.length - 1];
              const name = entry.user?.displayName || latest.userName || 'Contact';
              return (
                <div
                  key={entry.uid}
                  onClick={() => openViewer(entry.uid, 0)}
                  className={`rounded-[8px] p-2 flex items-center gap-3.5 cursor-pointer transition ${
                    isLight ? 'hover:bg-[#f5f6f6]' : 'hover:bg-[#202c33]'
                  }`}
                >
                  <Avatar
                    name={name}
                    src={entry.user?.photoURL || latest.userPhoto}
                    size="md"
                    hasRing
                    ringSeen={entry.allSeen}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15.5px] truncate">{name}</p>
                    <p className="text-[13px] text-[#8696a0]">
                      {formatChatListTime(latest.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Status Composer */}
      {composerMode && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-between p-6 text-white"
          style={{
            background:
              composerMode === 'text' ? STATUS_GRADIENTS[gradientIdx] : '#0b141a',
          }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setComposerMode(null);
                setImagePreview(null);
                setStatusText('');
              }}
              className="p-2.5 rounded-full bg-black/30 hover:bg-black/50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {composerMode === 'text' && (
              <button
                onClick={() => setGradientIdx((gradientIdx + 1) % STATUS_GRADIENTS.length)}
                className="p-2.5 rounded-full bg-black/30 hover:bg-black/50 cursor-pointer"
                title="Background color"
              >
                <Palette className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-xl w-full mx-auto gap-4 my-4">
            {composerMode === 'image' && imagePreview ? (
              <>
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-[62vh] rounded-[6px] object-contain"
                />
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full px-4 py-2.5 rounded-[8px] bg-[#202c33] text-white text-[14px] outline-none placeholder-white/60"
                />
              </>
            ) : (
              <textarea
                autoFocus
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Type a status"
                maxLength={300}
                rows={4}
                className="w-full bg-transparent text-center text-2xl sm:text-3xl font-normal outline-none resize-none placeholder-white/60"
              />
            )}
          </div>

          <div className="flex items-center justify-end max-w-xl w-full mx-auto">
            <button
              onClick={handlePublish}
              disabled={posting || (composerMode === 'text' && !statusText.trim())}
              className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] flex items-center justify-center shadow-lg disabled:opacity-50 cursor-pointer"
              title="Send"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {viewingUid && currentStory && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 text-white select-none"
          style={{
            background:
              currentStory.type === 'text'
                ? currentStory.bgGradient || STATUS_GRADIENTS[0]
                : '#080e12',
          }}
        >
          <div className="max-w-xl w-full mx-auto space-y-3">
            <div className="flex gap-1.5">
              {activeStories.map((st, idx) => (
                <div
                  key={st.id}
                  className={`h-1 flex-1 rounded-full ${
                    idx <= storyIdx ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={currentStory.userName}
                  src={currentStory.userPhoto}
                  size="sm"
                />
                <div>
                  <p className="text-[14.5px] font-medium">
                    {viewingUid === me.uid ? 'My status' : currentStory.userName}
                  </p>
                  <p className="text-[12px] text-white/75">
                    {formatChatListTime(currentStory.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewingUid === me.uid && (
                  <button
                    onClick={async () => {
                      await deleteMyStatus(me.uid, currentStory.id);
                      if (activeStories.length <= 1) {
                        setViewingUid(null);
                      } else {
                        setStoryIdx(Math.max(0, storyIdx - 1));
                      }
                      onToast('Status deleted');
                    }}
                    className="p-2 rounded-full bg-black/30 hover:bg-red-500/50 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => setViewingUid(null)}
                  className="p-2 rounded-full bg-black/30 hover:bg-black/50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center max-w-2xl w-full mx-auto my-4">
            {storyIdx > 0 && (
              <button
                onClick={() => setStoryIdx(storyIdx - 1)}
                className="absolute left-0 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="text-center space-y-4 px-8">
              {currentStory.type === 'image' && currentStory.imageDataUrl ? (
                <>
                  <img
                    src={currentStory.imageDataUrl}
                    alt="Status"
                    className="max-h-[65vh] rounded-[6px] object-contain mx-auto"
                  />
                  {currentStory.text && (
                    <p className="text-[15px] bg-black/50 px-4 py-2 rounded-[6px] inline-block">
                      {currentStory.text}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-2xl sm:text-3xl font-normal leading-snug whitespace-pre-wrap">
                  {currentStory.text}
                </p>
              )}
            </div>

            {storyIdx < activeStories.length - 1 && (
              <button
                onClick={() => {
                  const next = storyIdx + 1;
                  setStoryIdx(next);
                  const st = activeStories[next];
                  if (st && viewingUid !== me.uid) {
                    markStatusViewed(viewingUid, st.id, me.uid);
                  }
                }}
                className="absolute right-0 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="max-w-xl w-full mx-auto flex items-center justify-center">
            {viewingUid === me.uid && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/35 text-[12.5px]">
                <Eye className="w-4 h-4" />
                <span>{Object.keys(currentStory.viewedBy || {}).length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
