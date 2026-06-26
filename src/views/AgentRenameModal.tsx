import { FormEvent, useEffect, useState } from "react";
import { Edit3, X } from "lucide-react";
import type { Instance } from "../models/fleet.ts";
import { Button } from "../components/ui/button.tsx";
import { CardContent, CardFooter, CardForm } from "../components/ui/card.tsx";
import { DialogContent, DialogDescription, DialogHeader, DialogOverlay, DialogTitle } from "../components/ui/dialog.tsx";
import { Field, FieldDescription, FieldLabel } from "../components/ui/field.tsx";
import { Input } from "../components/ui/input.tsx";
import { Alert } from "../components/ui/alert.tsx";
import { Spinner } from "../components/ui/spinner.tsx";

export function AgentRenameModal({ open, selected, onClose, onRename }: {
  open: boolean;
  selected: Instance | null;
  onClose: () => void;
  onRename: (name: string, displayName: string, nodeId?: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDisplayName(selected?.displayName || "");
      setError("");
    }
  }, [open, selected?.fleetKey]);

  if (!open || !selected) return null;
  const normalized = displayName.trim().replace(/\s+/g, " ");
  const valid = normalized.length <= 80 && !/[\r\n\0]/.test(displayName);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !valid) return;
    setBusy(true);
    setError("");
    try {
      await onRename(selected.name, normalized, selected.nodeId || "local");
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not update display name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogOverlay onClick={onClose}>
      <DialogContent className="create-agent-modal" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <div><DialogTitle>Display name</DialogTitle><DialogDescription>Change the friendly name shown in Fleet. The agent id stays the same.</DialogDescription></div>
          <Button variant="outline" size="icon" aria-label="Close display name editor" onClick={onClose}><X data-icon="inline-start" /></Button>
        </DialogHeader>
        <CardForm onSubmit={submit}>
          <CardContent className="padded">
            <Field data-invalid={!valid || undefined}>
              <FieldLabel htmlFor="agent-display-name">Name shown in Fleet</FieldLabel>
              <Input id="agent-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={selected.name} autoFocus />
              <FieldDescription>Leave blank to show the agent id: {selected.name}</FieldDescription>
            </Field>
            {!valid ? <Alert variant="warning">Use a single line under 80 characters.</Alert> : null}
            {error ? <Alert variant="warning">{error}</Alert> : null}
          </CardContent>
          <CardFooter className="create-agent-footer">
            <Button variant="outline" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={!valid || busy}>{busy ? <Spinner data-icon="inline-start" /> : <Edit3 data-icon="inline-start" />}Save name</Button>
          </CardFooter>
        </CardForm>
      </DialogContent>
    </DialogOverlay>
  );
}
