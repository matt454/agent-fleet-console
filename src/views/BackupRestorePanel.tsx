import { Archive, Download, FileSearch, RotateCcw, Save } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { BackupArchive, BackupInspectResult, Instance, Job } from "../models/fleet.ts";
import { api, postJson } from "../controllers/api.ts";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field.tsx";
import { Input } from "../components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { SettingsStep, SettingsStepper, useStepperExpansion } from "../components/ui/stepper.tsx";
import { Table, TableBody, TableCell, TableRow } from "../components/ui/table.tsx";
import { toast } from "sonner";

type BackupList = { backups: BackupArchive[] };
const ARCHIVE_LIST_DEFER_THRESHOLD = 8;
const ARCHIVE_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function backupOnboardingState({
  activeAgentCount,
  backups,
  includeSecrets,
  inspected,
  restorePath,
  scope,
}: {
  activeAgentCount: number;
  backups: BackupArchive[];
  includeSecrets: boolean;
  inspected: BackupInspectResult | null;
  restorePath: string;
  scope: string;
}) {
  const hasArchive = backups.length > 0;
  const hasRestorePath = Boolean(restorePath.trim());
  const inspectedAgents = inspected?.manifest.agents.length || 0;
  const conflicts = inspected?.conflicts.length || 0;

  return {
    agentCount: activeAgentCount,
    conflicts,
    hasArchive,
    hasRestorePath,
    includeSecrets,
    inspectedAgents,
    readyToExport: scope === "fleet" || activeAgentCount > 0,
    restoreReady: hasRestorePath && Boolean(inspected) && conflicts === 0,
    scopeLabel: scope === "agent" ? "One agent" : "Full fleet",
  };
}

function formatArchiveSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Unknown size";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatArchiveDate(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return ARCHIVE_DATE_FORMATTER.format(date);
}

export function BackupRestorePanel({ instances }: { instances: Instance[] }) {
  const [backups, setBackups] = useState<BackupArchive[]>([]);
  const [scope, setScope] = useState("fleet");
  const [agentName, setAgentName] = useState(instances[0]?.name || "");
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [includeWorkspace, setIncludeWorkspace] = useState(true);
  const [restorePath, setRestorePath] = useState("");
  const [namePrefix, setNamePrefix] = useState("restored-");
  const [restoreSecrets, setRestoreSecrets] = useState(false);
  const [startRestored, setStartRestored] = useState(true);
  const [inspected, setInspected] = useState<BackupInspectResult | null>(null);
  const [busyAction, setBusyAction] = useState("");

  const activeAgentCount = useMemo(() => instances.filter((instance) => !instance.pendingCreate).length, [instances]);

  const loadBackups = useCallback(async () => {
    const data = await api<BackupList>("/api/backups");
    setBackups(data.backups || []);
  }, []);

  useEffect(() => { loadBackups().catch(() => undefined); }, [loadBackups]);
  useEffect(() => { if (!agentName && instances[0]?.name) setAgentName(instances[0].name); }, [instances, agentName]);

  async function exportBackup() {
    setBusyAction("export");
    try {
      const body = { scope, names: scope === "agent" ? [agentName] : [], includeSecrets, includeWorkspace };
      const { job } = await postJson<{ job: Job }>("/api/backups/export", body);
      toast.success("Backup queued", { description: `Job #${job.id} will create the archive.` });
      await loadBackups();
    } finally {
      setBusyAction("");
    }
  }

  async function inspectBackup() {
    setBusyAction("inspect");
    try {
      const result = await postJson<BackupInspectResult>("/api/backups/inspect", { archivePath: restorePath });
      setInspected(result);
      toast.success("Archive inspected", { description: `${result.manifest.agents.length} agents found.` });
    } finally {
      setBusyAction("");
    }
  }

  async function restoreBackup() {
    setBusyAction("restore");
    try {
      const { job } = await postJson<{ job: Job }>("/api/backups/restore", {
        archivePath: restorePath,
        namePrefix,
        restoreGlobalConfig: true,
        restoreSecrets,
        startRestored,
      });
      toast.success("Restore queued", { description: `Job #${job.id} will restore the archive.` });
    } finally {
      setBusyAction("");
    }
  }

  const busy = Boolean(busyAction);
  const conflicts = inspected?.conflicts || [];
  const needsPrefix = conflicts.length > 0 && !namePrefix.trim();
  const onboarding = useMemo(() => backupOnboardingState({ activeAgentCount, backups, includeSecrets, inspected, restorePath, scope }), [activeAgentCount, backups, includeSecrets, inspected, restorePath, scope]);
  const canRestore = Boolean(restorePath.trim() && inspected && !needsPrefix);
  const useArchivePath = useCallback((archive: BackupArchive) => {
    setRestorePath(archive.path);
    setInspected(null);
  }, []);

  const step1Complete = onboarding.readyToExport;
  const step2Complete = onboarding.hasArchive;
  const step3Reachable = step1Complete && step2Complete;
  const step3Complete = onboarding.restoreReady;
  const derivedActive = !step1Complete ? 1 : !step2Complete ? 2 : !step3Complete ? 3 : 4;
  const { activeStep, toggleStep } = useStepperExpansion(derivedActive);

  return (
    <Card className="settings-section settings-section-primary backup-restore-panel">
      <CardHeader className="settings-section-header">
        <div><CardTitle>Backup & restore</CardTitle><CardDescription>Export fleet state and restore local archives.</CardDescription></div>
        <Badge variant="secondary">{backups.length} archive{backups.length === 1 ? "" : "s"}</Badge>
      </CardHeader>
      <CardContent className="padded backup-panel-content">
        <SettingsStepper>
          <SettingsStep
            index={1}
            title="Choose scope"
            active={activeStep === 1}
            complete={step1Complete}
            locked={false}
            summary={step1Complete ? `${onboarding.scopeLabel} · ${onboarding.agentCount || "No"} agent${onboarding.agentCount === 1 ? "" : "s"}` : "Pick what to back up"}
            onToggle={() => toggleStep(1)}
          >
            <FieldGroup className="field-grid two">
              <Field>
                <FieldLabel>Export scope</FieldLabel>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fleet">Full fleet</SelectItem>
                    <SelectItem value="agent">One agent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Agent</FieldLabel>
                <Select value={agentName} onValueChange={setAgentName}>
                  <SelectTrigger disabled={scope !== "agent"}><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>{instances.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <div className="backup-option-grid">
              <BackupOption label="Workspace" description="Include agent workspace files." checked={includeWorkspace} onChange={setIncludeWorkspace} />
              <BackupOption label="Secrets" description="Include env files and credentials." checked={includeSecrets} onChange={setIncludeSecrets} warning />
            </div>
            {includeSecrets ? <Alert variant="warning">This archive will contain secrets. Store it somewhere private.</Alert> : null}
            <CardFooter className="backup-panel-footer"><Button disabled={busy || (scope === "agent" && !agentName)} onClick={exportBackup}>{busyAction === "export" ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}Export backup</Button></CardFooter>
          </SettingsStep>
          <SettingsStep
            index={2}
            title="Export archive"
            active={activeStep === 2}
            complete={step2Complete}
            locked={!step1Complete}
            summary={step2Complete ? `${backups.length} archive${backups.length === 1 ? "" : "s"} created` : "No archives yet"}
            onToggle={() => toggleStep(2)}
          >
            <ArchiveList backups={backups} onUse={useArchivePath} />
          </SettingsStep>
          <SettingsStep
            index={3}
            title="Select archive"
            active={activeStep === 3}
            complete={step3Complete}
            locked={!step3Reachable}
            summary={step3Complete ? `${onboarding.inspectedAgents} agents found` : onboarding.hasRestorePath ? "Inspect before restoring" : "Paste a local archive path"}
            onToggle={() => toggleStep(3)}
          >
            <FieldGroup className="backup-restore-form">
              <Field><FieldLabel htmlFor="restore-path">Local archive path</FieldLabel><Input id="restore-path" value={restorePath} onChange={(event) => { setRestorePath(event.target.value); setInspected(null); }} placeholder="/path/to/hermes-fleet.tar.gz" /><FieldDescription>Use a generated archive path or paste a local archive, then inspect it before restore.</FieldDescription></Field>
              <FieldGroup className="field-grid two">
                <Field><FieldLabel htmlFor="restore-prefix">Name prefix</FieldLabel><Input id="restore-prefix" value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} placeholder="restored-" /><FieldDescription>Used when restored names already exist.</FieldDescription></Field>
                <Field><FieldLabel>Restore options</FieldLabel><div className="backup-option-stack"><BackupOption label="Start agents" checked={startRestored} onChange={setStartRestored} /><BackupOption label="Restore secrets" checked={restoreSecrets} onChange={setRestoreSecrets} warning /></div></Field>
              </FieldGroup>
            </FieldGroup>
            {restorePath.trim() && !inspected ? <Alert variant="warning">Inspect this archive before restoring so conflicts and agent counts are visible.</Alert> : null}
            {needsPrefix ? <Alert variant="warning">This archive conflicts with existing agent names. Add a name prefix before restoring.</Alert> : null}
            <div className="backup-panel-footer">
              <Button variant="outline" disabled={busy || !restorePath.trim()} onClick={inspectBackup}>{busyAction === "inspect" ? <Spinner data-icon="inline-start" /> : <FileSearch data-icon="inline-start" />}Inspect</Button>
            </div>
          </SettingsStep>
          <SettingsStep
            index={4}
            title="Inspect & restore"
            active={activeStep === 4}
            complete={step3Complete && !busy}
            locked={!step3Complete}
            summary={step3Complete ? `Ready to restore ${onboarding.inspectedAgents} agent${onboarding.inspectedAgents === 1 ? "" : "s"}` : "Inspect an archive first"}
            onToggle={() => toggleStep(4)}
          >
            {inspected ? <BackupInspection result={inspected} /> : null}
            <div className="backup-panel-footer">
              <Button disabled={busy || !canRestore} onClick={restoreBackup}>{busyAction === "restore" ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}Restore</Button>
            </div>
          </SettingsStep>
        </SettingsStepper>
      </CardContent>
    </Card>
  );
}

const ArchiveList = memo(function ArchiveList({ backups, onUse }: { backups: BackupArchive[]; onUse: (archive: BackupArchive) => void }) {
  const archiveRows = useMemo(() => backups.map((archive) => ({
    archive,
    metadata: `${formatArchiveSize(archive.size)}${archive.createdAt ? ` · ${formatArchiveDate(archive.createdAt)}` : ""}`,
  })), [backups]);

  if (!backups.length) {
    return (
      <div className="backup-empty">
        <Archive />
        <div>
          <strong>No generated backups yet</strong>
          <span>Export an archive once, then it will appear here with restore and download actions.</span>
        </div>
      </div>
    );
  }
  return (
    <Table className={backups.length > ARCHIVE_LIST_DEFER_THRESHOLD ? "backup-table backup-table-deferred" : "backup-table"}><TableBody>{archiveRows.map(({ archive, metadata }) => (
      <TableRow key={archive.file}>
        <TableCell><div className="backup-file-cell"><strong>{archive.file}</strong><span>{metadata}</span></div></TableCell>
        <TableCell className="ui-table-actions"><Button variant="ghost" size="sm" onClick={() => onUse(archive)}>Use path</Button><Button variant="outline" size="sm" asChild><a href={`/api/backups/${encodeURIComponent(archive.file)}/download`}><Download data-icon="inline-start" />Download</a></Button></TableCell>
      </TableRow>
    ))}</TableBody></Table>
  );
});

function BackupInspection({ result }: { result: BackupInspectResult }) {
  const agentNames = result.manifest.agents.map((agent) => agent.name).join(", ");
  return <Alert variant={result.conflicts.length ? "warning" : "default"}><strong>{result.manifest.scope}</strong><span>{result.manifest.agents.length} agents: {agentNames || "none"}{result.conflicts.length ? `; conflicts: ${result.conflicts.join(", ")}` : ""}</span></Alert>;
}

const BackupOption = memo(function BackupOption({ label, description = "", checked, warning, onChange }: { label: string; description?: string; checked: boolean; warning?: boolean; onChange: (value: boolean) => void }) {
  return <label className={warning ? "backup-option warning" : "backup-option"}><Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span></label>;
});
