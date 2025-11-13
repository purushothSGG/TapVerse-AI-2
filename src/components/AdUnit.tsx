// src/components/AdUnit.tsx
import React, { useEffect, useRef } from "react";

/* declare global so TS knows about adsbygoogle */
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

type Props = {
  slot?: string;
  client?: string;
  test?: boolean; // true while developing, false in production
  style?: React.CSSProperties;
  className?: string;
};

export default function AdUnit({ slot, client, test = true, style, className }: Props) {
  // <-- use HTMLModElement for <ins> and <del>
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const el = insRef.current;
    if (!el) return;
    if (pushedRef.current) return; // already pushed

    const tryPush = () => {
      try {
        const width = el.getBoundingClientRect().width;
        if (!width) return false; // avoid "availableWidth=0" error

        if ((el as any).__ads_pushed) return true;

        if (client) el.setAttribute("data-ad-client", client);
        if (test) el.setAttribute("data-adtest", "on");

        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});

        (el as any).__ads_pushed = true;
        pushedRef.current = true;
        return true;
      } catch (err) {
        console.warn("adsbygoogle push failed", err);
        return false;
      }
    };

    if (tryPush()) return;

    // Observe until width > 0, then push
    let ro: ResizeObserver | null = null;
    let fallbackTimer: number | null = null;

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (tryPush() && ro) {
          ro.disconnect();
          ro = null;
        }
      });
      ro.observe(el);
    } else {
      // fallback polling
      let attempts = 0;
      fallbackTimer = window.setInterval(() => {
        attempts++;
        if (tryPush() || attempts > 20) {
          if (fallbackTimer) {
            clearInterval(fallbackTimer);
            fallbackTimer = null;
          }
        }
      }, 250);
    }

    return () => {
      if (ro) ro.disconnect();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [client, test, slot]);

  return (
    <div className={className} style={style}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        // data attributes (client can be set either here or via script query param)
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(test ? { "data-adtest": "on" } : {})}
      />
    </div>
  );
}
