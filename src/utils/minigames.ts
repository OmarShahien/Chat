import type {
  MinigameData,
  MinigameKind,
  MinigameMode,
  RpsThrow,
  UserProfile,
} from '../types';

export interface MinigameCatalogItem {
  kind: MinigameKind;
  title: string;
  shortTitle: string;
  emoji: string;
  badge: string;
  description: string;
  category: 'duel' | 'party';
}

export const MINIGAME_CATALOG: MinigameCatalogItem[] = [
  {
    kind: 'tictactoe',
    title: 'Tic-Tac-Toe',
    shortTitle: 'Tic-Tac-Toe',
    emoji: '❌',
    badge: '1v1 · Bot',
    description: 'Classic 3×3 tactics. Line up three marks to win the round.',
    category: 'duel',
  },
  {
    kind: 'connect4',
    title: 'Connect Four',
    shortTitle: 'Connect 4',
    emoji: '🔴',
    badge: '1v1 · Bot',
    description: 'Drop discs into the 7×6 rack and connect four in any direction.',
    category: 'duel',
  },
  {
    kind: 'rps',
    title: 'Rock Paper Scissors',
    shortTitle: 'Rock Paper Scissors',
    emoji: '✂️',
    badge: 'Best of 3',
    description: 'Simultaneous hidden throws. First player to win 2 rounds takes it.',
    category: 'duel',
  },
  {
    kind: 'wordle',
    title: 'Word Guess',
    shortTitle: 'Word Guess',
    emoji: '🟩',
    badge: 'Everyone Plays',
    description: 'Crack the secret 5-letter word in 6 tries — random or custom word.',
    category: 'party',
  },
  {
    kind: 'memory',
    title: 'Emoji Memory',
    shortTitle: 'Emoji Memory',
    emoji: '🃏',
    badge: 'Leaderboard',
    description: 'Flip and match all 8 emoji pairs in the fewest moves & fastest time.',
    category: 'party',
  },
  {
    kind: 'mathblitz',
    title: 'Math Blitz',
    shortTitle: 'Math Blitz',
    emoji: '⚡',
    badge: 'Speed Score',
    description: 'Race through 10 mental-math rounds to claim the #1 chat high score.',
    category: 'party',
  },
];

export function getMinigameInfo(kind?: MinigameKind): MinigameCatalogItem {
  return MINIGAME_CATALOG.find((g) => g.kind === kind) || MINIGAME_CATALOG[0];
}

/* -------------------- Seeded PRNG -------------------- */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------- 1. Tic-Tac-Toe -------------------- */
export const TTT_EMPTY_BOARD = '.........';

const TTT_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function normalizeTttBoard(board?: string): string {
  if (typeof board === 'string' && board.length === 9) return board;
  return TTT_EMPTY_BOARD;
}

export function checkTicTacToeResult(boardRaw?: string): {
  winner: 'p1' | 'p2' | 'draw' | '';
  winLine: string;
} {
  const b = normalizeTttBoard(boardRaw);
  for (const [i, j, k] of TTT_LINES) {
    const ch = b[i];
    if ((ch === 'X' || ch === 'O') && ch === b[j] && ch === b[k]) {
      return {
        winner: ch === 'X' ? 'p1' : 'p2',
        winLine: `${i},${j},${k}`,
      };
    }
  }
  if (!b.includes('.')) {
    return { winner: 'draw', winLine: '' };
  }
  return { winner: '', winLine: '' };
}

function minimaxTtt(board: string, isBotTurn: boolean, botMark: 'X' | 'O', humanMark: 'X' | 'O', depth: number): number {
  const res = checkTicTacToeResult(board);
  if (res.winner === (botMark === 'X' ? 'p1' : 'p2')) return 10 - depth;
  if (res.winner === (humanMark === 'X' ? 'p1' : 'p2')) return depth - 10;
  if (res.winner === 'draw') return 0;

  let best = isBotTurn ? -Infinity : Infinity;
  const mark = isBotTurn ? botMark : humanMark;
  for (let idx = 0; idx < 9; idx++) {
    if (board[idx] !== '.') continue;
    const next = board.slice(0, idx) + mark + board.slice(idx + 1);
    const score = minimaxTtt(next, !isBotTurn, botMark, humanMark, depth + 1);
    best = isBotTurn ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export function chooseTicTacToeBotMove(
  boardRaw: string,
  botMark: 'X' | 'O' = 'O',
  humanMark: 'X' | 'O' = 'X'
): number {
  const board = normalizeTttBoard(boardRaw);
  const available: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === '.') available.push(i);
  }
  if (available.length === 0) return -1;

  // Slight opening variety on the very first bot move so games stay dynamic
  if (available.length >= 8 && Math.random() < 0.2) {
    const cornersAndCenter = [0, 2, 4, 6, 8].filter((i) => board[i] === '.');
    if (cornersAndCenter.length > 0) {
      return cornersAndCenter[Math.floor(Math.random() * cornersAndCenter.length)];
    }
  }

  let bestScore = -Infinity;
  let bestMoves: number[] = [];
  for (const idx of available) {
    const next = board.slice(0, idx) + botMark + board.slice(idx + 1);
    const score = minimaxTtt(next, false, botMark, humanMark, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [idx];
    } else if (score === bestScore) {
      bestMoves.push(idx);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/* -------------------- 2. Connect Four -------------------- */
export const C4_ROWS = 6;
export const C4_COLS = 7;
export const C4_EMPTY_BOARD = '.'.repeat(C4_ROWS * C4_COLS);

export function normalizeC4Board(board?: string): string {
  if (typeof board === 'string' && board.length === C4_ROWS * C4_COLS) return board;
  return C4_EMPTY_BOARD;
}

export function dropConnectFourDisc(
  boardRaw: string,
  col: number,
  disc: '1' | '2'
): { nextBoard: string; index: number } | null {
  if (col < 0 || col >= C4_COLS) return null;
  const board = normalizeC4Board(boardRaw);
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const idx = row * C4_COLS + col;
    if (board[idx] === '.') {
      const nextBoard = board.slice(0, idx) + disc + board.slice(idx + 1);
      return { nextBoard, index: idx };
    }
  }
  return null;
}

export function checkConnectFourResult(boardRaw?: string): {
  winner: 'p1' | 'p2' | 'draw' | '';
  winLine: string;
} {
  const b = normalizeC4Board(boardRaw);
  const dirs = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diag down-right
    [1, -1], // diag down-left
  ] as const;

  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const ch = b[r * C4_COLS + c];
      if (ch !== '1' && ch !== '2') continue;

      for (const [dr, dc] of dirs) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= C4_ROWS || endC < 0 || endC >= C4_COLS) continue;

        const i1 = (r + dr) * C4_COLS + (c + dc);
        const i2 = (r + dr * 2) * C4_COLS + (c + dc * 2);
        const i3 = endR * C4_COLS + endC;
        if (b[i1] === ch && b[i2] === ch && b[i3] === ch) {
          const i0 = r * C4_COLS + c;
          return {
            winner: ch === '1' ? 'p1' : 'p2',
            winLine: `${i0},${i1},${i2},${i3}`,
          };
        }
      }
    }
  }

  if (!b.includes('.')) {
    return { winner: 'draw', winLine: '' };
  }
  return { winner: '', winLine: '' };
}

export function chooseConnectFourBotMove(
  boardRaw: string,
  botDisc: '1' | '2' = '2',
  humanDisc: '1' | '2' = '1'
): number {
  const board = normalizeC4Board(boardRaw);
  const validCols: number[] = [];
  for (let c = 0; c < C4_COLS; c++) {
    if (board[c] === '.') validCols.push(c);
  }
  if (validCols.length === 0) return -1;

  const botWinnerTag = botDisc === '1' ? 'p1' : 'p2';
  const humanWinnerTag = humanDisc === '1' ? 'p1' : 'p2';

  // 1. Immediate winning move
  for (const c of validCols) {
    const dropped = dropConnectFourDisc(board, c, botDisc);
    if (dropped && checkConnectFourResult(dropped.nextBoard).winner === botWinnerTag) {
      return c;
    }
  }

  // 2. Block opponent's immediate winning move
  for (const c of validCols) {
    const dropped = dropConnectFourDisc(board, c, humanDisc);
    if (dropped && checkConnectFourResult(dropped.nextBoard).winner === humanWinnerTag) {
      return c;
    }
  }

  // 3. Avoid gifting opponent a winning move right above ours, and prefer center + combos
  let bestCol = validCols[0];
  let bestScore = -Infinity;

  for (const c of validCols) {
    const dropped = dropConnectFourDisc(board, c, botDisc)!;
    let score = (3 - Math.abs(3 - c)) * 4 + Math.random() * 1.5;

    // Check if opponent can immediately win after our drop
    for (const oppCol of validCols) {
      const oppDrop = dropConnectFourDisc(dropped.nextBoard, oppCol, humanDisc);
      if (oppDrop && checkConnectFourResult(oppDrop.nextBoard).winner === humanWinnerTag) {
        score -= 100;
      }
    }

    // Bonus for adjacent friendly discs around our drop
    const r = Math.floor(dropped.index / C4_COLS);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < C4_ROWS && nc >= 0 && nc < C4_COLS) {
          if (board[nr * C4_COLS + nc] === botDisc) score += 3;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }

  return bestCol;
}

/* -------------------- 3. Rock Paper Scissors -------------------- */
export const RPS_OPTIONS: Array<{ id: RpsThrow; emoji: string; label: string }> = [
  { id: 'rock', emoji: '🪨', label: 'Rock' },
  { id: 'paper', emoji: '📄', label: 'Paper' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors' },
];

export function getRpsEmoji(move: RpsThrow): string {
  return move === 'rock' ? '🪨' : move === 'paper' ? '📄' : '✂️';
}

export function resolveRpsWinner(p1: RpsThrow, p2: RpsThrow): 'p1' | 'p2' | 'draw' {
  if (p1 === p2) return 'draw';
  if (
    (p1 === 'rock' && p2 === 'scissors') ||
    (p1 === 'paper' && p2 === 'rock') ||
    (p1 === 'scissors' && p2 === 'paper')
  ) {
    return 'p1';
  }
  return 'p2';
}

export function randomRpsThrow(): RpsThrow {
  const list: RpsThrow[] = ['rock', 'paper', 'scissors'];
  return list[Math.floor(Math.random() * list.length)];
}

/* -------------------- 4. Word Guess (5-Letter Wordle) -------------------- */
export const WORDLE_WORD_BANK: readonly string[] = [
  'ABOUT', 'ABOVE', 'ACTOR', 'ACUTE', 'ALIVE', 'ALONE', 'AMBER', 'ANGEL', 'APPLE', 'ARENA',
  'ARROW', 'AUDIO', 'AWAKE', 'BADGE', 'BAKER', 'BEACH', 'BERRY', 'BIRTH', 'BLACK', 'BLADE',
  'BLAZE', 'BLEND', 'BLINK', 'BLOCK', 'BLOOM', 'BOARD', 'BOOST', 'BRAIN', 'BRAVE', 'BREAD',
  'BREAK', 'BRICK', 'BRING', 'BRUSH', 'BUILD', 'BURST', 'CABIN', 'CANDY', 'CARGO', 'CHAIR',
  'CHARM', 'CHASE', 'CHESS', 'CHILL', 'CLEAN', 'CLEAR', 'CLIMB', 'CLOCK', 'CLOUD', 'COAST',
  'COMET', 'CORAL', 'COUNT', 'COURT', 'CRAFT', 'CRANE', 'CRASH', 'CREAM', 'CRISP', 'CROWN',
  'DANCE', 'DELTA', 'DREAM', 'DRIFT', 'DRINK', 'DRIVE', 'EAGLE', 'EARTH', 'ELITE', 'EMBER',
  'ENJOY', 'EQUAL', 'FABLE', 'FAITH', 'FEAST', 'FIELD', 'FINAL', 'FLAME', 'FLASH', 'FLEET',
  'FLOAT', 'FLOOR', 'FOCUS', 'FORCE', 'FORGE', 'FRAME', 'FRESH', 'FRONT', 'FROST', 'FRUIT',
  'GAMER', 'GHOST', 'GIANT', 'GLARE', 'GLASS', 'GLOBE', 'GLORY', 'GRACE', 'GRAND', 'GRAPE',
  'GREAT', 'GREEN', 'GROUP', 'GUARD', 'GUIDE', 'HAPPY', 'HEART', 'HONEY', 'HORSE', 'HOUSE',
  'HUMOR', 'IMAGE', 'INDEX', 'IVORY', 'JELLY', 'JEWEL', 'JOLLY', 'JUICE', 'KARMA', 'KNOCK',
  'LASER', 'LAUGH', 'LAYER', 'LEARN', 'LEMON', 'LEVEL', 'LIGHT', 'LUCKY', 'LUNAR', 'MAGIC',
  'MAJOR', 'MANGO', 'MAPLE', 'MARCH', 'MATCH', 'MEDAL', 'METAL', 'MIGHT', 'MODEL', 'MONEY',
  'MONTH', 'MOUNT', 'MOUSE', 'MUSIC', 'NIGHT', 'NOBLE', 'NORTH', 'NOVEL', 'OCEAN', 'OLIVE',
  'OPERA', 'ORBIT', 'OTHER', 'PAINT', 'PANEL', 'PARTY', 'PEACE', 'PEACH', 'PEARL', 'PHONE',
  'PHOTO', 'PIANO', 'PILOT', 'PIXEL', 'PIZZA', 'PLANE', 'PLANT', 'PLATE', 'PLAZA', 'POINT',
  'POWER', 'PRESS', 'PRIDE', 'PRIME', 'PRISM', 'PRIZE', 'PULSE', 'QUEEN', 'QUEST', 'QUICK',
  'QUIET', 'RADAR', 'RADIO', 'RAISE', 'RANCH', 'RANGE', 'RAPID', 'REACH', 'REACT', 'REALM',
  'RELAX', 'RIDGE', 'RIVER', 'ROAST', 'ROBOT', 'ROCKY', 'ROUND', 'ROYAL', 'SCALE', 'SCENE',
  'SCOPE', 'SCORE', 'SCOUT', 'SHADE', 'SHARE', 'SHARK', 'SHARP', 'SHIFT', 'SHINE', 'SHORE',
  'SIGHT', 'SKILL', 'SLATE', 'SLEEP', 'SLICE', 'SMART', 'SMILE', 'SMOKE', 'SOLAR', 'SOLID',
  'SONIC', 'SOUND', 'SOUTH', 'SPACE', 'SPARK', 'SPEAK', 'SPEED', 'SPICE', 'SPORT', 'STAGE',
  'STAND', 'START', 'STEAM', 'STEEL', 'STONE', 'STORM', 'STORY', 'STYLE', 'SUGAR', 'SUNNY',
  'SUPER', 'SWEET', 'SWIFT', 'SWORD', 'TABLE', 'TASTE', 'THEME', 'TIGER', 'TODAY', 'TOWER',
  'TRACK', 'TRAIL', 'TRAIN', 'TREAT', 'TREND', 'TRUST', 'TRUTH', 'ULTRA', 'UNITY', 'URBAN',
  'VALUE', 'VAULT', 'VIDEO', 'VIVID', 'VOICE', 'WATCH', 'WATER', 'WHALE', 'WHEAT', 'WHEEL',
  'WHITE', 'WORLD', 'WRITE', 'YOUTH', 'ZEBRA',
];

export function pickRandomWordleWord(): string {
  return WORDLE_WORD_BANK[Math.floor(Math.random() * WORDLE_WORD_BANK.length)];
}

export function encodeSecretWord(word: string): string {
  const clean = word.trim().toUpperCase();
  const shifted = clean
    .split('')
    .map((ch, idx) => String.fromCharCode(((ch.charCodeAt(0) - 65 + 7 + idx * 3) % 26) + 65))
    .join('');
  return `cw1:${shifted}`;
}

export function decodeSecretWord(encoded?: string): string {
  if (!encoded) return 'CRANE';
  if (!encoded.startsWith('cw1:')) {
    return encoded.trim().toUpperCase().slice(0, 5) || 'CRANE';
  }
  const body = encoded.slice(4).toUpperCase();
  return body
    .split('')
    .map((ch, idx) => {
      const code = (ch.charCodeAt(0) - 65 - (7 + idx * 3)) % 26;
      return String.fromCharCode(((code + 26) % 26) + 65);
    })
    .join('');
}

export type WordleLetterStatus = 'correct' | 'present' | 'absent';

export function evaluateWordleGuess(guessRaw: string, targetRaw: string): WordleLetterStatus[] {
  const guess = guessRaw.toUpperCase().padEnd(5, ' ').slice(0, 5);
  const target = targetRaw.toUpperCase().padEnd(5, ' ').slice(0, 5);
  const result: WordleLetterStatus[] = ['absent', 'absent', 'absent', 'absent', 'absent'];
  const remaining: Record<string, number> = {};

  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
    } else {
      remaining[target[i]] = (remaining[target[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (remaining[ch] && remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch] -= 1;
    }
  }

  return result;
}

/* -------------------- 5. Emoji Memory (4x4 = 8 pairs) -------------------- */
const MEMORY_EMOJI_POOL = [
  '🚀', '🦊', '🍕', '🎸', '🌈', '💎', '⚡', '🐙',
  '🎯', '🦄', '🍓', '🎮', '🔥', '🐬', '👑', '🪐',
];

export function generateMemoryDeck(seed: number): string[] {
  const rng = mulberry32(seed || 12345);
  const pool = [...MEMORY_EMOJI_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, 8);
  const deck = [...chosen, ...chosen];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/* -------------------- 6. Math Blitz (10 seeded questions) -------------------- */
export interface MathQuestion {
  prompt: string;
  answer: number;
  choices: number[];
}

export function generateMathQuestions(seed: number, count = 10): MathQuestion[] {
  const rng = mulberry32(seed || 67890);
  const questions: MathQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const difficulty = Math.floor(i / 3); // 0, 1, 2, 3
    const opRoll = rng();
    let a = 0;
    let b = 0;
    let answer = 0;
    let symbol = '+';

    if (opRoll < 0.4) {
      symbol = '+';
      const max = 14 + difficulty * 18;
      a = 4 + Math.floor(rng() * max);
      b = 3 + Math.floor(rng() * max);
      answer = a + b;
    } else if (opRoll < 0.72) {
      symbol = '−';
      const max = 18 + difficulty * 20;
      a = 10 + Math.floor(rng() * max);
      b = 2 + Math.floor(rng() * Math.max(3, a - 2));
      answer = a - b;
    } else {
      symbol = '×';
      const maxA = 7 + difficulty * 3;
      const maxB = 6 + difficulty * 3;
      a = 2 + Math.floor(rng() * maxA);
      b = 2 + Math.floor(rng() * maxB);
      answer = a * b;
    }

    const choiceSet = new Set<number>([answer]);
    const offsets = [-10, -5, -3, -2, -1, 1, 2, 3, 4, 5, 10, 12];
    let guard = 0;
    while (choiceSet.size < 4 && guard < 40) {
      guard++;
      const off = offsets[Math.floor(rng() * offsets.length)];
      const cand = answer + off;
      if (cand >= 0 && cand !== answer) {
        choiceSet.add(cand);
      }
    }
    while (choiceSet.size < 4) {
      choiceSet.add(answer + choiceSet.size);
    }

    const choices = Array.from(choiceSet);
    for (let j = choices.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [choices[j], choices[k]] = [choices[k], choices[j]];
    }

    questions.push({
      prompt: `${a} ${symbol} ${b}`,
      answer,
      choices,
    });
  }

  return questions;
}

/* -------------------- Initial Game State Factory -------------------- */
export interface CreateMinigameOptions {
  kind: MinigameKind;
  host: UserProfile;
  mode: MinigameMode;
  customWord?: string;
}

export function createInitialMinigameData(opts: CreateMinigameOptions): MinigameData {
  const { kind, host, mode, customWord } = opts;
  const now = Date.now();
  const hostName = host.displayName || 'Player 1';

  const base: MinigameData = {
    kind,
    mode,
    hostUid: host.uid,
    hostName,
    ...(mode === 'bot'
      ? { guestUid: '__bot__', guestName: 'Bot 🤖' }
      : mode === 'pass'
        ? { guestUid: '__pass__', guestName: 'Player 2' }
        : {}),
    status: mode === 'pvp' ? 'waiting' : 'active',
    p1Score: 0,
    p2Score: 0,
    roundNumber: 1,
    updatedAt: now,
  };

  if (kind === 'tictactoe') {
    return {
      ...base,
      turn: 'p1',
      winner: '',
      board: TTT_EMPTY_BOARD,
      winLine: '',
    };
  }

  if (kind === 'connect4') {
    return {
      ...base,
      turn: 'p1',
      winner: '',
      board: C4_EMPTY_BOARD,
      winLine: '',
      lastMoveIndex: -1,
    };
  }

  if (kind === 'rps') {
    return {
      ...base,
      winner: '',
      p1RoundWins: 0,
      p2RoundWins: 0,
      p1Pick: '',
      p2Pick: '',
    };
  }

  if (kind === 'wordle') {
    const cleanedCustom = (customWord || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    const isCustom = cleanedCustom.length === 5;
    const chosenWord = isCustom ? cleanedCustom : pickRandomWordleWord();
    return {
      ...base,
      mode: 'party',
      status: 'active',
      secretWord: encodeSecretWord(chosenWord),
      isCustomWord: isCustom,
      wordPlayers: {},
    };
  }

  // 'memory' or 'mathblitz'
  const seed = Math.floor(100000 + Math.random() * 899999);
  return {
    ...base,
    mode: 'party',
    status: 'active',
    seed,
    leaderboard: {},
  };
}
