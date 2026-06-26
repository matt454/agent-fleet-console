import { useMemo } from "react";
import { ChevronDown, KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardFooter, CardForm, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field.tsx";
import { Input } from "../components/ui/input.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { SettingsStep, SettingsStepper, useStepperExpansion } from "../components/ui/stepper.tsx";
import { Table, TableBody, TableCell, TableRow } from "../components/ui/table.tsx";
import { CREDENTIAL_KEY_HELP, credentialKeyError } from "../controllers/credentials.ts";
import { classNames } from "../controllers/format.ts";
import type { Instance, ProviderCatalogItem } from "../models/fleet.ts";
import {
  credentialSetupState,
  fleetSyncScope,
  formatCredentialAuthSummary,
  syncTargetKey,
  type SettingsProvidersTabProps,
  type SyncTargetPickerProps,
} from "./settings-provider-utils.ts";

export function SyncTargetPicker(props: SyncTargetPickerProps) {
  const allSelected = props.selectableAgents.length > 0 && props.selectableAgents.every((instance) => props.selectedSyncKeySet.has(syncTargetKey(instance)));
  const grouped = useMemo(() => {
    const groups: Record<string, Array<{ instance: Instance; key: string }>> = {};
    for (const instance of props.selectableAgents) {
      const label = instance.nodeLabel || (instance.nodeId === "local" ? "Local Docker" : instance.nodeId || "Local Docker");
      if (!groups[label]) groups[label] = [];
      groups[label].push({ instance, key: syncTargetKey(instance) });
    }
    return groups;
  }, [props.selectableAgents]);

  function setAll(checked: boolean) {
    props.setSelectedSyncKeys(checked ? props.selectableAgents.map(syncTargetKey) : []);
  }

  function setOne(instance: Instance, checked: boolean) {
    const key = syncTargetKey(instance);
    props.setSelectedSyncKeys((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key));
  }

  return (
    <div className="settings-sync-targets">
      <div className="settings-subsection-heading">
        <strong>Sync to agents</strong>
        <span>{props.selectedTargets.length ? `${props.selectedTargets.length} selected` : "Optional, sync all works too"}</span>
      </div>
      {props.selectableAgents.length ? (
        <>
          <label className="settings-sync-target-all">
            <Checkbox checked={allSelected} disabled={props.disabled} onChange={(event) => setAll(event.target.checked)} />
            <span>Select all agents</span>
          </label>
          <div className="settings-sync-target-list">
            {Object.entries(grouped).map(([label, agents]) => (
              <div className="settings-sync-target-group" key={label}>
                <strong>{label}</strong>
                {agents.map(({ instance, key }) => (
                  <label className="settings-sync-target-row" key={key}>
                    <Checkbox checked={props.selectedSyncKeySet.has(key)} disabled={props.disabled} onChange={(event) => setOne(instance, event.target.checked)} />
                    <span>{instance.displayName || instance.name}</span>
                    <small>{instance.name}</small>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty className="settings-empty">
          <EmptyHeader>
            <EmptyTitle>No agents to sync yet</EmptyTitle>
            <EmptyDescription>{props.emptyDescription || "Create an agent, then return here to push saved credentials."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

export function CredentialsPanel(props: SettingsProvidersTabProps & SyncTargetPickerProps & { selected?: ProviderCatalogItem }) {
  const standalone = props.section === "credentials";
  if (standalone) return <CredentialsStepper {...props} />;
  return <CredentialsCollapsible {...props} />;
}

function CredentialsStepper(props: SettingsProvidersTabProps & SyncTargetPickerProps & { selected?: ProviderCatalogItem }) {
  const keyError = credentialKeyError(props.credential.key);
  const valueError = /[\n\r\0]/.test(props.credential.value) ? "Credential values must be a single line." : "";
  const hasCredentialError = Boolean(keyError || valueError);
  const authState = credentialSetupState(props, props.selected);
  const canUseSuggestedKey = Boolean(authState.suggestedKey && props.credential.key.trim() !== authState.suggestedKey);
  const hasAuth = Boolean(props.globalConfig.credentials.length || props.globalConfig.oauthCredentials.length);
  const hasAgents = props.selectableAgents.length > 0;
  const canSyncAgents = hasAgents && hasAuth;

  function useSuggestedKey() {
    if (!authState.suggestedKey) return;
    props.setCredential((current) => ({ ...current, key: authState.suggestedKey }));
  }

  const step1Complete = hasAuth;
  const step2Reachable = step1Complete;
  const step2Complete = step2Reachable && hasAgents;
  const derivedActive = !step1Complete ? 1 : !step2Complete ? 2 : 3;
  const { activeStep, toggleStep } = useStepperExpansion(derivedActive);

  return (
    <Card className="settings-section settings-section-primary">
      <CardHeader className="settings-section-header">
        <div><CardTitle>Credentials</CardTitle><CardDescription>Shared API keys inherited by agents.</CardDescription></div>
        <Badge variant="secondary">{props.globalConfig.credentials.length}</Badge>
      </CardHeader>
      <CardContent className="padded settings-section-content">
        <SettingsStepper>
          <SettingsStep
            index={1}
            title="Save key"
            active={activeStep === 1}
            complete={step1Complete}
            locked={false}
            summary={step1Complete ? formatCredentialAuthSummary(authState) : authState.suggestedKey ? `Save ${authState.suggestedKey}` : "Save a provider key"}
            onToggle={() => toggleStep(1)}
          >
            {canUseSuggestedKey ? (
              <div className="credential-suggested-key">
                <Button variant="ghost" size="sm" type="button" onClick={useSuggestedKey}>
                  <KeyRound data-icon="inline-start" />
                  Use {authState.suggestedKey}
                </Button>
              </div>
            ) : null}
            <CardForm className="settings-credential-form settings-step-form settings-credential-step-form" onSubmit={props.saveCredential}>
              <FieldGroup className="settings-credential-fields">
                <Field data-invalid={keyError || undefined}>
                  <FieldLabel htmlFor="credential-key">Key</FieldLabel>
                  <Input id="credential-key" value={props.credential.key} onChange={(event) => props.setCredential({ ...props.credential, key: event.target.value })} placeholder={props.selected?.credentialKeys?.[0] || "OPENAI_API_KEY"} aria-invalid={Boolean(keyError)} autoCapitalize="off" autoComplete="off" spellCheck={false} />
                  <FieldDescription>{keyError || CREDENTIAL_KEY_HELP}</FieldDescription>
                </Field>
                <Field data-invalid={valueError || undefined}>
                  <FieldLabel htmlFor="credential-value">Value</FieldLabel>
                  <Input id="credential-value" value={props.credential.value} onChange={(event) => props.setCredential({ ...props.credential, value: event.target.value })} placeholder="Paste secret value" type="password" aria-invalid={Boolean(valueError)} autoComplete="off" spellCheck={false} />
                  <FieldDescription>{valueError || "Paste the secret exactly as provided."}</FieldDescription>
                </Field>
              </FieldGroup>
              <Button className="settings-credential-save" type="submit" disabled={props.busy || hasCredentialError || !props.credential.key.trim() || !props.credential.value.trim()}>
                {props.busyAction === "credential" ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                {props.busyAction === "credential" ? "Saving" : "Save credential"}
              </Button>
            </CardForm>
            <SavedCredentials {...props} />
          </SettingsStep>
          <SettingsStep
            index={2}
            title="Choose targets"
            active={activeStep === 2}
            complete={step2Complete}
            locked={!step2Reachable}
            summary={step2Complete ? `${props.selectableAgents.length} agents available` : hasAgents ? "Select agents or sync all" : "Create an agent first"}
            onToggle={() => toggleStep(2)}
          >
            <SyncTargetPicker {...props} disabled={props.busy} />
          </SettingsStep>
          <SettingsStep
            index={3}
            title="Sync agents"
            active={activeStep === 3}
            complete={step2Complete && !props.globalConfig.requiresSync}
            locked={!step2Complete}
            summary={step2Complete ? (props.globalConfig.requiresSync ? "Sync required" : "Synced") : "Complete steps above first"}
            onToggle={() => toggleStep(3)}
          >
            {props.globalConfig.requiresSync ? (
              <p className="settings-step-note">Saved credential changes need syncing to existing agents.</p>
            ) : null}
            <div className="settings-sync-actions">
              <Button variant="outline" type="button" onClick={() => props.sync(props.selectedTargets)} disabled={props.busy || !canSyncAgents || !props.selectedTargets.length}>
                {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                {props.busyAction === "sync" ? "Syncing" : `Sync selected (${props.selectedTargets.length})`}
              </Button>
              <Button type="button" onClick={() => props.sync()} disabled={props.busy || !canSyncAgents}>
                {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                Sync all agents
              </Button>
            </div>
          </SettingsStep>
        </SettingsStepper>
      </CardContent>
    </Card>
  );
}

function CredentialsCollapsible(props: SettingsProvidersTabProps & SyncTargetPickerProps & { selected?: ProviderCatalogItem }) {
  const keyError = credentialKeyError(props.credential.key);
  const valueError = /[\n\r\0]/.test(props.credential.value) ? "Credential values must be a single line." : "";
  const hasCredentialError = Boolean(keyError || valueError);
  const authState = credentialSetupState(props, props.selected);
  const canSyncAgents = props.selectableAgents.length > 0;
  const hasSyncableAuth = Boolean(props.globalConfig.credentials.length || props.globalConfig.oauthCredentials.length);
  const syncScopeLabel = !hasSyncableAuth ? "Save a credential before syncing." : canSyncAgents ? fleetSyncScope(props) : "Create an agent before syncing.";

  function useSuggestedKey() {
    if (!authState.suggestedKey) return;
    props.setCredential((current) => ({ ...current, key: authState.suggestedKey }));
  }

  const content = (
    <>
      <CredentialsOnboardingStrip authState={authState} canUseSuggestedKey={Boolean(authState.suggestedKey && props.credential.key.trim() !== authState.suggestedKey)} onUseSuggestedKey={useSuggestedKey} selected={props.selected} />
      <CardForm className="settings-credential-form settings-step-form settings-credential-step-form" onSubmit={props.saveCredential}>
        <CardContent className="padded settings-credential-entry">
          <FieldGroup className="settings-credential-fields">
            <Field data-invalid={keyError || undefined}>
              <FieldLabel htmlFor="credential-key">Key</FieldLabel>
              <Input id="credential-key" value={props.credential.key} onChange={(event) => props.setCredential({ ...props.credential, key: event.target.value })} placeholder={props.selected?.credentialKeys?.[0] || "OPENAI_API_KEY"} aria-invalid={Boolean(keyError)} autoCapitalize="off" autoComplete="off" spellCheck={false} />
              <FieldDescription>{keyError || CREDENTIAL_KEY_HELP}</FieldDescription>
            </Field>
            <Field data-invalid={valueError || undefined}>
              <FieldLabel htmlFor="credential-value">Value</FieldLabel>
              <Input id="credential-value" value={props.credential.value} onChange={(event) => props.setCredential({ ...props.credential, value: event.target.value })} placeholder="Paste secret value" type="password" aria-invalid={Boolean(valueError)} autoComplete="off" spellCheck={false} />
              <FieldDescription>{valueError || "Paste the secret exactly as provided."}</FieldDescription>
            </Field>
          </FieldGroup>
          <Button className="settings-credential-save" type="submit" disabled={props.busy || hasCredentialError || !props.credential.key.trim() || !props.credential.value.trim()}>
            {props.busyAction === "credential" ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {props.busyAction === "credential" ? "Saving" : "Save credential"}
          </Button>
        </CardContent>
      </CardForm>
      <SavedCredentials {...props} />
      <CardContent className="padded">
        <SyncTargetPicker {...props} disabled={props.busy} />
      </CardContent>
      <CardFooter className="settings-provider-footer">
        <div className="settings-secondary-actions">
          <span className="settings-sync-scope">{syncScopeLabel}</span>
        </div>
        <div className="settings-footer-actions">
          <Button variant="outline" type="button" onClick={() => props.sync(props.selectedTargets)} disabled={props.busy || !canSyncAgents || !props.selectedTargets.length || !hasSyncableAuth}>
            {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {props.busyAction === "sync" ? "Syncing" : `Sync selected (${props.selectedTargets.length})`}
          </Button>
          <Button type="button" onClick={() => props.sync()} disabled={props.busy || !canSyncAgents || !hasSyncableAuth}>
            {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            Sync all agents
          </Button>
        </div>
      </CardFooter>
    </>
  );

  return (
    <Collapsible>
      <Card className="settings-section">
        <CardHeader className="settings-section-header settings-collapsible-header">
          <div><CardTitle>Credentials</CardTitle><CardDescription>Shared API keys inherited by agents.</CardDescription></div>
          <CollapsibleTrigger asChild>
            <Button className="settings-credentials-trigger" variant="outline" size="sm" type="button">
              <KeyRound data-icon="inline-start" />
              <span>Manage</span>
              <Badge variant="secondary">{props.globalConfig.credentials.length}</Badge>
              <ChevronDown data-icon="inline-end" />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          {content}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CredentialsOnboardingStrip({
  authState,
  canUseSuggestedKey,
  onUseSuggestedKey,
  selected,
}: {
  authState: ReturnType<typeof credentialSetupState>;
  canUseSuggestedKey: boolean;
  onUseSuggestedKey: () => void;
  selected?: ProviderCatalogItem;
}) {
  const providerLabel = selected?.label || "Selected provider";
  const title = authState.hasAuth
    ? "Credentials are ready to sync"
    : authState.providerNeedsKey
      ? `Save ${authState.suggestedKey || "a provider key"} once`
      : "No API key required for this provider";
  const detail = authState.hasAuth
    ? formatCredentialAuthSummary(authState)
    : authState.providerNeedsKey
      ? `${providerLabel} agents inherit this key after sync.`
      : "Use this tab only for API keys that agents inherit. Device login stays in Provider.";

  return (
    <div className="credentials-onboarding">
      <div className="credentials-onboarding-main">
        <div className="credentials-onboarding-copy">
          <strong>{title}</strong>
          <span>{detail}</span>
        </div>
        {canUseSuggestedKey ? (
          <Button variant="outline" size="sm" type="button" onClick={onUseSuggestedKey}>
            <KeyRound data-icon="inline-start" />
            Use {authState.suggestedKey}
          </Button>
        ) : null}
      </div>
      <ol className="credentials-onboarding-steps" aria-label="Credential setup path">
        <li className="credentials-onboarding-step">
          <span>1</span>
          <strong>Save key</strong>
          <small>{authState.suggestedKey || "Only if the provider needs one"}</small>
        </li>
        <li className="credentials-onboarding-step">
          <span>2</span>
          <strong>Choose targets</strong>
          <small>Select agents or leave it for all agents.</small>
        </li>
        <li className="credentials-onboarding-step">
          <span>3</span>
          <strong>Sync agents</strong>
          <small>Saved auth is pushed into agent env.</small>
        </li>
      </ol>
    </div>
  );
}

function SavedCredentials(props: SettingsProvidersTabProps) {
  const count = props.globalConfig.credentials.length;
  const deferCredentialList = count > 8;
  return (
    <div className="settings-credential-list-content">
      <div className="settings-subsection-heading">
        <strong>Saved credentials</strong>
        <span>{count ? "Values are redacted and ready to sync." : "Save one key above."}</span>
      </div>
      <div className={classNames("credential-list", deferCredentialList && "credential-list-deferred")}>
        {count ? (
          <Table className="settings-credential-table">
            <TableBody>
              {props.globalConfig.credentials.map((item) => (
                <TableRow key={item.key} className="credential-row">
                  <TableCell>
                    <div className="credential-cell-copy">
                      <strong>{item.key}</strong>
                      <span>{item.redacted}</span>
                    </div>
                  </TableCell>
                  <TableCell className="ui-table-actions">
                    <Button variant="ghost" size="icon" type="button" onClick={() => props.removeCredential(item.key)} disabled={props.busy} aria-label={`Remove ${item.key}`}>
                      {props.busyAction === `remove:${item.key}` ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty className="settings-empty">
            <EmptyHeader>
              <EmptyTitle>No shared API keys yet</EmptyTitle>
              <EmptyDescription>Save the provider key once, then sync it to the agents that should inherit it.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
