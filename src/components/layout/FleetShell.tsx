import type { ReactNode } from "react";
import { Button } from "../ui/button.tsx";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.tsx";

export type DashboardPage = "dashboard" | "setup" | "settings";

function DashboardTopbar({
  activePage,
  onDashboard,
  onSetup,
  onSettings,
  onNewAgent,
  setupReady,
}: {
  activePage: DashboardPage;
  onDashboard: () => void;
  onSetup: () => void;
  onSettings: () => void;
  onNewAgent: () => void;
  setupReady?: boolean;
}) {
  return (
    <div className="fleet-topbar">
      <div className="fleet-tabs" aria-label="Dashboard views">
        <button
          className={`fleet-tab${activePage === "dashboard" ? " active" : ""}`}
          type="button"
          onClick={onDashboard}
        >
          Dashboard
        </button>
        {setupReady && activePage !== "setup" ? null : (
          <button
            className={`fleet-tab${activePage === "setup" ? " active" : ""}`}
            type="button"
            onClick={onSetup}
          >
            Setup checks
          </button>
        )}
        <button
          className={`fleet-tab${activePage === "settings" ? " active" : ""}`}
          type="button"
          onClick={onSettings}
        >
          Settings
        </button>
      </div>
      {activePage === "setup" ? null : (
        <div className="fleet-dashboard-actions">
          <Button className="fleet-primary-action" type="button" onClick={onNewAgent}>
            <Plus data-icon="inline-start" />
            New agent
          </Button>
        </div>
      )}
    </div>
  );
}

function DashboardPageHeader({
  title,
  description,
  leading,
  actions,
}: {
  title: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="fleet-block-header">
      <div className="fleet-title-block">
        {leading}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="fleet-dashboard-actions">{actions}</div> : null}
    </header>
  );
}

type DashboardPageStackProps = {
  title: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
  "aria-label"?: string;
};

export function DashboardPageStack({
  title,
  description,
  leading,
  actions,
  children,
  className,
  hideHeader,
  "aria-label": ariaLabel,
}: DashboardPageStackProps) {
  return (
    <section className={`fleet-page-stack ${className || ""}`.trim()} aria-label={ariaLabel}>
      {hideHeader ? null : (
        <DashboardPageHeader
          leading={leading}
          title={title}
          description={description}
          actions={actions}
        />
      )}
      {children}
    </section>
  );
}

export function DashboardPanelHeader({
  title,
  subtitle,
  actions,
  className = "dashboard-panel-header",
}: {
  title: string;
  subtitle?: string | ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={className}>
      <div className="dashboard-panel-header-main">
        <div className="dashboard-panel-title">
          <CardTitle>{title}</CardTitle>
          {subtitle ? <span className="dashboard-panel-subtitle">{subtitle}</span> : null}
        </div>
        {actions ? <div className="dashboard-panel-actions">{actions}</div> : null}
      </div>
    </CardHeader>
  );
}

function DashboardPanelCard({
  children,
  compact = false,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  compact?: boolean;
  "aria-label"?: string;
}) {
  const shellClass = compact ? "fleet-dashboard-shell compact" : "fleet-dashboard-shell";
  const cardClass = compact ? "fleet-dashboard-card compact" : "fleet-dashboard-card";
  return (
    <div className={shellClass}>
      <Card as="section" className={cardClass} aria-label={ariaLabel}>
        <CardContent className="fleet-dashboard-content">{children}</CardContent>
      </Card>
    </div>
  );
}

export function DashboardPageFrame({
  activePage,
  onDashboard,
  onSetup,
  onSettings,
  onNewAgent,
  cardCompact,
  setupReady,
  "aria-label": ariaLabel,
  children,
}: {
  activePage: DashboardPage;
  onDashboard: () => void;
  onSetup: () => void;
  onSettings: () => void;
  onNewAgent: () => void;
  cardCompact?: boolean;
  setupReady?: boolean;
  "aria-label"?: string;
  children: ReactNode;
}) {
  return (
    <DashboardShell
      activePage={activePage}
      onDashboard={onDashboard}
      onSetup={onSetup}
      onSettings={onSettings}
      onNewAgent={onNewAgent}
      setupReady={setupReady}
    >
      <DashboardPanelCard compact={Boolean(cardCompact)} aria-label={ariaLabel}>
        {children}
      </DashboardPanelCard>
    </DashboardShell>
  );
}

function DashboardShell({
  activePage,
  onDashboard,
  onSetup,
  onSettings,
  onNewAgent,
  setupReady,
  children,
}: {
  activePage: DashboardPage;
  onDashboard: () => void;
  onSetup: () => void;
  onSettings: () => void;
  onNewAgent: () => void;
  setupReady?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="fleet-block-page">
      <div className="fleet-dashboard-window">
        <DashboardTopbar
          activePage={activePage}
          onDashboard={onDashboard}
          onSetup={onSetup}
          onSettings={onSettings}
          onNewAgent={onNewAgent}
          setupReady={setupReady}
        />
        {children}
      </div>
    </section>
  );
}
