// src/components/ResultCard.tsx
import { useEffect, useRef, useState } from "react";
import type { GameStats } from "../types";
import { toPng } from "html-to-image";
import AdUnit from "./AdUnit";

type Props = {
  stats: GameStats;
  onPlayAgain: () => void;
};


export default function ResultCard({ stats, onPlayAgain }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const safeStats = {
  score: stats.score,
  durationMs: stats.durationMs,
  highScore: stats.highScore,
  dueToWrongTap: stats.dueToWrongTap,
};
  useEffect(() => {
    // call serverless endpoint to get witty verdict
    const fetchVerdict = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stats: safeStats }),
        });
        const data = await res.json();
        setMessage(data?.message ?? "You played like a legend!");
      } catch (err) {
        console.error(err);
        setMessage("You played like a legend — play again!");
      } finally {
        setLoading(false);
      }
    };
    fetchVerdict();
  }, [stats]);

  async function downloadImage() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "tapthalaivaa-result.png";
      a.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  }

  const shareText = encodeURIComponent(
    `${message ?? "I played TapThalaivaa!"} Score: ${stats.score} — Try: <your-url>`
  );

  return (
    <div className="result-root">
      <div ref={cardRef} className="result-card">
        <h2>Your Verdict</h2>
        <p className="verdict">{loading ? "Analyzing your style..." : message}</p>

        <div className="result-stats">
          <div>Score: {stats.score}</div>
          <div>High Score: {stats.highScore ?? "—"}</div>
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={onPlayAgain}>Play Again</button>
        <button className="btn" onClick={downloadImage}>Download Image</button>
        <a className="btn" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">Share (WhatsApp)</a>
        <a className="btn" href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" rel="noreferrer">Share (Twitter)</a>
      </div>
       <AdUnit client="ca-pub-8401856826721586" slot="8431886338" test={true} className="ad-banner" />


    </div>
  );
}
