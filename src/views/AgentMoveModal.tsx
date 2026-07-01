import { MoveRight, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AgentMoveOptions, FleetNode, Instance } from "../models/fleet.ts";
import { Alert } from "../components/ui/alert.tsx";
import { Button } from "../components/ui/button.tsx";
import { CardContent, CardFooter, CardForm } from "../components/ui/card.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { DialogContent, DialogDescription, DialogHeader, DialogOverlay, DialogTitle } from "../components/ui/dialog.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { toast } from "sonner";

export function AgentMoveModal({ open, selected, fleetNodes, instances, onClose, onMove }: {
  open: boolean;
  selected: Instance;
  fleetNodes: FleetNode[];
  instances: Instance[];
  onClose: () => void;
  onMove: (name: string, options: AgentMoveOptions) => Promise<void>;
}) {
  const sourceNodeId = selected.nodeId || "local";
  const targetNodes = useMemo(() => fleetNodes.filter((node) => node.enabled && node.id !== sourceNodeId && node.status !== "offline"), [fleetNodes, sourceNodeId]);
  const [targetNodeId, setTargetNodeId] = useState(() => targetNodes[0]?.id || "");
  const [includeWorkspace, setIncludeWorkspace] = useState(true);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [startTarget, setStartTarget] = useState(true);
  const [removeSource, setRemoveSource] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!targetNodeId || !targetNodes.some((node) => node.id === targetNodeId)) setTargetNodeId(targetNodes[0]?.id || "");
  }, [open, targetNodeId, targetNodes]);

  if (!open) return null;
  const targetNode = targetNodes.find((node) => node.id === targetNodeId) || null;
  const targetConflict = Boolean(targetNodeId && instances.some((instance) => instance.name === selected.name && (instance.nodeId || "local") === targetNodeId));
  const nemoUnsupported = selected.runtime === "nemoclaw";
  const canSubmit = Boolean(targetNodeId && !targetConflict && !nemoUnsupported);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onMove(selected.name, { targetNodeId, includeWorkspace, includeSecrets, startTarget, removeSource });
      toast.success("Move queued", { description: `${selected.name} -> ${targetNode?.label || targetNodeId}` });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogOverlay onClick={onClose}>
      <DialogContent className="create-agent-modal" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <div><DialogTitle>Move {selected.name}</DialogTitle><DialogDescription>Copy this agent to another Fleet node.</DialogDescription></div>
          <Button variant="outline" size="icon" aria-label="Close move" onClick={onClose}><X data-icon="inline-start" /></Button>
        </DialogHeader>
        <CardForm onSubmit={submit}>
          <CardContent className="padded">
            <FieldGroup>
              <Field>
                <FieldLabel>Target node</FieldLabel>
                <Select value={targetNodeId} onValueChange={setTargetNodeId}>
                  <SelectTrigger disabled={!targetNodes.length} className="w-full"><SelectValue placeholder="Select target" /></SelectTrigger>
                  <SelectContent>
                    {targetNodes.map((node) => <SelectItem key={node.id} value={node.id}>{node.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldDescription>{targetNode ? `${selected.nodeLabel || "Local Docker"} -> ${targetNode.label}` : "Add another Fleet node before moving agents."}</FieldDescription>
              </Field>
              <label className="backup-option"><Checkbox checked={includeWorkspace} onChange={(event) => setIncludeWorkspace(event.target.checked)} /><span><strong>Workspace</strong><small>Move project files, excluding generated folders.</small></span></label>
              <label className="backup-option warning"><Checkbox checked={includeSecrets} onChange={(event) => setIncludeSecrets(event.target.checked)} /><span><strong>Secrets</strong><small>Include env files and credentials in the transfer archive.</small></span></label>
              <label className="backup-option"><Checkbox checked={startTarget} onChange={(event) => setStartTarget(event.target.checked)} /><span><strong>Start target</strong><small>Bring services online after restore.</small></span></label>
              <label className="backup-option warning"><Checkbox checked={removeSource} onChange={(event) => setRemoveSource(event.target.checked)} /><span><strong>Remove source</strong><small>Delete the original only after the target restore verifies.</small></span></label>
            </FieldGroup>
            {targetConflict ? <Alert variant="warning">The target node already has an agent named {selected.name}.</Alert> : null}
            {includeSecrets ? <Alert variant="warning">The transfer archive will contain secrets and may remain in node backup folders.</Alert> : null}
            {nemoUnsupported ? <Alert variant="warning">Moving NemoHermes agents is not supported by the current restore workflow.</Alert> : null}
          </CardContent>
          <CardFooter className="create-agent-footer">
            <Button variant="outline" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={!canSubmit || busy}>{busy ? <Spinner data-icon="inline-start" /> : <MoveRight data-icon="inline-start" />}Move agent</Button>
          </CardFooter>
        </CardForm>
      </DialogContent>
    </DialogOverlay>
  );
}
