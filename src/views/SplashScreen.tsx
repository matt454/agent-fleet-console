import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Github, RotateCw, Wrench } from "lucide-react";
import { Button } from "../components/ui/button.tsx";

const MIN_DISPLAY_MS = 1500;
const LONG_WAIT_MS = 8000;

export function SplashScreen({ appReady, onDone }: { appReady: boolean; onDone: () => void }) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ready = minimumElapsed && appReady;
  const waiting = !ready && longWait;

  useEffect(() => {
    setMounted(true);
    const minimumTimer = setTimeout(() => setMinimumElapsed(true), MIN_DISPLAY_MS);
    const waitTimer = setTimeout(() => setLongWait(true), LONG_WAIT_MS);
    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(waitTimer);
    };
  }, []);

  useEffect(() => {
    if (ready) setLongWait(false);
  }, [ready]);

  return (
    <div className="splash-screen" aria-label="Hermes Fleet Management">
      <div className="splash-field" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={`splash-content ${mounted ? "splash-content--visible" : ""}`}>
        <div className="splash-brand-panel">
          <div className="splash-orb" aria-hidden="true">
            <video autoPlay muted loop playsInline preload="auto">
              <source src="/img/hermes/portal-figure-orb.webm" type="video/webm" />
            </video>
          </div>
          <div className="splash-boot-card">
            <span className="splash-title">Hermes Fleet Management</span>
            <span className="splash-subtitle" aria-live="polite">
              {ready ? "Console ready" : waiting ? "Still checking local services" : "Preparing local console"}
            </span>
            {!ready ? (
              <div className="splash-status" aria-label="Startup status">
                <span><i /> Console API</span>
                <span><i /> Agent inventory</span>
                <span><i /> Local gateway</span>
              </div>
            ) : null}
            {ready ? (
              <div className="splash-actions">
                <Button className="splash-ready-button" onClick={onDone}>
                  <CheckCircle2 data-icon="inline-start" />
                  Get started
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <div className="splash-links" aria-label="Project links">
                  <a href="https://github.com/matt454/agent-fleet-console" target="_blank" rel="noreferrer">
                    <Github aria-hidden="true" />
                    Console
                  </a>
                  <a href="https://github.com/NousResearch/hermes-agent" target="_blank" rel="noreferrer">
                    <Github aria-hidden="true" />
                    Hermes Agent
                  </a>
                </div>
              </div>
            ) : waiting ? (
              <div className="splash-actions splash-actions--recovery">
                <Button className="splash-ready-button" onClick={onDone}>
                  <Wrench data-icon="inline-start" />
                  Open setup checks
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button type="button" variant="outline" className="splash-retry-button" onClick={() => window.location.reload()}>
                  <RotateCw data-icon="inline-start" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="splash-loader" aria-hidden="true">
                <span />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
