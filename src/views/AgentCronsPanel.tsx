import { CalendarClock, FileClock, Lock, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../controllers/api.ts";
import type { CronEntry, Instance } from "../models/fleet.ts";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty.tsx";
import { Spinner } from "../components/ui/spinner.tsx";

type CronResponse = {
  root: string;
  entries: CronEntry[];
  truncated?: boolean;
  unavailable?: boolean;
  message?: string;
};

function formatBytes(value: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedAt(value: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function AgentCronsPanel({ selected }: { selected: Instance }) {
  const [data, setData] = useState<CronResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nodeId = selected.nodeId || "local";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<CronResponse>(`/api/fleet/${encodeURIComponent(nodeId)}/instances/${encodeURIComponent(selected.name)}/crons`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load CRON files.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nodeId, selected.name]);

  const entries = data?.entries || [];

  return (
    <div className="tab-content crons-panel">
      <Card className="crons-summary-card">
        <CardHeader>
          <CalendarClock />
          <div>
            <CardTitle>CRONs</CardTitle>
            <CardDescription>{loading ? "Loading scheduled jobs" : `${entries.length} file${entries.length === 1 ? "" : "s"} in agent profile`}</CardDescription>
          </div>
          <Badge variant="secondary"><Lock />Read-only</Badge>
        </CardHeader>
        {data?.truncated ? (
          <CardContent>
            <Alert variant="warning"><TriangleAlert /><span>Showing the first 200 CRON files.</span></Alert>
          </CardContent>
        ) : null}
      </Card>

      {loading ? (
        <div className="crons-loading"><Spinner /><span>Loading CRON files...</span></div>
      ) : error ? (
        <Alert variant="warning"><TriangleAlert /><span>{error}</span></Alert>
      ) : data?.unavailable ? (
        <Empty className="crons-empty" size="large">
          <EmptyMedia variant="icon"><TriangleAlert /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>CRONs unavailable</EmptyTitle>
            <EmptyDescription>{data.message || "This remote fleet node does not expose CRON files yet."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : entries.length ? (
        <div className="cron-file-list">
          {entries.map((entry) => (
            <Card className="cron-file-card" key={entry.path}>
              <CardHeader>
                <FileClock />
                <div>
                  <CardTitle>{entry.path}</CardTitle>
                  <CardDescription>{formatBytes(entry.size)} · Modified {formatModifiedAt(entry.modifiedAt)}</CardDescription>
                </div>
                {entry.truncated ? <Badge variant="warning">Truncated</Badge> : null}
              </CardHeader>
              <CardContent>
                <pre aria-label={`${entry.path} contents`}><code>{entry.content || "(empty file)"}</code></pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="crons-empty" size="large">
          <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No CRON files found</EmptyTitle>
            <EmptyDescription>This agent does not have files in its profile CRON directory.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
