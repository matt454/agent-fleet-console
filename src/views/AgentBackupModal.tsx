import { Archive, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { AgentBackupOptions, Instance } from "../models/fleet.ts";
import { Alert } from "../components/ui/alert.tsx";
import { Button } from "../components/ui/button.tsx";
import { CardContent, CardFooter, CardForm } from "../components/ui/card.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { DialogContent, DialogDescription, DialogHeader, DialogOverlay, DialogTitle } from "../components/ui/dialog.tsx";
import { Field, FieldGroup } from "../components/ui/field.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { toast } from "sonner";

export function AgentBackupModal({ open, selected, onClose, onBackup }: {
  open: boolean;
  selected: Instance;
  onClose: () => void;
  onBackup: (name: string, options: AgentBackupOptions) => Promise<void>;
}) {
  const [includeWorkspace, setIncludeWorkspace] = useState(true);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onBackup(selected.name, { includeWorkspace, includeSecrets });
      toast.success("Agent backup queued", { description: selected.name });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogOverlay onClick={onClose}>
      <DialogContent className="create-agent-modal" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <div><DialogTitle>Back up {selected.name}</DialogTitle><DialogDescription>Create a local archive for this agent.</DialogDescription></div>
          <Button variant="outline" size="icon" aria-label="Close backup" onClick={onClose}><X data-icon="inline-start" /></Button>
        </DialogHeader>
        <CardForm onSubmit={submit}>
          <CardContent className="padded">
            <FieldGroup>
              <Field><label className="backup-option"><Checkbox checked={includeWorkspace} onChange={(event) => setIncludeWorkspace(event.target.checked)} /><span><strong>Workspace</strong><small>Include project files, excluding generated folders.</small></span></label></Field>
              <Field><label className="backup-option warning"><Checkbox checked={includeSecrets} onChange={(event) => setIncludeSecrets(event.target.checked)} /><span><strong>Secrets</strong><small>Include env files and credentials.</small></span></label></Field>
            </FieldGroup>
            {includeSecrets ? <Alert variant="warning">This archive will contain secrets. Store it somewhere private.</Alert> : null}
          </CardContent>
          <CardFooter className="create-agent-footer">
            <Button variant="outline" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={busy}>{busy ? <Spinner data-icon="inline-start" /> : <Archive data-icon="inline-start" />}Back up agent</Button>
          </CardFooter>
        </CardForm>
      </DialogContent>
    </DialogOverlay>
  );
}
