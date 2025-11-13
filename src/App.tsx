// src/App.tsx
import { useState } from "react";
import BlackTapGame from "./components/BlackTapGame.tsx";
import ResultCard from "./components/ResultCard";
import "./styles.css";
import type { GameStats } from "./types.d.ts";
import Baashalogo from "./assets/baashaLogo.svg";

export default function App() {
  const [stats, setStats] = useState<GameStats | null>(null);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={Baashalogo} alt="logo" className="logo" />
          <h1>TapThalaivaa</h1>
        </div>
      </header>

      <main className="main">
        {!stats ? (
          <BlackTapGame onGameOver={(s) => setStats(s)} />
        ) : (
          <ResultCard stats={stats} onPlayAgain={() => setStats(null)} />
        )}
      </main>

      <footer className="footer">© {new Date().getFullYear()} TapThalaivaa — Play, share, repeat.</footer>
    </div>
  );
}
