import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { Check, CircleAlert, ExternalLink, LogIn, Network, Plus, RefreshCw, Save, ShieldCheck, X } from "lucide-react";
import { Button } from "../components/ui/button.tsx";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field.tsx";
import { Input } from "../components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx";
import { CardContent, CardDescription, CardForm, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { SettingsStep, SettingsStepper, useStepperExpansion } from "../components/ui/stepper.tsx";
import type { AgentSyncTarget, Instance, OAuthCredentialSummary, ProviderCatalogItem, ProviderConfig } from "../models/fleet.ts";
import { classNames } from "../controllers/format.ts";
import { credentialKeyError, CREDENTIAL_KEY_HELP } from "../controllers/credentials.ts";
import { CredentialsPanel, SyncTargetPicker } from "./SettingsCredentialsPanel.tsx";
import {
  activeProviderStep,
  cleanEndpoint,
  CUSTOM_ENDPOINT_LIMIT,
  formatDate,
  formatOauthError,
  providerDescription,
  providerEndpointList,
  providerOnboardingState,
  providerSignature,
  providerUsesDeviceLogin,
  syncTargetKey,
  uniqueEndpoints,
  type SettingsProvidersTabProps,
} from "./settings-provider-utils.ts";

export function SettingsProvidersTab(props: SettingsProvidersTabProps) {
  const selected = props.providerCatalog.providers.find((item) => item.id === props.provider.provider);
  const savedProvider = props.globalConfig.provider || props.provider;
  const savedSelected = props.providerCatalog.providers.find((item) => item.id === savedProvider.provider);
  const providerDirty = providerSignature(savedProvider) !== providerSignature(props.provider);
  const [selectedSyncKeys, setSelectedSyncKeys] = useState<string[]>([]);
  const selectableAgents = useMemo(() => props.instances.filter((instance) => !instance.pendingCreate), [props.instances]);
  const providerOnboarding = useMemo(() => providerOnboardingState({
    activeAgents: selectableAgents.length,
    globalConfig: props.globalConfig,
    provider: props.provider,
  }, selected, providerDirty), [props.globalConfig, props.provider, providerDirty, selectableAgents.length, selected]);
  const selectedSyncKeySet = useMemo(() => new Set(selectedSyncKeys), [selectedSyncKeys]);
  const selectedTargets = useMemo(() => selectableAgents
    .filter((instance) => selectedSyncKeySet.has(syncTargetKey(instance)))
    .map((instance) => ({ nodeId: instance.nodeId || "local", name: instance.name })), [selectableAgents, selectedSyncKeySet]);
  const syncProps = useMemo(() => ({ selectableAgents, selectedSyncKeys, selectedSyncKeySet, selectedTargets, setSelectedSyncKeys }), [selectableAgents, selectedSyncKeys, selectedSyncKeySet, selectedTargets]);
  if (props.section === "credentials") return <CredentialsPanel {...props} {...syncProps} selected={selected} />;
  return (
    <div className="settings-layout">
      <CardForm className="settings-section settings-section-primary" onSubmit={props.saveProvider}>
        <CardHeader className="settings-section-header">
          <div><CardTitle>Model & auth</CardTitle><CardDescription>Provider, model, endpoint, and auth agents inherit.</CardDescription></div>
          <div className="settings-header-actions">
            {providerDirty ? (
              <Badge variant="warning">Unsaved draft</Badge>
            ) : props.globalConfig.requiresSync ? (
              <Badge variant="warning">Sync required</Badge>
            ) : (
              <Badge variant="success">Saved</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="padded settings-section-content provider-settings-content">
          <ProviderStepper
            {...props}
            savedProvider={savedProvider}
            savedSelected={savedSelected}
            selected={selected}
            providerDirty={providerDirty}
            providerOnboarding={providerOnboarding}
            selectableAgents={selectableAgents}
            selectedSyncKeySet={selectedSyncKeySet}
            selectedSyncKeys={selectedSyncKeys}
            selectedTargets={selectedTargets}
            setSelectedSyncKeys={setSelectedSyncKeys}
          />
        </CardContent>
        <datalist id="global-provider-models">{(selected?.models || []).map((model) => <option key={model} value={model} />)}</datalist>
        <datalist id="global-provider-endpoints">{uniqueEndpoints([selected?.baseUrl || "", ...providerEndpointList(props.provider)]).map((endpoint) => <option key={endpoint} value={endpoint} />)}</datalist>
      </CardForm>
      {props.section === "provider" ? null : <CredentialsPanel {...props} {...syncProps} selected={selected} />}
    </div>
  );
}

type ProviderStepperProps = SettingsProvidersTabProps & {
  savedProvider: ProviderConfig;
  savedSelected?: ProviderCatalogItem;
  selected?: ProviderCatalogItem;
  providerDirty: boolean;
  providerOnboarding: ReturnType<typeof providerOnboardingState>;
  selectableAgents: Instance[];
  selectedSyncKeySet: ReadonlySet<string>;
  selectedSyncKeys: string[];
  selectedTargets: AgentSyncTarget[];
  setSelectedSyncKeys: Dispatch<SetStateAction<string[]>>;
};

function ProviderStepper(props: ProviderStepperProps) {
  const derivedActive = activeProviderStep(props.providerOnboarding);
  const { activeStep, toggleStep } = useStepperExpansion(derivedActive);

  const step1Complete = props.providerOnboarding.hasProvider;
  const step2Complete = props.providerOnboarding.authReady;
  const step3Complete = !props.providerDirty;
  const step4Reachable = step1Complete && step2Complete && step3Complete;

  return (
    <SettingsStepper>
      <SettingsStep
        index={1}
        title="Select model"
        active={activeStep === 1}
        complete={step1Complete}
        locked={false}
        summary={step1Complete ? `${props.providerOnboarding.providerLabel} · ${props.provider.model || "No model"}` : "Pick a provider and model"}
        onToggle={() => toggleStep(1)}
      >
        <ProviderModelFields {...props} />
      </SettingsStep>
      <SettingsStep
        index={2}
        title="Confirm auth"
        active={activeStep === 2}
        complete={step2Complete}
        locked={!step1Complete}
        summary={step2Complete ? authSummary(props) : "Confirm how agents authenticate"}
        onToggle={() => toggleStep(2)}
      >
        <ProviderAuthFields {...props} />
      </SettingsStep>
      <SettingsStep
        index={3}
        title="Save provider"
        active={activeStep === 3}
        complete={step3Complete}
        locked={!step2Complete}
        summary={step3Complete ? "Saved as fleet default" : "Unsaved draft"}
        onToggle={() => toggleStep(3)}
      >
        <ProviderSaveFields {...props} />
      </SettingsStep>
      <SettingsStep
        index={4}
        title="Apply to agents"
        active={activeStep === 4}
        complete={step4Reachable && !props.globalConfig.requiresSync}
        locked={!step4Reachable}
        summary={step4Reachable ? (props.globalConfig.requiresSync ? "Sync required" : "Synced") : "Complete steps above first"}
        onToggle={() => toggleStep(4)}
      >
        <ProviderApplyFields {...props} />
      </SettingsStep>
    </SettingsStepper>
  );
}

function ProviderModelFields(props: ProviderStepperProps) {
  const endpoints = providerEndpointList(props.provider);
  return (
    <div className="provider-model-fields">
      <FieldGroup className="provider-model-grid">
        <Field>
          <FieldLabel htmlFor="provider-select">Provider</FieldLabel>
          <Select value={props.provider.provider} onValueChange={(value) => {
            const preset = props.providerCatalog.providers.find((item) => item.id === value);
            const customEndpoints = providerEndpointList(props.provider);
            props.setProvider({
              provider: value,
              model: preset?.models?.[0] || props.provider.model,
              baseUrl: value === "custom" ? customEndpoints[0] || "" : preset?.baseUrl || "",
              customEndpoints,
            });
            if (preset?.credentialKeys?.[0]) props.setCredential({ ...props.credential, key: preset.credentialKeys[0] });
          }}>
            <SelectTrigger id="provider-select" className="w-full"><SelectValue placeholder="Select provider" /></SelectTrigger>
            <SelectContent>{props.providerCatalog.providers.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <FieldDescription>{providerDescription(props.selected)}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="provider-model">Model</FieldLabel>
          <Input id="provider-model" value={props.provider.model || ""} onChange={(event) => props.setProvider({ ...props.provider, model: event.target.value })} placeholder="model" list="global-provider-models" />
        </Field>
        <Field>
          <FieldLabel htmlFor="provider-base-url">{props.provider.provider === "custom" ? "Active endpoint" : "Base URL"}</FieldLabel>
          <Input id="provider-base-url" value={props.provider.baseUrl || ""} onChange={(event) => props.setProvider({ ...props.provider, baseUrl: event.target.value })} placeholder={props.provider.provider === "custom" ? "https://models.example.com/v1" : "Optional for hosted providers"} list="global-provider-endpoints" />
          <FieldDescription>{props.selected?.baseUrlEnvKey ? props.selected.baseUrlEnvKey : endpoints.length ? `${endpoints.length} custom endpoint${endpoints.length === 1 ? "" : "s"}` : "Provider default"}</FieldDescription>
        </Field>
      </FieldGroup>
      {props.provider.provider === "custom" ? <CustomEndpointPanel disabled={props.busy} provider={props.provider} setProvider={props.setProvider} /> : null}
    </div>
  );
}

function ProviderAuthFields(props: ProviderStepperProps) {
  if (providerUsesDeviceLogin(props.selected, props.provider.provider)) return <CodexDeviceLogin {...props} />;
  if (props.providerOnboarding.needsApiKey) return <InlineApiKeyForm {...props} />;
  return (
    <div className="provider-auth-confirmation">
      <Check className="size-4" />
      <span>No API key required for this provider.</span>
    </div>
  );
}

function authSummary(props: ProviderStepperProps) {
  if (providerUsesDeviceLogin(props.selected, props.provider.provider)) {
    return props.providerOnboarding.oauthCredential ? (props.providerOnboarding.oauthCredential.synced ? "Device login synced" : "Device login saved") : "Device login required";
  }
  if (props.providerOnboarding.needsApiKey) {
    const savedKey = props.globalConfig.credentials.find((item) => props.selected?.credentialKeys?.includes(item.key));
    return savedKey ? `${savedKey.key} saved` : "API key required";
  }
  return "No key required";
}

function InlineApiKeyForm(props: ProviderStepperProps) {
  const keyError = credentialKeyError(props.credential.key);
  const valueError = /[\n\r\0]/.test(props.credential.value) ? "Credential values must be a single line." : "";
  const hasError = Boolean(keyError || valueError);
  const suggestedKey = props.selected?.credentialKeys?.[0] || "";
  const savedKey = props.globalConfig.credentials.find((item) => props.selected?.credentialKeys?.includes(item.key));
  const canUseSuggestedKey = Boolean(suggestedKey && props.credential.key.trim() !== suggestedKey);

  return (
    <div className="inline-api-key-form">
      {savedKey ? (
        <div className="inline-api-key-status">
          <Check className="size-4" />
          <span><strong>{savedKey.key}</strong> is saved and will be inherited by agents.</span>
          <Button variant="ghost" size="sm" type="button" onClick={() => props.removeCredential(savedKey.key)} disabled={props.busy} aria-label={`Remove ${savedKey.key}`}>
            {props.busyAction === `remove:${savedKey.key}` ? <Spinner data-icon="inline-start" /> : <X data-icon="inline-start" />}
          </Button>
        </div>
      ) : (
        <Alert variant="warning"><CircleAlert /><span>This provider needs an API key before agents can use it.</span></Alert>
      )}
      <CardForm className="inline-api-key-entry" onSubmit={props.saveCredential}>
        <FieldGroup className="settings-credential-fields">
          <Field data-invalid={keyError || undefined}>
            <FieldLabel htmlFor="inline-credential-key">Key</FieldLabel>
            <Input id="inline-credential-key" value={props.credential.key} onChange={(event) => props.setCredential({ ...props.credential, key: event.target.value })} placeholder={suggestedKey || "OPENAI_API_KEY"} aria-invalid={Boolean(keyError)} autoCapitalize="off" autoComplete="off" spellCheck={false} />
            <FieldDescription>{keyError || CREDENTIAL_KEY_HELP}</FieldDescription>
          </Field>
          <Field data-invalid={valueError || undefined}>
            <FieldLabel htmlFor="inline-credential-value">Value</FieldLabel>
            <Input id="inline-credential-value" value={props.credential.value} onChange={(event) => props.setCredential({ ...props.credential, value: event.target.value })} placeholder="Paste secret value" type="password" aria-invalid={Boolean(valueError)} autoComplete="off" spellCheck={false} />
            <FieldDescription>{valueError || "Paste the secret exactly as provided."}</FieldDescription>
          </Field>
        </FieldGroup>
        <div className="inline-api-key-actions">
          {canUseSuggestedKey ? (
            <Button variant="ghost" size="sm" type="button" onClick={() => props.setCredential((current) => ({ ...current, key: suggestedKey }))} disabled={props.busy}>
              Use {suggestedKey}
            </Button>
          ) : null}
          <Button type="submit" disabled={props.busy || hasError || !props.credential.key.trim() || !props.credential.value.trim()}>
            {props.busyAction === "credential" ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {props.busyAction === "credential" ? "Saving" : "Save credential"}
          </Button>
        </div>
      </CardForm>
    </div>
  );
}

function ProviderSaveFields(props: ProviderStepperProps) {
  return (
    <div className="provider-save-fields">
      <p className="provider-save-detail">
        {props.providerDirty
          ? "Save the current draft as the fleet default. New agents will inherit it."
          : "The saved provider is the fleet default. Edit step 1 to make changes."}
      </p>
      <Button type="submit" disabled={props.busy || !props.providerDirty} form={undefined}>
        {props.busyAction === "provider" ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
        {props.busyAction === "provider" ? "Saving" : "Save provider"}
      </Button>
    </div>
  );
}

function ProviderApplyFields(props: ProviderStepperProps) {
  const hasAgents = props.selectableAgents.length > 0;
  return (
    <div className="provider-apply-fields">
      {props.globalConfig.requiresSync ? (
        <Alert variant="warning"><RefreshCw /><span>Saved provider, credential, or auth changes need syncing to existing agents.</span></Alert>
      ) : null}
      <SyncTargetPicker {...props} disabled={props.busy} emptyDescription="Create an agent, then return here to push the saved provider and auth." />
      <div className="provider-apply-actions">
        <Button variant="outline" type="button" onClick={() => props.sync(props.selectedTargets)} disabled={props.busy || !hasAgents || !props.selectedTargets.length}>
          {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          {props.busyAction === "sync" ? "Syncing" : `Sync selected (${props.selectedTargets.length})`}
        </Button>
        <Button variant="outline" type="button" onClick={() => props.sync()} disabled={props.busy || !hasAgents}>
          {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          Sync all agents
        </Button>
      </div>
    </div>
  );
}

function CustomEndpointPanel({ disabled, provider, setProvider }: {
  disabled?: boolean;
  provider: ProviderConfig;
  setProvider: Dispatch<SetStateAction<ProviderConfig>>;
}) {
  const [draft, setDraft] = useState("");
  const endpoints = providerEndpointList(provider);
  const activeEndpoint = cleanEndpoint(provider.baseUrl || "");
  const draftEndpoint = cleanEndpoint(draft);

  function setEndpoints(nextEndpoints: string[], baseUrl = provider.baseUrl) {
    setProvider({ ...provider, provider: "custom", baseUrl, customEndpoints: uniqueEndpoints(nextEndpoints) });
  }

  function addEndpoint() {
    if (!draftEndpoint) return;
    setEndpoints([...endpoints, draftEndpoint], draftEndpoint);
    setDraft("");
  }

  function removeEndpoint(endpoint: string) {
    const remaining = endpoints.filter((item) => item !== endpoint);
    setEndpoints(remaining, activeEndpoint === endpoint ? remaining[0] || "" : provider.baseUrl);
  }

  return (
    <section className="provider-panel custom-endpoint-panel">
      <div className="settings-subsection-heading">
        <strong>Custom endpoints</strong>
        <span>{endpoints.length}/{CUSTOM_ENDPOINT_LIMIT}</span>
      </div>
      <div className="custom-endpoint-list">
        {endpoints.length ? endpoints.map((endpoint) => {
          const active = endpoint === activeEndpoint;
          return (
            <div className={classNames("custom-endpoint-row", active && "active")} key={endpoint}>
              <button className="custom-endpoint-select" type="button" onClick={() => setProvider({ ...provider, baseUrl: endpoint, customEndpoints: endpoints })} disabled={disabled}>
                <Network />
                <span>{endpoint}</span>
              </button>
              <Badge variant={active ? "success" : "secondary"}>{active ? "Active" : "Saved"}</Badge>
              <Button aria-label={`Remove ${endpoint}`} disabled={disabled} size="icon" title={`Remove ${endpoint}`} type="button" variant="ghost" onClick={() => removeEndpoint(endpoint)}>
                <X data-icon="inline-start" />
              </Button>
            </div>
          );
        }) : <p className="custom-endpoint-empty">No endpoints saved.</p>}
      </div>
      <div className="custom-endpoint-add">
        <Input
          aria-label="Custom endpoint URL"
          disabled={disabled || endpoints.length >= CUSTOM_ENDPOINT_LIMIT}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addEndpoint();
            }
          }}
          placeholder="https://models.example.com/v1"
          value={draft}
        />
        <Button disabled={disabled || !draftEndpoint || endpoints.length >= CUSTOM_ENDPOINT_LIMIT} type="button" variant="outline" onClick={addEndpoint}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </div>
    </section>
  );
}

function CodexDeviceLogin(props: SettingsProvidersTabProps) {
  const credential: OAuthCredentialSummary | undefined = props.globalConfig.oauthCredentials.find((item) => item.provider === "openai-codex");
  const session = props.oauthSession?.provider === "openai-codex" ? props.oauthSession : null;
  const loginUrl = session?.verificationUriComplete || session?.verificationUri || "";
  const needsSync = Boolean((credential && !credential.synced) || session?.status === "complete");
  const status = session?.status === "pending"
    ? "Waiting"
    : session?.status === "failed"
      ? "Failed"
      : credential?.synced
        ? "Synced"
        : credential
          ? "Saved"
          : "Not connected";

  return (
    <div className="codex-auth-panel">
      <div className="codex-auth-heading">
        <ShieldCheck />
        <div>
          <strong>Codex device login</strong>
          <span>Start here for Codex auth, then sync the saved Hermes credential to agents.</span>
        </div>
        <Badge variant={credential?.synced ? "success" : credential || session ? "warning" : "secondary"}>{status}</Badge>
      </div>

      {credential ? (
        <div className="codex-auth-summary">
          <Check className="size-4" />
          <span>Saved as {credential.label || "Fleet Codex device login"} on {formatDate(credential.savedAt)}.</span>
          <strong>{credential.synced ? `Synced ${formatDate(credential.syncedAt)}` : "Not synced to agents yet"}</strong>
        </div>
      ) : (
        <p className="codex-auth-muted">No fleet Codex login is saved. Device login is the first required step for this provider.</p>
      )}

      {session ? (
        <div className="codex-device-session">
          {session.status === "pending" ? (
            <>
              <span>Enter this code in the browser:</span>
              <strong>{session.userCode}</strong>
              {loginUrl ? (
                <Button asChild variant="outline">
                  <a href={loginUrl} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" />
                    Open login page
                  </a>
                </Button>
              ) : (
                <Alert variant="warning"><CircleAlert /><span>Login page unavailable. Start a new device login and try again.</span></Alert>
              )}
            </>
          ) : null}
          {session.status === "failed" ? (
            <Alert variant="destructive"><CircleAlert /><span>{formatOauthError(session.error)}</span></Alert>
          ) : null}
        </div>
      ) : null}

      <div className="codex-auth-actions">
        <Button variant="outline" type="button" onClick={props.startOauth} disabled={props.busy}>
          {props.busyAction === "oauth" ? <Spinner data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}
          {credential ? "Refresh login" : "Device login"}
        </Button>
        {needsSync ? (
          <Button type="button" onClick={() => props.sync()} disabled={props.busy}>
            {props.busyAction === "sync" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            Sync Codex auth to all agents
          </Button>
        ) : null}
      </div>
    </div>
  );
}
