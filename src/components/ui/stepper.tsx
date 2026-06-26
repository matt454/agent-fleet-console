import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { classNames } from "../../controllers/format.ts";

export function SettingsStepper({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={classNames("settings-stepper", className)}>{children}</ol>;
}

export function SettingsStep({ index, title, active, complete, locked, summary, onToggle, children }: {
  index: number;
  title: string;
  active: boolean;
  complete: boolean;
  locked: boolean;
  summary: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  const clickable = !locked;
  return (
    <li className={classNames("settings-step", active && "active", complete && "complete", locked && "locked")}>
      <button type="button" className="settings-step-header" onClick={onToggle} disabled={!clickable} aria-expanded={active}>
        <span className="settings-step-marker" aria-hidden="true">{complete && !active ? <Check className="size-3" /> : index}</span>
        <span className="settings-step-copy">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
      </button>
      {active ? <div className="settings-step-body">{children}</div> : null}
    </li>
  );
}

export function useStepperExpansion(derivedActive: number) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  useEffect(() => { setExpandedStep(null); }, [derivedActive]);
  const activeStep = expandedStep ?? derivedActive;
  function toggleStep(step: number) {
    setExpandedStep((current) => (current === step ? null : step));
  }
  return { activeStep, toggleStep };
}
