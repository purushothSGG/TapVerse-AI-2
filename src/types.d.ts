export type GameStats = {
  score: number;
  totalTaps: number;
  durationMs: number;
  bestStreak: number;
  timestamps: number[];
  highScore?: number;
  dueToWrongTap?: boolean;
};
