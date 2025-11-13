import  { useEffect, useRef, useState } from "react";
import type { GameStats } from "../types";

type Props = {
  onGameOver: (stats: GameStats) => void;
};

const GRID = 4; // 4x4
const CELLS = GRID * GRID;
const START_BLACK = 3;
const INITIAL_TIME_MS = 10_000; // 10 seconds
const BONUS_TIME_MS = 5_000; // +5s bonus for every 20 consecutive hits
const BONUS_STREAK = 20; // 20 consecutive correct taps => +5s

export default function BlackTapGame({ onGameOver }: Props) {
  // tile state: true = black, false = white
  const [tiles, setTiles] = useState<boolean[]>(() => randomInitialBlack());
  const [score, setScore] = useState(0);
  const [consecutive, setConsecutive] = useState(0); // consecutive correct taps
  const [bestConsecutive, setBestConsecutive] = useState(0);
  const [running, setRunning] = useState(true);
  const [timeLeftMs, setTimeLeftMs] = useState(INITIAL_TIME_MS);
// keep refs for values the timer callback / endGame will need
const scoreRef = useRef<number>(0);
const consecutiveRef = useRef<number>(0);
const bestConsecutiveRef = useRef<number>(0);
const startRef = useRef<number | null>(null);

  // high score persisted
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const v = localStorage.getItem("tapthalaivaa_highscore");
      return v ? Number(v) : 0;
    } catch {
      return 0;
    }
  });

  // ---------- AUDIO (Web Audio API) ----------
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const frequencies = [
    523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5,
    1174.66, 1318.51, 1396.91, 1567.98, 1760.0, 1975.53, 2093.0, 2349.32,
  ];

  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGainRef.current = audioCtxRef.current.createGain();
    masterGainRef.current.gain.value = 0.08;
    masterGainRef.current.connect(audioCtxRef.current.destination);
    return () => {
      try {
        audioCtxRef.current?.close();
      } catch {}
      audioCtxRef.current = null;
      masterGainRef.current = null;
    };
  }, []);

  function resumeAudioContextIfNeeded() {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  function playNote(tileIndex: number, isHit = true) {
    const ctx = audioCtxRef.current;
    const gain = masterGainRef.current;
    if (!ctx || !gain) return;
    resumeAudioContextIfNeeded();
    const now = ctx.currentTime;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(isHit ? 1.0 : 0.5, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    envelope.connect(gain);

    if (isHit) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const freq = frequencies[tileIndex % frequencies.length];
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(envelope);
      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "square";
      osc2.type = "square";
      osc1.frequency.setValueAtTime(120, now);
      osc2.frequency.setValueAtTime(140, now);
      const mix = ctx.createGain();
      mix.gain.value = 0.5;
      osc1.connect(mix);
      osc2.connect(mix);
      mix.connect(envelope);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.14);
      osc2.stop(now + 0.14);
    }
  }

  // timer
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    startTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTimer() {
  // record start time (ms)
  startRef.current = Date.now();
  // clear any existing interval first
  if (intervalRef.current) {
    window.clearInterval(intervalRef.current);
  }
  intervalRef.current = window.setInterval(() => {
    setTimeLeftMs((t) => {
      if (t <= 100) {
        // time is up — stop timer and end game
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // set timeLeft to 0 (so UI shows 0) and call endGame
        // we call endGame AFTER setting running false inside it
        setTimeLeftMs(0);
        endGame(false);
        return 0;
      }
      return t - 100;
    });
  }, 100);
}

function stopTimer() {
  if (intervalRef.current) {
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
}


  function randomInitialBlack(): boolean[] {
    const arr = Array(CELLS).fill(false);
    let placed = 0;
    while (placed < START_BLACK) {
      const idx = Math.floor(Math.random() * CELLS);
      if (!arr[idx]) {
        arr[idx] = true;
        placed++;
      }
    }
    return arr;
  }

 function handleTap(idx: number) {
  if (!running) return;

  // wrong tile -> immediate game over
  if (!tiles[idx]) {
    try { playNote(idx, false); } catch {}
    setRunning(false);
    endGame(true);
    return;
  }

  // correct tile tapped
  try { playNote(idx, true); } catch {}

  // increment score (keep ref and state in sync)
  scoreRef.current = (scoreRef.current ?? 0) + 1;
  setScore(scoreRef.current);

  // increment consecutive in ref synchronously, then update state
  const nextConsec = (consecutiveRef.current ?? consecutive) + 1;
  consecutiveRef.current = nextConsec;
  setConsecutive(nextConsec);

  // update bestConsecutive if needed (ref + state)
  if ((bestConsecutiveRef.current ?? bestConsecutive) < nextConsec) {
    bestConsecutiveRef.current = nextConsec;
    setBestConsecutive(nextConsec);
  }

  // BONUS: award +5s for every BONUS_STREAK consecutive correct taps
  // (e.g., 20, 40, 60...). No cooldown here — repeats allowed on multiples.
  if (nextConsec % BONUS_STREAK === 0) {
    // give bonus time
    setTimeLeftMs((t) => {
      const newT = t + BONUS_TIME_MS;
      // small visual/audio feedback could be triggered here
      return newT;
    });

    // optional: play a bonus sound/animation
    try {
      // playNote or a dedicated bonus sound if you have one
      // playBonusSound?.();
    } catch (e) {}
  }

  // swap tiles: tapped black -> white, random white -> black
  setTiles((prev) => {
    const next = prev.slice();
    next[idx] = false;
    const whiteIndices = next
      .map((v, i) => ({ v, i }))
      .filter((p) => p.v === false)
      .map((p) => p.i);
    if (whiteIndices.length > 0) {
      const r = Math.floor(Math.random() * whiteIndices.length);
      next[whiteIndices[r]] = true;
    }
    return next;
  });
}


  function endGame(dueToWrongTap: boolean) {
  // stop timer loop
  stopTimer();
  setRunning(false);

  // compute final score safely from scoreRef if you use it, otherwise fallback to state
  const finalScore = typeof scoreRef !== "undefined" && scoreRef.current !== undefined
    ? scoreRef.current
    : score;

  // compute duration from startRef (most accurate)
  const now = Date.now();
  const durationMs = startRef.current ? Math.max(0, now - startRef.current) : (INITIAL_TIME_MS - timeLeftMs > 0 ? INITIAL_TIME_MS - timeLeftMs : 0);

  // update high score safely
  try {
    const existing = Number(localStorage.getItem("tapthalaivaa_highscore") || "0");
    if (finalScore > existing) {
      localStorage.setItem("tapthalaivaa_highscore", String(finalScore));
      setHighScore(finalScore);
    }
  } catch (e) {
    // ignore storage errors
  }

  const stats: GameStats = {
    score: finalScore,
    totalTaps: finalScore,
    durationMs,
    bestStreak: bestConsecutiveRef?.current ?? bestConsecutive,
    timestamps: [],
    highScore,
    dueToWrongTap: dueToWrongTap,
  };

  // brief delay so final UI updates / sound play
  setTimeout(() => onGameOver(stats), 300);
}



  function resetGame() {
  // reset tiles & states
  setTiles(randomInitialBlack());
  setScore(0);
  if (scoreRef) scoreRef.current = 0;
  setConsecutive(0);
  if (consecutiveRef) consecutiveRef.current = 0;
  setBestConsecutive(0);
  if (bestConsecutiveRef) bestConsecutiveRef.current = 0;

  // reset timer & start timestamp
  setTimeLeftMs(INITIAL_TIME_MS);
  startRef.current = Date.now();
  setRunning(true);

  // restart timer loop
  startTimer();

  // ensure audio unlocked on next gesture
  resumeAudioContextIfNeeded();
}


  // progress bar computation
  const progress = Math.max(0, timeLeftMs / INITIAL_TIME_MS);
  const lowThreshold = 0.15;
  const warnThreshold = 0.3;

  return (
    <div className="game-root">
      <div className="hud">
        <div className="hud-item">
          <div className="hud-label">SCORE</div>
          <div className="hud-value">{score}</div>
        </div>
        <div className="hud-item">
          <div className="hud-label">TIME</div>
          <div className="hud-value">{Math.ceil(timeLeftMs / 1000)}</div>
        </div>
        <div className="hud-item">
          <div className="hud-label">HIGH</div>
          <div className="hud-value">{highScore}</div>
        </div>
      </div>

      <div className="timebar-container" aria-hidden>
        <div
          className={`timebar-fill ${progress <= lowThreshold ? "low" : ""} ${progress <= warnThreshold && progress > lowThreshold ? "warn" : ""}`}
          style={{
            transform: `scaleX(${progress})`,
            ["--progress" as any]: progress,
          }}
        />
      </div>

      <div className="grid" role="grid" aria-label="Game grid">
        {tiles.map((isBlack, i) => (
          <button
            key={i}
            className={`cell ${isBlack ? "cell-black" : "cell-white"}`}
            onClick={() => handleTap(i)}
            aria-pressed={!!isBlack}
          />
        ))}
      </div>

      <div className="controls">
        <div>Tap the black tiles — avoid white!</div>
        <div className="control-row">
          <button className="btn" onClick={resetGame}>Restart</button>
          <div className="small-muted">Black tiles: {START_BLACK} • Grid: {GRID}×{GRID}</div>
        </div>
      </div>
    </div>
  );
}
