import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Delete,
  Eye,
  EyeOff,
  Gamepad2,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  ChatMessage,
  ChatRoom,
  MinigameData,
  MinigameKind,
  MinigameLeaderboardEntry,
  MinigameMode,
  RpsThrow,
  UserProfile,
} from '../types';
import { joinMinigame, updateMinigameState } from '../services/chatService';
import { playUiSound } from '../utils/media';
import {
  C4_COLS,
  C4_EMPTY_BOARD,
  C4_ROWS,
  MINIGAME_CATALOG,
  RPS_OPTIONS,
  TTT_EMPTY_BOARD,
  checkConnectFourResult,
  checkTicTacToeResult,
  chooseConnectFourBotMove,
  chooseTicTacToeBotMove,
  createInitialMinigameData,
  decodeSecretWord,
  dropConnectFourDisc,
  evaluateWordleGuess,
  generateMathQuestions,
  generateMemoryDeck,
  getMinigameInfo,
  getRpsEmoji,
  normalizeC4Board,
  normalizeTttBoard,
  pickRandomWordleWord,
  encodeSecretWord,
  randomRpsThrow,
  resolveRpsWinner,
  type WordleLetterStatus,
} from '../utils/minigames';

/* ============================================================================
 * 1. TIC-TAC-TOE IN-BUBBLE VIEW
 * ========================================================================== */
interface SubGameProps {
  chatId: string;
  messageId: string;
  game: MinigameData;
  room: ChatRoom;
  me: UserProfile;
  soundEnabled: boolean;
  onToast: (msg: string) => void;
}

const TicTacToeView: React.FC<SubGameProps> = ({
  chatId,
  messageId,
  game,
  room,
  me,
  soundEnabled,
  onToast,
}) => {
  const [busy, setBusy] = useState(false);

  const board = normalizeTttBoard(game.board);
  const winIndices = useMemo(
    () =>
      new Set(
        (game.winLine || '')
          .split(',')
          .filter(Boolean)
          .map((n) => Number(n))
      ),
    [game.winLine]
  );

  const isHost = me.uid === game.hostUid;
  const isGuest = Boolean(game.guestUid && me.uid === game.guestUid);
  const canJoinAsGuest = game.mode === 'pvp' && !game.guestUid && !isHost;
  const turn = game.turn || 'p1';
  const isFinished = game.status === 'finished' || Boolean(game.winner);

  // Automatic Bot response when it is Bot's turn
  useEffect(() => {
    if (game.mode !== 'bot' || isFinished || turn !== 'p2' || !isHost) return;
    const timer = setTimeout(() => {
      updateMinigameState(chatId, messageId, (curr) => {
        if (curr.mode !== 'bot' || curr.status === 'finished' || curr.turn !== 'p2') {
          return null;
        }
        const currBoard = normalizeTttBoard(curr.board);
        const moveIdx = chooseTicTacToeBotMove(currBoard, 'O', 'X');
        if (moveIdx < 0 || currBoard[moveIdx] !== '.') return null;

        const nextBoard = currBoard.slice(0, moveIdx) + 'O' + currBoard.slice(moveIdx + 1);
        const check = checkTicTacToeResult(nextBoard);
        const finished = Boolean(check.winner);

        return {
          ...curr,
          board: nextBoard,
          lastMoveIndex: moveIdx,
          turn: finished ? curr.turn : 'p1',
          status: finished ? 'finished' : 'active',
          winner: check.winner,
          winLine: check.winLine,
          p1Score: (curr.p1Score || 0) + (check.winner === 'p1' ? 1 : 0),
          p2Score: (curr.p2Score || 0) + (check.winner === 'p2' ? 1 : 0),
          updatedAt: Date.now(),
        };
      }).catch(() => {});
    }, 320);

    return () => clearTimeout(timer);
  }, [chatId, messageId, game.mode, isFinished, turn, isHost, board]);

  const canClickCell = (idx: number): boolean => {
    if (busy || isFinished || board[idx] !== '.') return false;
    if (game.mode === 'pass') return isHost;
    if (game.mode === 'bot') return isHost && turn === 'p1';
    if (turn === 'p1') return isHost;
    return isGuest || canJoinAsGuest;
  };

  const handleCellClick = async (idx: number) => {
    if (!canClickCell(idx)) return;
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        if (curr.status === 'finished' || curr.winner) return null;
        const currTurn = curr.turn || 'p1';
        const currBoard = normalizeTttBoard(curr.board);
        if (currBoard[idx] !== '.') return null;

        let nextGuestUid = curr.guestUid;
        let nextGuestName = curr.guestName;

        if (curr.mode === 'pass') {
          if (me.uid !== curr.hostUid) return null;
        } else if (curr.mode === 'bot') {
          if (me.uid !== curr.hostUid || currTurn !== 'p1') return null;
        } else {
          // pvp
          if (currTurn === 'p1') {
            if (me.uid !== curr.hostUid) return null;
          } else {
            if (!nextGuestUid) {
              if (me.uid === curr.hostUid) return null;
              nextGuestUid = me.uid;
              nextGuestName = me.displayName || 'Player 2';
            } else if (me.uid !== nextGuestUid) {
              return null;
            }
          }
        }

        const mark = currTurn === 'p1' ? 'X' : 'O';
        const nextBoard = currBoard.slice(0, idx) + mark + currBoard.slice(idx + 1);
        const check = checkTicTacToeResult(nextBoard);
        const finished = Boolean(check.winner);

        return {
          ...curr,
          ...(nextGuestUid ? { guestUid: nextGuestUid } : {}),
          ...(nextGuestName ? { guestName: nextGuestName } : {}),
          board: nextBoard,
          lastMoveIndex: idx,
          turn: finished ? currTurn : currTurn === 'p1' ? 'p2' : 'p1',
          status: finished ? 'finished' : nextGuestUid || curr.mode !== 'pvp' ? 'active' : 'waiting',
          winner: check.winner,
          winLine: check.winLine,
          p1Score: (curr.p1Score || 0) + (check.winner === 'p1' ? 1 : 0),
          p2Score: (curr.p2Score || 0) + (check.winner === 'p2' ? 1 : 0),
          updatedAt: Date.now(),
        };
      });
      playUiSound('send', soundEnabled);
    } catch {
      onToast('Could not make move');
    } finally {
      setBusy(false);
    }
  };

  const handleRematch = async () => {
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        const nextRound = (curr.roundNumber || 1) + 1;
        const starter: 'p1' | 'p2' = nextRound % 2 === 1 ? 'p1' : 'p2';
        return {
          ...curr,
          board: TTT_EMPTY_BOARD,
          winner: '',
          winLine: '',
          lastMoveIndex: -1,
          roundNumber: nextRound,
          turn: starter,
          status: curr.guestUid || curr.mode !== 'pvp' ? 'active' : 'waiting',
          updatedAt: Date.now(),
        };
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchToBot = async () => {
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        if (curr.guestUid) return null;
        return {
          ...curr,
          mode: 'bot',
          guestUid: '__bot__',
          guestName: 'Bot 🤖',
          status: curr.winner ? 'finished' : 'active',
          updatedAt: Date.now(),
        };
      });
    } finally {
      setBusy(false);
    }
  };

  const p2Label = game.guestName || 'Open Seat';
  let statusText = '';
  if (game.winner === 'draw') {
    statusText = "It's a draw!";
  } else if (game.winner === 'p1') {
    statusText = `${game.hostName} wins!`;
  } else if (game.winner === 'p2') {
    statusText = `${p2Label} wins!`;
  } else if (turn === 'p1') {
    statusText = isHost ? 'Your turn (X)' : `${game.hostName}'s turn (X)`;
  } else if (game.mode === 'bot') {
    statusText = 'Bot is thinking...';
  } else if (!game.guestUid && game.mode === 'pvp') {
    statusText = isHost ? 'Waiting for friend to play O...' : 'Tap any square to join as O!';
  } else {
    statusText = isGuest || (game.mode === 'pass' && isHost) ? 'Your turn (O)' : `${p2Label}'s turn (O)`;
  }

  return (
    <div className="space-y-2.5">
      {/* Players & Score Pill */}
      <div className="flex items-center justify-between text-[11.5px] px-2.5 py-1.5 rounded-[8px] bg-white/5 border border-white/10">
        <span className={`truncate max-w-[105px] font-medium ${turn === 'p1' && !isFinished ? 'text-[#60a5fa]' : 'text-[#eaf2ff]'}`}>
          ❌ {game.hostName}
        </span>
        <span className="font-mono font-bold text-[#eaf2ff] px-1.5 py-0.5 rounded bg-black/30">
          {game.p1Score || 0} : {game.p2Score || 0}
        </span>
        <span className={`truncate max-w-[105px] font-medium ${turn === 'p2' && !isFinished ? 'text-[#fbbf24]' : 'text-[#eaf2ff]'}`}>
          ⭕ {p2Label}
        </span>
      </div>

      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-2 w-[204px] mx-auto py-0.5">
        {board.split('').map((cell, idx) => {
          const isWinCell = winIndices.has(idx);
          const isLast = game.lastMoveIndex === idx && !isWinCell;
          const clickable = canClickCell(idx);

          return (
            <button
              key={idx}
              type="button"
              disabled={!clickable}
              onClick={() => handleCellClick(idx)}
              className={`h-16 w-16 rounded-[10px] flex items-center justify-center text-[26px] font-extrabold transition select-none border ${
                isWinCell
                  ? 'bg-emerald-500/30 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] scale-[1.03]'
                  : isLast
                    ? 'bg-[#17305c] border-[#60a5fa]/60'
                    : clickable
                      ? 'bg-[#102347] border-white/15 hover:bg-[#193569] hover:border-[#60a5fa]/60 cursor-pointer active:scale-95'
                      : 'bg-[#0c1a36] border-white/10 cursor-default'
              }`}
            >
              {cell === 'X' ? (
                <span className="text-[#60a5fa] drop-shadow-xs">✕</span>
              ) : cell === 'O' ? (
                <span className="text-[#fbbf24] drop-shadow-xs">◯</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Status + Rematch / Bot fallback */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className={`text-[12px] font-medium truncate ${isFinished ? 'text-emerald-300' : 'text-[#b6cae8]'}`}>
          {statusText}
        </span>

        {isFinished && (isHost || isGuest || game.mode !== 'pvp') && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRematch}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11.5px] font-medium shrink-0 cursor-pointer transition"
          >
            <RotateCcw className="w-3 h-3" />
            Rematch
          </button>
        )}

        {!isFinished && game.mode === 'pvp' && !game.guestUid && Boolean(room.members?.[me.uid]) && !isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const joined = await joinMinigame(chatId, messageId, me.uid, me.displayName);
                if (!joined) onToast('This game is no longer available to join.');
              } catch {
                onToast('Could not join this game. Try again.');
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11px] font-medium shrink-0 cursor-pointer transition"
          >
            <Users className="w-3 h-3" />
            Join game
          </button>
        )}

        {!isFinished && game.mode === 'pvp' && !game.guestUid && isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={handleSwitchToBot}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-white/10 hover:bg-white/20 text-[#dbeafe] text-[11px] shrink-0 cursor-pointer transition"
          >
            <Bot className="w-3 h-3" />
            vs Bot
          </button>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. CONNECT FOUR IN-BUBBLE VIEW
 * ========================================================================== */
const ConnectFourView: React.FC<SubGameProps> = ({
  chatId,
  messageId,
  game,
  room,
  me,
  soundEnabled,
  onToast,
}) => {
  const [busy, setBusy] = useState(false);

  const board = normalizeC4Board(game.board);
  const winIndices = useMemo(
    () =>
      new Set(
        (game.winLine || '')
          .split(',')
          .filter(Boolean)
          .map((n) => Number(n))
      ),
    [game.winLine]
  );

  const isHost = me.uid === game.hostUid;
  const isGuest = Boolean(game.guestUid && me.uid === game.guestUid);
  const canJoinAsGuest = game.mode === 'pvp' && !game.guestUid && !isHost;
  const turn = game.turn || 'p1';
  const isFinished = game.status === 'finished' || Boolean(game.winner);

  // Automatic Bot response when it is Bot's turn
  useEffect(() => {
    if (game.mode !== 'bot' || isFinished || turn !== 'p2' || !isHost) return;
    const timer = setTimeout(() => {
      updateMinigameState(chatId, messageId, (curr) => {
        if (curr.mode !== 'bot' || curr.status === 'finished' || curr.turn !== 'p2') {
          return null;
        }
        const currBoard = normalizeC4Board(curr.board);
        const botCol = chooseConnectFourBotMove(currBoard, '2', '1');
        if (botCol < 0) return null;
        const dropped = dropConnectFourDisc(currBoard, botCol, '2');
        if (!dropped) return null;

        const check = checkConnectFourResult(dropped.nextBoard);
        const finished = Boolean(check.winner);

        return {
          ...curr,
          board: dropped.nextBoard,
          lastMoveIndex: dropped.index,
          turn: finished ? curr.turn : 'p1',
          status: finished ? 'finished' : 'active',
          winner: check.winner,
          winLine: check.winLine,
          p1Score: (curr.p1Score || 0) + (check.winner === 'p1' ? 1 : 0),
          p2Score: (curr.p2Score || 0) + (check.winner === 'p2' ? 1 : 0),
          updatedAt: Date.now(),
        };
      }).catch(() => {});
    }, 360);

    return () => clearTimeout(timer);
  }, [chatId, messageId, game.mode, isFinished, turn, isHost, board]);

  const isMyTurn = (() => {
    if (busy || isFinished) return false;
    if (game.mode === 'pass') return isHost;
    if (game.mode === 'bot') return isHost && turn === 'p1';
    if (turn === 'p1') return isHost;
    return isGuest || canJoinAsGuest;
  })();

  const handleDropColumn = async (col: number) => {
    if (!isMyTurn || board[col] !== '.') return;
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        if (curr.status === 'finished' || curr.winner) return null;
        const currTurn = curr.turn || 'p1';
        const currBoard = normalizeC4Board(curr.board);

        let nextGuestUid = curr.guestUid;
        let nextGuestName = curr.guestName;

        if (curr.mode === 'pass') {
          if (me.uid !== curr.hostUid) return null;
        } else if (curr.mode === 'bot') {
          if (me.uid !== curr.hostUid || currTurn !== 'p1') return null;
        } else {
          if (currTurn === 'p1') {
            if (me.uid !== curr.hostUid) return null;
          } else {
            if (!nextGuestUid) {
              if (me.uid === curr.hostUid) return null;
              nextGuestUid = me.uid;
              nextGuestName = me.displayName || 'Player 2';
            } else if (me.uid !== nextGuestUid) {
              return null;
            }
          }
        }

        const disc: '1' | '2' = currTurn === 'p1' ? '1' : '2';
        const dropped = dropConnectFourDisc(currBoard, col, disc);
        if (!dropped) return null;

        const check = checkConnectFourResult(dropped.nextBoard);
        const finished = Boolean(check.winner);

        return {
          ...curr,
          ...(nextGuestUid ? { guestUid: nextGuestUid } : {}),
          ...(nextGuestName ? { guestName: nextGuestName } : {}),
          board: dropped.nextBoard,
          lastMoveIndex: dropped.index,
          turn: finished ? currTurn : currTurn === 'p1' ? 'p2' : 'p1',
          status: finished ? 'finished' : nextGuestUid || curr.mode !== 'pvp' ? 'active' : 'waiting',
          winner: check.winner,
          winLine: check.winLine,
          p1Score: (curr.p1Score || 0) + (check.winner === 'p1' ? 1 : 0),
          p2Score: (curr.p2Score || 0) + (check.winner === 'p2' ? 1 : 0),
          updatedAt: Date.now(),
        };
      });
      playUiSound('send', soundEnabled);
    } catch {
      onToast('Could not drop disc');
    } finally {
      setBusy(false);
    }
  };

  const handleRematch = async () => {
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        const nextRound = (curr.roundNumber || 1) + 1;
        const starter: 'p1' | 'p2' = nextRound % 2 === 1 ? 'p1' : 'p2';
        return {
          ...curr,
          board: C4_EMPTY_BOARD,
          winner: '',
          winLine: '',
          lastMoveIndex: -1,
          roundNumber: nextRound,
          turn: starter,
          status: curr.guestUid || curr.mode !== 'pvp' ? 'active' : 'waiting',
          updatedAt: Date.now(),
        };
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchToBot = async () => {
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        if (curr.guestUid) return null;
        return {
          ...curr,
          mode: 'bot',
          guestUid: '__bot__',
          guestName: 'Bot 🤖',
          status: curr.winner ? 'finished' : 'active',
          updatedAt: Date.now(),
        };
      });
    } finally {
      setBusy(false);
    }
  };

  const p2Label = game.guestName || 'Open Seat';
  let statusText = '';
  if (game.winner === 'draw') {
    statusText = 'Full rack — draw!';
  } else if (game.winner === 'p1') {
    statusText = `${game.hostName} connected 4!`;
  } else if (game.winner === 'p2') {
    statusText = `${p2Label} connected 4!`;
  } else if (turn === 'p1') {
    statusText = isHost ? 'Tap a column to drop 🔴' : `${game.hostName}'s turn 🔴`;
  } else if (game.mode === 'bot') {
    statusText = 'Bot is choosing a column...';
  } else if (!game.guestUid && game.mode === 'pvp') {
    statusText = isHost ? 'Waiting for friend to drop 🟡...' : 'Tap a column to join as 🟡!';
  } else {
    statusText = isMyTurn ? 'Tap a column to drop 🟡' : `${p2Label}'s turn 🟡`;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11.5px] px-2.5 py-1.5 rounded-[8px] bg-white/5 border border-white/10">
        <span className={`truncate max-w-[105px] font-medium ${turn === 'p1' && !isFinished ? 'text-rose-400' : 'text-[#eaf2ff]'}`}>
          🔴 {game.hostName}
        </span>
        <span className="font-mono font-bold text-[#eaf2ff] px-1.5 py-0.5 rounded bg-black/30">
          {game.p1Score || 0} : {game.p2Score || 0}
        </span>
        <span className={`truncate max-w-[105px] font-medium ${turn === 'p2' && !isFinished ? 'text-amber-300' : 'text-[#eaf2ff]'}`}>
          🟡 {p2Label}
        </span>
      </div>

      {/* 7x6 Rack */}
      <div className="rounded-[10px] bg-[#0e2248] border border-[#2a4d8f]/60 p-2 shadow-inner">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: C4_ROWS * C4_COLS }).map((_, idx) => {
            const col = idx % C4_COLS;
            const cell = board[idx];
            const colOpen = board[col] === '.';
            const clickable = isMyTurn && colOpen;
            const isWin = winIndices.has(idx);
            const isLast = game.lastMoveIndex === idx;

            return (
              <button
                key={idx}
                type="button"
                disabled={!clickable}
                onClick={() => handleDropColumn(col)}
                className={`aspect-square w-full rounded-full transition flex items-center justify-center ${
                  cell === '1'
                    ? 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm'
                    : cell === '2'
                      ? 'bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm'
                      : clickable
                        ? 'bg-[#071329] hover:bg-[#163366] cursor-pointer'
                        : 'bg-[#071329] cursor-default'
                } ${
                  isWin
                    ? 'ring-2 ring-emerald-300 scale-105'
                    : isLast
                      ? 'ring-2 ring-white/75'
                      : ''
                }`}
                title={clickable ? `Drop in column ${col + 1}` : undefined}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className={`text-[12px] font-medium truncate ${isFinished ? 'text-emerald-300' : 'text-[#b6cae8]'}`}>
          {statusText}
        </span>

        {isFinished && (isHost || isGuest || game.mode !== 'pvp') && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRematch}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11.5px] font-medium shrink-0 cursor-pointer transition"
          >
            <RotateCcw className="w-3 h-3" />
            Rematch
          </button>
        )}

        {!isFinished && game.mode === 'pvp' && !game.guestUid && Boolean(room.members?.[me.uid]) && !isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const joined = await joinMinigame(chatId, messageId, me.uid, me.displayName);
                if (!joined) onToast('This game is no longer available to join.');
              } catch {
                onToast('Could not join this game. Try again.');
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11px] font-medium shrink-0 cursor-pointer transition"
          >
            <Users className="w-3 h-3" />
            Join game
          </button>
        )}

        {!isFinished && game.mode === 'pvp' && !game.guestUid && isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={handleSwitchToBot}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-white/10 hover:bg-white/20 text-[#dbeafe] text-[11px] shrink-0 cursor-pointer transition"
          >
            <Bot className="w-3 h-3" />
            vs Bot
          </button>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. ROCK PAPER SCISSORS (BEST OF 3) IN-BUBBLE VIEW
 * ========================================================================== */
const RpsView: React.FC<SubGameProps> = ({
  chatId,
  messageId,
  game,
  room,
  me,
  soundEnabled,
  onToast,
}) => {
  const [busy, setBusy] = useState(false);

  const isHost = me.uid === game.hostUid;
  const isGuest = Boolean(game.guestUid && me.uid === game.guestUid);
  const canJoinAsGuest = game.mode === 'pvp' && !game.guestUid && !isHost;
  const isFinished = game.status === 'finished' || Boolean(game.winner);

  const p1Wins = game.p1RoundWins || 0;
  const p2Wins = game.p2RoundWins || 0;
  const p2Label = game.guestName || 'Challenger';

  // Determine which role this user controls right now
  const myRole: 'p1' | 'p2' | null = (() => {
    if (game.mode === 'pass') {
      if (!isHost) return null;
      return !game.p1Pick ? 'p1' : 'p2';
    }
    if (isHost) return 'p1';
    if (isGuest || canJoinAsGuest) return 'p2';
    return null;
  })();

  const myCurrentPick =
    myRole === 'p1' ? game.p1Pick || '' : myRole === 'p2' ? game.p2Pick || '' : '';

  const handlePick = async (choice: RpsThrow) => {
    if (busy || isFinished || !myRole) return;
    if (game.mode !== 'pass' && myCurrentPick) return;

    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        if (curr.status === 'finished' || curr.winner) return null;

        let nextP1Pick: RpsThrow | '' = curr.p1Pick || '';
        let nextP2Pick: RpsThrow | '' = curr.p2Pick || '';
        let nextGuestUid = curr.guestUid;
        let nextGuestName = curr.guestName;

        if (curr.mode === 'bot') {
          if (me.uid !== curr.hostUid) return null;
          nextP1Pick = choice;
          nextP2Pick = randomRpsThrow();
        } else if (curr.mode === 'pass') {
          if (me.uid !== curr.hostUid) return null;
          if (!nextP1Pick) {
            nextP1Pick = choice;
          } else if (!nextP2Pick) {
            nextP2Pick = choice;
          }
        } else {
          // pvp
          if (me.uid === curr.hostUid) {
            if (nextP1Pick) return null;
            nextP1Pick = choice;
          } else {
            if (!nextGuestUid) {
              nextGuestUid = me.uid;
              nextGuestName = me.displayName || 'Player 2';
            } else if (me.uid !== nextGuestUid) {
              return null;
            }
            if (nextP2Pick) return null;
            nextP2Pick = choice;
          }
        }

        // Resolve round once both throws are locked in
        if (nextP1Pick && nextP2Pick) {
          const roundWinner = resolveRpsWinner(nextP1Pick, nextP2Pick);
          const nextP1RoundWins = (curr.p1RoundWins || 0) + (roundWinner === 'p1' ? 1 : 0);
          const nextP2RoundWins = (curr.p2RoundWins || 0) + (roundWinner === 'p2' ? 1 : 0);
          const matchWinner: 'p1' | 'p2' | '' =
            nextP1RoundWins >= 2 ? 'p1' : nextP2RoundWins >= 2 ? 'p2' : '';

          return {
            ...curr,
            ...(nextGuestUid ? { guestUid: nextGuestUid } : {}),
            ...(nextGuestName ? { guestName: nextGuestName } : {}),
            p1Pick: '',
            p2Pick: '',
            p1RoundWins: nextP1RoundWins,
            p2RoundWins: nextP2RoundWins,
            roundNumber: (curr.roundNumber || 1) + 1,
            lastRound: {
              round: curr.roundNumber || 1,
              p1Move: nextP1Pick,
              p2Move: nextP2Pick,
              winner: roundWinner,
            },
            status: matchWinner ? 'finished' : 'active',
            winner: matchWinner,
            p1Score: (curr.p1Score || 0) + (matchWinner === 'p1' ? 1 : 0),
            p2Score: (curr.p2Score || 0) + (matchWinner === 'p2' ? 1 : 0),
            updatedAt: Date.now(),
          };
        }

        return {
          ...curr,
          ...(nextGuestUid ? { guestUid: nextGuestUid } : {}),
          ...(nextGuestName ? { guestName: nextGuestName } : {}),
          p1Pick: nextP1Pick,
          p2Pick: nextP2Pick,
          status: nextGuestUid ? 'active' : 'waiting',
          updatedAt: Date.now(),
        };
      });
      playUiSound('send', soundEnabled);
    } catch {
      onToast('Could not submit throw');
    } finally {
      setBusy(false);
    }
  };

  const handleRematch = async () => {
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => ({
        ...curr,
        winner: '',
        status: curr.guestUid || curr.mode !== 'pvp' ? 'active' : 'waiting',
        p1RoundWins: 0,
        p2RoundWins: 0,
        p1Pick: '',
        p2Pick: '',
        roundNumber: 1,
        updatedAt: Date.now(),
      }));
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchToBot = async () => {
    setBusy(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        if (curr.guestUid) return null;
        if (curr.p1Pick) {
          const botMove = randomRpsThrow();
          const roundWinner = resolveRpsWinner(curr.p1Pick, botMove);
          const nextP1RoundWins = roundWinner === 'p1' ? 1 : 0;
          const nextP2RoundWins = roundWinner === 'p2' ? 1 : 0;
          return {
            ...curr,
            mode: 'bot',
            guestUid: '__bot__',
            guestName: 'Bot 🤖',
            status: 'active',
            p1Pick: '',
            p2Pick: '',
            p1RoundWins: nextP1RoundWins,
            p2RoundWins: nextP2RoundWins,
            roundNumber: 2,
            lastRound: {
              round: 1,
              p1Move: curr.p1Pick,
              p2Move: botMove,
              winner: roundWinner,
            },
            updatedAt: Date.now(),
          };
        }
        return {
          ...curr,
          mode: 'bot',
          guestUid: '__bot__',
          guestName: 'Bot 🤖',
          status: 'active',
          updatedAt: Date.now(),
        };
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Best-of-3 Round Tracker */}
      <div className="flex items-center justify-between text-[11.5px] px-2.5 py-1.5 rounded-[8px] bg-white/5 border border-white/10">
        <div className="min-w-0">
          <span className="font-medium truncate block max-w-[96px]">{game.hostName}</span>
          <span className="text-[10.5px] text-[#8fa7cc]">
            {'●'.repeat(p1Wins)}
            {'○'.repeat(Math.max(0, 2 - p1Wins))} {game.p1Pick ? '· Ready ✓' : ''}
          </span>
        </div>

        <div className="text-center shrink-0 px-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[#8fa7cc] block">Sets</span>
          <span className="font-mono font-bold text-[12px]">
            {game.p1Score || 0} : {game.p2Score || 0}
          </span>
        </div>

        <div className="min-w-0 text-right">
          <span className="font-medium truncate block max-w-[96px]">{p2Label}</span>
          <span className="text-[10.5px] text-[#8fa7cc]">
            {game.p2Pick ? 'Ready ✓ · ' : ''}
            {'●'.repeat(p2Wins)}
            {'○'.repeat(Math.max(0, 2 - p2Wins))}
          </span>
        </div>
      </div>

      {/* Last Round Clash Result */}
      {game.lastRound && (
        <div className="rounded-[8px] bg-[#102347] border border-white/10 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-3 text-[18px]">
            <span>{getRpsEmoji(game.lastRound.p1Move)}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8fa7cc]">vs</span>
            <span>{getRpsEmoji(game.lastRound.p2Move)}</span>
          </div>
          <p className="text-[11.5px] text-[#cfe0fa] mt-0.5">
            {game.lastRound.winner === 'draw'
              ? `Round ${game.lastRound.round}: Tie!`
              : game.lastRound.winner === 'p1'
                ? `Round ${game.lastRound.round}: ${game.hostName} won!`
                : `Round ${game.lastRound.round}: ${p2Label} won!`}
          </p>
        </div>
      )}

      {/* Throw Buttons */}
      {!isFinished && myRole && (
        <div className="grid grid-cols-3 gap-2">
          {RPS_OPTIONS.map((opt) => {
            const lockedThis = game.mode !== 'pass' && myCurrentPick === opt.id;
            const lockedAny = game.mode !== 'pass' && Boolean(myCurrentPick);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={busy || lockedAny}
                onClick={() => handlePick(opt.id)}
                className={`py-2.5 px-1.5 rounded-[10px] border flex flex-col items-center gap-1 transition select-none ${
                  lockedThis
                    ? 'bg-[#3b82f6]/35 border-[#60a5fa] text-white'
                    : lockedAny
                      ? 'bg-[#0c1a36] border-white/10 opacity-50 cursor-default'
                      : 'bg-[#102347] border-white/15 hover:bg-[#193569] hover:border-[#60a5fa] cursor-pointer active:scale-95'
                }`}
              >
                <span className="text-[22px] leading-none">{opt.emoji}</span>
                <span className="text-[11px] font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer status & Rematch */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className={`text-[12px] font-medium truncate ${isFinished ? 'text-emerald-300' : 'text-[#b6cae8]'}`}>
          {isFinished
            ? game.winner === 'p1'
              ? `🏆 ${game.hostName} wins the match!`
              : `🏆 ${p2Label} wins the match!`
            : game.mode === 'pass'
              ? !game.p1Pick
                ? 'Player 1: Pick your throw'
                : 'Player 2: Pick your throw'
              : myCurrentPick
                ? 'Throw locked in ✓ Waiting...'
                : myRole
                  ? 'Pick Rock, Paper, or Scissors!'
                  : `${game.hostName} vs ${p2Label}`}
        </span>

        {isFinished && (isHost || isGuest || game.mode !== 'pvp') && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRematch}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11.5px] font-medium shrink-0 cursor-pointer transition"
          >
            <RotateCcw className="w-3 h-3" />
            Rematch
          </button>
        )}

        {!isFinished && game.mode === 'pvp' && !game.guestUid && Boolean(room.members?.[me.uid]) && !isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const joined = await joinMinigame(chatId, messageId, me.uid, me.displayName);
                if (!joined) onToast('This game is no longer available to join.');
              } catch {
                onToast('Could not join this game. Try again.');
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11px] font-medium shrink-0 cursor-pointer transition"
          >
            <Users className="w-3 h-3" />
            Join game
          </button>
        )}

        {!isFinished && game.mode === 'pvp' && !game.guestUid && isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={handleSwitchToBot}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-white/10 hover:bg-white/20 text-[#dbeafe] text-[11px] shrink-0 cursor-pointer transition"
          >
            <Bot className="w-3 h-3" />
            vs Bot
          </button>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. WORD GUESS (5-LETTER WORDLE) IN-BUBBLE VIEW
 * ========================================================================== */
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
] as const;

const WordleView: React.FC<SubGameProps> = ({
  chatId,
  messageId,
  game,
  room,
  me,
  soundEnabled,
  onToast,
}) => {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [peekSecret, setPeekSecret] = useState(false);

  const secret = useMemo(() => decodeSecretWord(game.secretWord), [game.secretWord]);
  const isChallengeSetterOnly =
    Boolean(game.isCustomWord) && me.uid === game.hostUid && room.type !== 'self';

  const myRecord = game.wordPlayers?.[me.uid];
  const myGuesses = useMemo(
    () => (myRecord?.guesses ? myRecord.guesses.split('|').filter(Boolean) : []),
    [myRecord?.guesses]
  );
  const myStatus = myRecord?.status || 'playing';

  const evaluatedRows = useMemo(
    () => myGuesses.map((g) => ({ word: g, statuses: evaluateWordleGuess(g, secret) })),
    [myGuesses, secret]
  );

  const keyStatusMap = useMemo(() => {
    const map: Record<string, WordleLetterStatus> = {};
    const rank: Record<WordleLetterStatus, number> = { absent: 1, present: 2, correct: 3 };
    evaluatedRows.forEach(({ word, statuses }) => {
      for (let i = 0; i < 5; i++) {
        const ch = word[i];
        const st = statuses[i];
        if (!map[ch] || rank[st] > rank[map[ch]]) {
          map[ch] = st;
        }
      }
    });
    return map;
  }, [evaluatedRows]);

  const submitGuess = async () => {
    if (submitting || myStatus !== 'playing' || isChallengeSetterOnly) return;
    const clean = draft.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length !== 5) {
      onToast('Enter a 5-letter word');
      return;
    }

    setSubmitting(true);
    try {
      await updateMinigameState(chatId, messageId, (curr) => {
        const target = decodeSecretWord(curr.secretWord);
        const players = { ...(curr.wordPlayers || {}) };
        const existing = players[me.uid];
        const prevList = existing?.guesses ? existing.guesses.split('|').filter(Boolean) : [];
        if (existing?.status === 'won' || existing?.status === 'lost' || prevList.length >= 6) {
          return null;
        }

        const nextList = [...prevList, clean];
        const won = clean === target;
        const lost = !won && nextList.length >= 6;
        const nextStatus: 'playing' | 'won' | 'lost' = won ? 'won' : lost ? 'lost' : 'playing';

        players[me.uid] = {
          uid: me.uid,
          name: me.displayName || 'Player',
          guesses: nextList.join('|'),
          status: nextStatus,
          ...(nextStatus !== 'playing' ? { completedAt: Date.now() } : {}),
        };

        return {
          ...curr,
          wordPlayers: players,
          updatedAt: Date.now(),
        };
      });
      setDraft('');
      playUiSound('send', soundEnabled);
    } catch {
      onToast('Could not submit guess');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVirtualKey = (key: string) => {
    if (myStatus !== 'playing' || submitting) return;
    if (key === 'BACK') {
      setDraft((d) => d.slice(0, -1));
    } else if (key === 'ENTER') {
      submitGuess();
    } else if (draft.length < 5) {
      setDraft((d) => (d + key).slice(0, 5));
    }
  };

  const handleNewRandomWord = async () => {
    setSubmitting(true);
    try {
      const nextWord = pickRandomWordleWord();
      await updateMinigameState(chatId, messageId, (curr) => ({
        ...curr,
        secretWord: encodeSecretWord(nextWord),
        isCustomWord: false,
        wordPlayers: {},
        roundNumber: (curr.roundNumber || 1) + 1,
        updatedAt: Date.now(),
      }));
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  const allPlayerEntries = useMemo(() => {
    const entries = Object.values(game.wordPlayers || {}).filter(
      (p) => Boolean(p && typeof p === 'object' && p.uid)
    );
    return entries.sort((a, b) => {
      if (a.status === 'won' && b.status !== 'won') return -1;
      if (a.status !== 'won' && b.status === 'won') return 1;
      const aLen = a.guesses ? a.guesses.split('|').filter(Boolean).length : 99;
      const bLen = b.guesses ? b.guesses.split('|').filter(Boolean).length : 99;
      return aLen - bLen;
    });
  }, [game.wordPlayers]);

  return (
    <div
      className="space-y-2.5 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (isChallengeSetterOnly || myStatus !== 'playing') return;
        if (e.key === 'Backspace') {
          e.preventDefault();
          handleVirtualKey('BACK');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleVirtualKey('ENTER');
        } else if (/^[a-zA-Z]$/.test(e.key)) {
          e.preventDefault();
          handleVirtualKey(e.key.toUpperCase());
        }
      }}
    >
      {isChallengeSetterOnly ? (
        <div className="rounded-[9px] bg-[#102347] border border-white/10 p-3 space-y-2 text-center">
          <p className="text-[12.5px] text-[#cfe0fa]">
            You challenged the chat with a custom 5-letter word!
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono font-bold tracking-[0.25em] px-2.5 py-1 rounded bg-black/35 text-[13px]">
              {peekSecret ? secret : '•••••'}
            </span>
            <button
              type="button"
              onClick={() => setPeekSecret((v) => !v)}
              className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-[#cfe0fa] cursor-pointer"
              title={peekSecret ? 'Hide word' : 'Peek word'}
            >
              {peekSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 6x5 Word Grid */}
          <div className="space-y-1 max-w-[215px] mx-auto">
            {Array.from({ length: 6 }).map((_, rowIdx) => {
              const submitted = evaluatedRows[rowIdx];
              const isCurrent = !submitted && rowIdx === evaluatedRows.length && myStatus === 'playing';
              const letters = submitted
                ? submitted.word.split('')
                : isCurrent
                  ? draft.padEnd(5, ' ').split('')
                  : [' ', ' ', ' ', ' ', ' '];

              return (
                <div key={rowIdx} className="grid grid-cols-5 gap-1">
                  {letters.map((ch, colIdx) => {
                    const st = submitted?.statuses[colIdx];
                    const tileClass = submitted
                      ? st === 'correct'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : st === 'present'
                          ? 'bg-amber-500 border-amber-400 text-white'
                          : 'bg-slate-700/90 border-slate-600 text-slate-200'
                      : isCurrent && ch !== ' '
                        ? 'bg-[#173263] border-[#60a5fa] text-white'
                        : 'bg-[#0b1833] border-white/15 text-white';

                    return (
                      <div
                        key={colIdx}
                        className={`h-9 rounded-[6px] border flex items-center justify-center font-bold text-[14.5px] select-none transition ${tileClass}`}
                      >
                        {ch !== ' ' ? ch : ''}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Result Banner or On-Screen Keyboard */}
          {myStatus !== 'playing' ? (
            <div className="rounded-[8px] bg-[#102347] border border-white/10 px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-[12px]">
                {myStatus === 'won' ? (
                  <span className="text-emerald-300 font-semibold">
                    🎉 Solved in {myGuesses.length}/6! ({secret})
                  </span>
                ) : (
                  <span className="text-rose-300 font-medium">
                    Word was <strong className="font-mono tracking-wider">{secret}</strong>
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleNewRandomWord}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[11px] font-medium shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                New Word
              </button>
            </div>
          ) : (
            <div className="space-y-1 pt-0.5">
              {KEYBOARD_ROWS.map((row, rIdx) => (
                <div key={rIdx} className="flex justify-center gap-[3px]">
                  {row.map((key) => {
                    const st = keyStatusMap[key];
                    const isWide = key === 'ENTER' || key === 'BACK';
                    const keyBg =
                      st === 'correct'
                        ? 'bg-emerald-600 text-white'
                        : st === 'present'
                          ? 'bg-amber-500 text-white'
                          : st === 'absent'
                            ? 'bg-slate-800/80 text-slate-400'
                            : 'bg-[#17305c] hover:bg-[#21437d] text-[#eaf2ff]';

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={submitting}
                        onClick={() => handleVirtualKey(key)}
                        className={`${
                          isWide ? 'px-1.5 min-w-[36px] text-[10px]' : 'flex-1 max-w-[26px] text-[11px]'
                        } h-7 rounded-[5px] font-semibold flex items-center justify-center transition cursor-pointer active:scale-95 select-none ${keyBg}`}
                      >
                        {key === 'BACK' ? <Delete className="w-3.5 h-3.5" /> : key === 'ENTER' ? 'GO' : key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Chat Progress / Spoiler-Free Scoreboard */}
      {allPlayerEntries.length > 0 && (
        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <p className="text-[10.5px] uppercase tracking-wider text-[#8fa7cc] font-semibold">
            Chat Results ({allPlayerEntries.length})
          </p>
          {allPlayerEntries.slice(0, 5).map((p) => {
            const pGuesses = p.guesses ? p.guesses.split('|').filter(Boolean) : [];
            const lastEval =
              pGuesses.length > 0 ? evaluateWordleGuess(pGuesses[pGuesses.length - 1], secret) : [];
            const blocks = lastEval
              .map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛'))
              .join('');

            return (
              <div key={p.uid} className="flex items-center justify-between text-[11.5px] gap-2">
                <span className="truncate font-medium">
                  {p.status === 'won' ? '🏆 ' : p.status === 'lost' ? '❌ ' : '⏳ '}
                  {p.uid === me.uid ? 'You' : p.name}
                </span>
                <span className="font-mono text-[11px] text-[#cfe0fa] shrink-0">
                  {blocks} {p.status === 'playing' ? `${pGuesses.length}/6` : p.status === 'won' ? `${pGuesses.length}/6` : 'X/6'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. EMOJI MEMORY MATCH (4x4) IN-BUBBLE VIEW
 * ========================================================================== */
const MemoryView: React.FC<SubGameProps> = ({
  chatId,
  messageId,
  game,
  me,
  soundEnabled,
}) => {
  const deck = useMemo(() => generateMemoryDeck(game.seed || 12345), [game.seed]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Record<number, boolean>>({});
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    if (!startedAt || finished) return;
    const t = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);
    return () => clearInterval(t);
  }, [startedAt, finished]);

  const submitMemoryScore = async (finalMoves: number, finalTimeMs: number) => {
    await updateMinigameState(chatId, messageId, (curr) => {
      const lb = { ...(curr.leaderboard || {}) };
      const prev = lb[me.uid];
      const prevMoves = prev?.moves ?? Infinity;
      const isBetter =
        !prev ||
        finalMoves < prevMoves ||
        (finalMoves === prevMoves && finalTimeMs < prev.timeMs);

      if (!isBetter) return null;

      lb[me.uid] = {
        uid: me.uid,
        name: me.displayName || 'Player',
        score: Math.max(100, 2000 - finalMoves * 60 - Math.floor(finalTimeMs / 250)),
        moves: finalMoves,
        timeMs: finalTimeMs,
        completedAt: Date.now(),
      };

      return {
        ...curr,
        leaderboard: lb,
        updatedAt: Date.now(),
      };
    }).catch(() => {});
  };

  const handleCardTap = (idx: number) => {
    if (lockRef.current || finished || matched[idx] || flipped.includes(idx)) return;

    const now = Date.now();
    const effectiveStart = startedAt ?? now;
    if (!startedAt) setStartedAt(now);

    const nextFlipped = [...flipped, idx];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [first, second] = nextFlipped;

      if (deck[first] === deck[second]) {
        const nextMatched = { ...matched, [first]: true, [second]: true };
        setMatched(nextMatched);
        setFlipped([]);
        playUiSound('send', soundEnabled);

        if (Object.keys(nextMatched).length === deck.length) {
          const totalMs = Math.max(500, Date.now() - effectiveStart);
          setElapsedMs(totalMs);
          setFinished(true);
          submitMemoryScore(nextMoves, totalMs);
        }
      } else {
        lockRef.current = true;
        setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 600);
      }
    }
  };

  const resetLocalRun = () => {
    lockRef.current = false;
    setFlipped([]);
    setMatched({});
    setMoves(0);
    setStartedAt(null);
    setElapsedMs(0);
    setFinished(false);
  };

  const leaderboard = useMemo(() => {
    const list = Object.values(game.leaderboard || {}).filter(
      (e): e is MinigameLeaderboardEntry => Boolean(e && typeof e === 'object' && e.uid)
    );
    return list.sort((a, b) => {
      const ma = a.moves ?? 999;
      const mb = b.moves ?? 999;
      if (ma !== mb) return ma - mb;
      return a.timeMs - b.timeMs;
    });
  }, [game.leaderboard]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11.5px] px-2.5 py-1 rounded-[7px] bg-white/5 border border-white/10">
        <span>Moves: <strong>{moves}</strong></span>
        <span className="font-mono">{(elapsedMs / 1000).toFixed(1)}s</span>
        {(moves > 0 || finished) && (
          <button
            type="button"
            onClick={resetLocalRun}
            className="inline-flex items-center gap-1 text-[#60a5fa] hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* 4x4 Emoji Deck */}
      <div className="grid grid-cols-4 gap-1.5 max-w-[232px] mx-auto">
        {deck.map((emoji, idx) => {
          const isUp = Boolean(matched[idx]) || flipped.includes(idx);
          const isMatched = Boolean(matched[idx]);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCardTap(idx)}
              className={`h-12 rounded-[8px] border text-[21px] flex items-center justify-center transition select-none ${
                isMatched
                  ? 'bg-emerald-500/25 border-emerald-400/70 cursor-default'
                  : isUp
                    ? 'bg-[#1b3a73] border-[#60a5fa] cursor-default'
                    : 'bg-[#102347] border-white/15 hover:bg-[#183366] cursor-pointer active:scale-95'
              }`}
            >
              {isUp ? emoji : <span className="text-[13px] text-[#60a5fa]/60 font-bold">?</span>}
            </button>
          );
        })}
      </div>

      {finished && (
        <div className="rounded-[8px] bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1.5 text-center text-[12px] text-emerald-200 font-medium">
          🎉 Cleared in {moves} moves ({(elapsedMs / 1000).toFixed(1)}s)!
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <p className="text-[10.5px] uppercase tracking-wider text-[#8fa7cc] font-semibold flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Best Runs
          </p>
          {leaderboard.slice(0, 4).map((entry, i) => (
            <div key={entry.uid} className="flex items-center justify-between text-[11.5px]">
              <span className="truncate font-medium">
                {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `${i + 1}. `}
                {entry.uid === me.uid ? 'You' : entry.name}
              </span>
              <span className="font-mono text-[11px] text-[#cfe0fa] shrink-0">
                {entry.moves} moves · {(entry.timeMs / 1000).toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 6. MATH BLITZ (10-ROUND SPEED SPRINT) IN-BUBBLE VIEW
 * ========================================================================== */
const MathBlitzView: React.FC<SubGameProps> = ({
  chatId,
  messageId,
  game,
  me,
  soundEnabled,
}) => {
  const questions = useMemo(() => generateMathQuestions(game.seed || 67890, 10), [game.seed]);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [runStartMs, setRunStartMs] = useState(0);
  const [questionStartMs, setQuestionStartMs] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);

  const leaderboard = useMemo(() => {
    const list = Object.values(game.leaderboard || {}).filter(
      (e): e is MinigameLeaderboardEntry => Boolean(e && typeof e === 'object' && e.uid)
    );
    return list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeMs - b.timeMs;
    });
  }, [game.leaderboard]);

  const startRun = () => {
    const now = Date.now();
    setPhase('playing');
    setQIndex(0);
    setScore(0);
    setCorrectCount(0);
    setRunStartMs(now);
    setQuestionStartMs(now);
    setTotalTimeMs(0);
    setFlash(null);
  };

  const submitMathScore = async (finalScore: number, finalTimeMs: number, rightCount: number) => {
    await updateMinigameState(chatId, messageId, (curr) => {
      const lb = { ...(curr.leaderboard || {}) };
      const prev = lb[me.uid];
      const isBetter =
        !prev ||
        finalScore > prev.score ||
        (finalScore === prev.score && finalTimeMs < prev.timeMs);

      if (!isBetter) return null;

      lb[me.uid] = {
        uid: me.uid,
        name: me.displayName || 'Player',
        score: finalScore,
        moves: rightCount,
        timeMs: finalTimeMs,
        completedAt: Date.now(),
      };

      return {
        ...curr,
        leaderboard: lb,
        updatedAt: Date.now(),
      };
    }).catch(() => {});
  };

  const handleAnswer = (val: number) => {
    if (phase !== 'playing' || flash) return;
    const currentQ = questions[qIndex];
    const now = Date.now();
    const isRight = val === currentQ.answer;
    const speedBonus = isRight ? Math.max(0, Math.min(50, Math.round((5000 - (now - questionStartMs)) / 100))) : 0;
    const gained = isRight ? 100 + speedBonus : 0;
    const nextScore = score + gained;
    const nextRight = correctCount + (isRight ? 1 : 0);

    setScore(nextScore);
    setCorrectCount(nextRight);
    setFlash(isRight ? 'good' : 'bad');
    if (isRight) playUiSound('send', soundEnabled);

    setTimeout(() => {
      setFlash(null);
      if (qIndex + 1 >= questions.length) {
        const elapsed = Math.max(500, Date.now() - runStartMs);
        setTotalTimeMs(elapsed);
        setPhase('done');
        submitMathScore(nextScore, elapsed, nextRight);
      } else {
        setQIndex((i) => i + 1);
        setQuestionStartMs(Date.now());
      }
    }, 170);
  };

  const myBest = game.leaderboard?.[me.uid];

  return (
    <div className="space-y-2.5">
      {phase === 'idle' && (
        <div className="rounded-[9px] bg-[#102347] border border-white/10 p-3 text-center space-y-2.5">
          <p className="text-[12.5px] text-[#cfe0fa]">
            Solve 10 mental-math questions as fast as you can! Everyone gets the same questions.
          </p>
          {myBest && (
            <p className="text-[11.5px] text-amber-300 font-medium">
              Your best: {myBest.score} pts ({(myBest.timeMs / 1000).toFixed(1)}s)
            </p>
          )}
          <button
            type="button"
            onClick={startRun}
            className="w-full py-2 rounded-[8px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Zap className="w-4 h-4" />
            {myBest ? 'Play Again' : 'Start Blitz'}
          </button>
        </div>
      )}

      {phase === 'playing' && questions[qIndex] && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11.5px] text-[#b6cae8]">
            <span>
              Round <strong>{qIndex + 1}</strong>/{questions.length}
            </span>
            <span className="font-mono font-bold text-amber-300">{score} pts</span>
          </div>

          <div
            className={`rounded-[10px] py-3 px-3 text-center font-mono text-[22px] font-bold border transition ${
              flash === 'good'
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100'
                : flash === 'bad'
                  ? 'bg-rose-500/30 border-rose-400 text-rose-100'
                  : 'bg-[#102347] border-white/15 text-white'
            }`}
          >
            {questions[qIndex].prompt} = ?
          </div>

          <div className="grid grid-cols-2 gap-2">
            {questions[qIndex].choices.map((ch, idx) => (
              <button
                key={`${qIndex}-${idx}`}
                type="button"
                onClick={() => handleAnswer(ch)}
                className="py-2.5 rounded-[8px] bg-[#16305e] hover:bg-[#214585] border border-white/15 text-[15px] font-bold font-mono text-white cursor-pointer active:scale-95 transition"
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="rounded-[9px] bg-[#102347] border border-white/10 p-3 text-center space-y-2">
          <p className="text-[14px] font-bold text-emerald-300">
            ⚡ {score} points!
          </p>
          <p className="text-[12px] text-[#b6cae8]">
            {correctCount}/{questions.length} correct in {(totalTimeMs / 1000).toFixed(1)}s
          </p>
          <button
            type="button"
            onClick={startRun}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[12px] font-medium cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <p className="text-[10.5px] uppercase tracking-wider text-[#8fa7cc] font-semibold flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            High Scores
          </p>
          {leaderboard.slice(0, 4).map((entry, i) => (
            <div key={entry.uid} className="flex items-center justify-between text-[11.5px]">
              <span className="truncate font-medium">
                {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `${i + 1}. `}
                {entry.uid === me.uid ? 'You' : entry.name}
              </span>
              <span className="font-mono text-[11px] text-amber-200 shrink-0">
                {entry.score} pts · {(entry.timeMs / 1000).toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * MAIN IN-BUBBLE GAME CARD WRAPPER
 * ========================================================================== */
interface GameCardProps {
  message: ChatMessage;
  room: ChatRoom;
  me: UserProfile;
  onToast: (msg: string) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ message, room, me, onToast }) => {
  const game = message.game;
  if (!game || typeof game !== 'object') return null;

  const info = getMinigameInfo(game.kind);
  const soundEnabled = me.privacy?.soundEnabled ?? true;
  const subProps: SubGameProps = {
    chatId: message.chatId,
    messageId: message.id,
    game,
    room,
    me,
    soundEnabled,
    onToast,
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="my-1 rounded-[12px] bg-[#081329]/85 border border-white/15 p-3 text-[#eaf2ff] shadow-inner space-y-2.5"
    >
      {/* Card Top Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-[8px] bg-[#3b82f6]/25 border border-[#60a5fa]/40 flex items-center justify-center text-[15px] shrink-0">
            {info.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-tight truncate">{info.title}</p>
            <p className="text-[10.5px] text-[#8fa7cc] leading-tight">
              {game.mode === 'bot'
                ? 'vs Bot 🤖'
                : game.mode === 'pass'
                  ? 'Pass & Play'
                  : game.mode === 'party'
                    ? 'Chat Challenge'
                    : 'Multiplayer'}
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10.5px] font-medium text-[#cfe0fa] shrink-0">
          {game.kind === 'rps'
            ? 'Best of 3'
            : game.roundNumber && game.roundNumber > 1
              ? `Round ${game.roundNumber}`
              : info.badge}
        </span>
      </div>

      {/* Active Game Engine View */}
      {game.kind === 'tictactoe' && <TicTacToeView {...subProps} />}
      {game.kind === 'connect4' && <ConnectFourView {...subProps} />}
      {game.kind === 'rps' && <RpsView {...subProps} />}
      {game.kind === 'wordle' && <WordleView {...subProps} />}
      {game.kind === 'memory' && <MemoryView {...subProps} />}
      {game.kind === 'mathblitz' && <MathBlitzView {...subProps} />}
    </div>
  );
};

/* ============================================================================
 * MINIGAME LAUNCHER MODAL
 * ========================================================================== */
interface GameLauncherModalProps {
  open: boolean;
  onClose: () => void;
  room: ChatRoom;
  me: UserProfile;
  isLight?: boolean;
  onLaunchGame: (gameData: MinigameData) => Promise<void>;
  onToast: (msg: string) => void;
}

export const GameLauncherModal: React.FC<GameLauncherModalProps> = ({
  open,
  onClose,
  room,
  me,
  isLight = false,
  onLaunchGame,
  onToast,
}) => {
  const isSelfChat = room.type === 'self';
  const [selectedKind, setSelectedKind] = useState<MinigameKind>('tictactoe');
  const [duelMode, setDuelMode] = useState<'pvp' | 'bot' | 'pass'>(isSelfChat ? 'bot' : 'pvp');
  const [wordMode, setWordMode] = useState<'random' | 'custom'>('random');
  const [customWord, setCustomWord] = useState('');
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (open) {
      setDuelMode(isSelfChat ? 'bot' : 'pvp');
      setWordMode('random');
      setCustomWord('');
      setLaunching(false);
    }
  }, [open, isSelfChat]);

  if (!open) return null;

  const selectedMeta = getMinigameInfo(selectedKind);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (launching) return;

    if (selectedKind === 'wordle' && wordMode === 'custom') {
      const cleaned = customWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (cleaned.length !== 5) {
        onToast('Custom secret word must be exactly 5 letters (A–Z).');
        return;
      }
    }

    setLaunching(true);
    try {
      const effectiveMode: MinigameMode =
        selectedMeta.category === 'party'
          ? 'party'
          : isSelfChat && duelMode === 'pvp'
            ? 'bot'
            : duelMode;

      const gameData = createInitialMinigameData({
        kind: selectedKind,
        host: me,
        mode: effectiveMode,
        customWord: selectedKind === 'wordle' && wordMode === 'custom' ? customWord : undefined,
      });

      await onLaunchGame(gameData);
      onClose();
    } catch (err: unknown) {
      onToast((err as Error).message || 'Could not start minigame');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-[12px] border shadow-2xl overflow-hidden ${
          isLight
            ? 'bg-white border-[#cfdcf0] text-[#0a1630]'
            : 'bg-[#0a1630] border-[#1d3764] text-[#eaf2ff]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isLight ? 'bg-[#eaf1fc] border-[#cfdcf0]' : 'bg-[#12254a] border-[#1d3764]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-5 h-5 text-[#3b82f6]" />
            <h2 className="font-semibold text-[16px]">Chat Minigames</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#8fa7cc] hover:text-current cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleStart} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* 6-Game Picker Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MINIGAME_CATALOG.map((item) => {
              const active = selectedKind === item.kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => setSelectedKind(item.kind)}
                  className={`p-3 rounded-[10px] border text-left transition cursor-pointer flex items-start gap-3 ${
                    active
                      ? 'border-[#3b82f6] bg-[#3b82f6]/15 ring-1 ring-[#3b82f6]'
                      : isLight
                        ? 'border-[#cfdcf0] bg-[#f8fafc] hover:bg-[#eef4fc]'
                        : 'border-[#1d3764] bg-[#102042] hover:bg-[#152a54]'
                  }`}
                >
                  <span className="w-9 h-9 rounded-[9px] bg-[#3b82f6]/20 flex items-center justify-center text-[19px] shrink-0">
                    {item.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-semibold text-[13.5px] truncate">{item.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#3b82f6]/20 text-[#60a5fa] font-medium shrink-0">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#8fa7cc] leading-4 mt-1">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode Options for 1v1 Duel Games */}
          {selectedMeta.category === 'duel' && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[12.5px] text-[#8fa7cc] font-medium">Opponent mode</p>
              <div className="grid grid-cols-2 gap-2">
                {!isSelfChat ? (
                  <button
                    type="button"
                    onClick={() => setDuelMode('pvp')}
                    className={`py-2 px-3 rounded-[8px] border text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition ${
                      duelMode === 'pvp'
                        ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                        : isLight
                          ? 'border-[#cfdcf0] text-[#34476a]'
                          : 'border-[#1d3764] bg-[#12254a] text-[#cfe0fa]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Play with Chat
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDuelMode('pass')}
                    className={`py-2 px-3 rounded-[8px] border text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition ${
                      duelMode === 'pass'
                        ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                        : isLight
                          ? 'border-[#cfdcf0] text-[#34476a]'
                          : 'border-[#1d3764] bg-[#12254a] text-[#cfe0fa]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Pass & Play
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDuelMode('bot')}
                  className={`py-2 px-3 rounded-[8px] border text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition ${
                    duelMode === 'bot'
                      ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                      : isLight
                        ? 'border-[#cfdcf0] text-[#34476a]'
                        : 'border-[#1d3764] bg-[#12254a] text-[#cfe0fa]'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  Play vs Bot
                </button>
              </div>
            </div>
          )}

          {/* Custom vs Random Word Option for Word Guess */}
          {selectedKind === 'wordle' && (
            <div className="space-y-2.5 pt-1">
              <p className="text-[12.5px] text-[#8fa7cc] font-medium">Secret 5-letter word</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWordMode('random')}
                  className={`py-2 px-3 rounded-[8px] border text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition ${
                    wordMode === 'random'
                      ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                      : isLight
                        ? 'border-[#cfdcf0] text-[#34476a]'
                        : 'border-[#1d3764] bg-[#12254a] text-[#cfe0fa]'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Random Word
                </button>
                <button
                  type="button"
                  onClick={() => setWordMode('custom')}
                  className={`py-2 px-3 rounded-[8px] border text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition ${
                    wordMode === 'custom'
                      ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                      : isLight
                        ? 'border-[#cfdcf0] text-[#34476a]'
                        : 'border-[#1d3764] bg-[#12254a] text-[#cfe0fa]'
                  }`}
                >
                  Custom Word
                </button>
              </div>

              {wordMode === 'custom' && (
                <input
                  type="text"
                  value={customWord}
                  onChange={(e) =>
                    setCustomWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))
                  }
                  placeholder="Enter 5 letters (e.g. PIXEL)"
                  maxLength={5}
                  className={`w-full px-3 py-2 rounded-[8px] font-mono tracking-[0.25em] uppercase text-[14px] outline-none border ${
                    isLight
                      ? 'bg-[#eaf1fc] border-[#cfdcf0]'
                      : 'bg-[#12254a] border-[#1d3764]'
                  }`}
                />
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={launching}
            className="w-full py-2.5 rounded-[8px] bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-50 text-white font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <Gamepad2 className="w-4 h-4" />
            {launching ? 'Starting...' : `Send ${selectedMeta.title} to Chat`}
          </button>
        </form>
      </div>
    </div>
  );
};
