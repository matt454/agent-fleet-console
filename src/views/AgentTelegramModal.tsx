import QRCode from "qrcode";
import { CheckCircle2, ExternalLink, MessageCircle, QrCode, Send, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { CardContent, CardFooter, CardForm } from "../components/ui/card.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { DialogContent, DialogDescription, DialogHeader, DialogOverlay, DialogTitle } from "../components/ui/dialog.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field.tsx";
import { Input } from "../components/ui/input.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { api, apiErrorMessage, postJson } from "../controllers/api.ts";
import type { Instance, TelegramAgentOptions } from "../models/fleet.ts";

const TELEGRAM_USER_ID_PATTERN = /^[1-9]\d{4,19}$/;
const TELEGRAM_BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{30,}$/;

type TelegramSetup = {
  pairingId: string;
  deepLink: string;
  qrPayload: string;
  expiresAt: string;
};

type TelegramStatus = {
  status: "waiting" | "ready";
  botToken?: string;
  bot_token?: string;
  botUsername?: string;
  bot_username?: string;
  ownerUserId?: string;
  owner_user_id?: string;
  expiresAt?: string;
  expires_at?: string;
};

function displayNameFor(selected: Instance) {
  return String(selected.displayName || "").trim() || selected.name;
}

export function AgentTelegramModal({ open, selected, onClose, onConnect }: {
  open: boolean;
  selected: Instance;
  onClose: () => void;
  onConnect: (name: string, telegram: TelegramAgentOptions, nodeId?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"qr" | "existing">("qr");
  const [phase, setPhase] = useState<"idle" | "starting" | "waiting" | "ready">("idle");
  const [setup, setSetup] = useState<TelegramSetup | null>(null);
  const [qr, setQr] = useState("");
  const [botToken, setBotToken] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [trustedTelegramId, setTrustedTelegramId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nodeId = selected.nodeId || "local";
  const trustedIdInvalid = trustedTelegramId.trim() !== "" && !TELEGRAM_USER_ID_PATTERN.test(trustedTelegramId.trim());
  const botTokenInvalid = mode === "existing" && botToken.trim() !== "" && !TELEGRAM_BOT_TOKEN_PATTERN.test(botToken.trim());
  const canSubmit = TELEGRAM_BOT_TOKEN_PATTERN.test(botToken.trim()) && TELEGRAM_USER_ID_PATTERN.test(trustedTelegramId.trim());

  function resetPairing(clearSecrets = mode === "qr") {
    setPhase("idle");
    setSetup(null);
    setQr("");
    setError("");
    if (clearSecrets) {
      setBotToken("");
      setBotUsername("");
      setTrustedTelegramId("");
    }
  }

  async function startSetup() {
    if (phase === "starting" || phase === "waiting") return;
    setPhase("starting");
    setError("");
    setBotToken("");
    setBotUsername("");
    try {
      const response = await postJson<any>(`/api/fleet/${encodeURIComponent(nodeId)}/telegram/onboarding/start`, {
        botName: `${displayNameFor(selected)} Hermes`,
      });
      const normalized = {
        pairingId: response.pairingId || response.pairing_id,
        deepLink: response.deepLink || response.deep_link,
        qrPayload: response.qrPayload || response.qr_payload,
        expiresAt: response.expiresAt || response.expires_at,
      };
      setQr(await QRCode.toDataURL(normalized.qrPayload, { errorCorrectionLevel: "M", margin: 1, width: 224 }));
      setSetup(normalized);
      setPhase("waiting");
    } catch (setupError) {
      setPhase("idle");
      setError(apiErrorMessage(setupError, "Telegram setup could not start."));
    }
  }

  async function cancelSetup() {
    if (setup) {
      await api(`/api/fleet/${encodeURIComponent(nodeId)}/telegram/onboarding/${encodeURIComponent(setup.pairingId)}`, { method: "DELETE" }).catch(() => null);
    }
    resetPairing();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const trustedUserId = trustedTelegramId.trim();
      await onConnect(selected.name, {
        enabled: true,
        botToken: botToken.trim(),
        botUsername: botUsername.trim().replace(/^@/, ""),
        trustedUserId,
        allowedUserIds: [trustedUserId],
        homeChannel: trustedUserId,
      }, nodeId);
      toast.success("Telegram setup queued", { description: `${displayNameFor(selected)} will restart if it is running.` });
      onClose();
    } catch (submitError) {
      setError(apiErrorMessage(submitError, "Telegram could not be connected."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || mode !== "qr" || phase !== "waiting" || !setup) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const status = await api<TelegramStatus>(`/api/fleet/${encodeURIComponent(nodeId)}/telegram/onboarding/${encodeURIComponent(setup.pairingId)}`);
        if (cancelled) return;
        if (status.status === "ready") {
          const ownerId = status.ownerUserId || status.owner_user_id || "";
          setBotToken(status.botToken || status.bot_token || "");
          setBotUsername(status.botUsername || status.bot_username || "");
          if (ownerId && TELEGRAM_USER_ID_PATTERN.test(ownerId)) setTrustedTelegramId(ownerId);
          setPhase("ready");
          setError("");
          return;
        }
        timer = window.setTimeout(poll, 2000);
      } catch (pollError) {
        if (cancelled) return;
        setError(apiErrorMessage(pollError, "Telegram setup status could not be checked."));
        timer = window.setTimeout(poll, 2500);
      }
    };
    timer = window.setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [mode, nodeId, open, phase, setup]);

  useEffect(() => {
    if (open) return;
    resetPairing();
  }, [open]);

  const expiry = useMemo(() => {
    if (!setup?.expiresAt) return "";
    const ms = Date.parse(setup.expiresAt) - Date.now();
    if (!Number.isFinite(ms)) return "";
    if (ms <= 0) return "expired";
    return `${Math.ceil(ms / 60000)}m left`;
  }, [setup]);

  if (!open) return null;

  return (
    <DialogOverlay onClick={onClose}>
      <DialogContent className="create-agent-modal" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <div>
            <DialogTitle>Connect Telegram</DialogTitle>
            <DialogDescription>Add Telegram messaging to {displayNameFor(selected)}.</DialogDescription>
          </div>
          <Button variant="outline" size="icon" aria-label="Close Telegram setup" onClick={onClose}><X data-icon="inline-start" /></Button>
        </DialogHeader>
        <CardForm className="create-agent-form" onSubmit={submit}>
          <CardContent className="padded create-agent-content">
            <FieldGroup>
              <Field>
                <FieldLabel>Setup method</FieldLabel>
                <label className={`create-agent-option ${mode === "qr" ? "selected" : ""}`}>
                  <QrCode />
                  <span className="create-agent-option-copy"><strong>Create a bot</strong><small>Use the Hermes Telegram pairing flow to create and claim a new bot.</small></span>
                  <Checkbox checked={mode === "qr"} onChange={() => { setMode("qr"); resetPairing(true); }} aria-label="Create a new Telegram bot" />
                </label>
                <label className={`create-agent-option ${mode === "existing" ? "selected" : ""}`}>
                  <MessageCircle />
                  <span className="create-agent-option-copy"><strong>Existing bot</strong><small>Paste a BotFather token and choose the trusted account allowed to talk to this agent.</small></span>
                  <Checkbox checked={mode === "existing"} onChange={() => { setMode("existing"); resetPairing(true); }} aria-label="Connect an existing Telegram bot" />
                </label>
              </Field>
              {mode === "qr" ? (
                <Field data-invalid={trustedIdInvalid || undefined}>
                  <FieldLabel>Telegram pairing</FieldLabel>
                  <div className="telegram-create-panel">
                    <div className="telegram-create-actions">
                      <Button variant="outline" type="button" onClick={() => void startSetup()} disabled={phase === "starting" || phase === "waiting" || busy}>
                        {phase === "starting" ? <Spinner data-icon="inline-start" /> : <QrCode data-icon="inline-start" />}
                        {phase === "ready" ? "Restart QR setup" : phase === "waiting" ? "Waiting for Telegram" : "Generate QR"}
                      </Button>
                      {phase === "ready" ? <Badge variant="success"><CheckCircle2 data-icon="inline-start" />Bot ready</Badge> : null}
                      {setup && expiry ? <Badge variant="secondary">{expiry}</Badge> : null}
                    </div>
                    {qr ? (
                      <div className="telegram-create-qr">
                        <img src={qr} alt="Telegram setup QR code" />
                        <div className="telegram-create-qr-copy">
                          <strong>{phase === "ready" ? "Telegram confirmed" : "Scan to create the bot"}</strong>
                          <small>{botUsername ? `@${botUsername}` : "Tap Create Bot in Telegram after scanning."}</small>
                          <a href={setup?.deepLink || "#"} target="_blank" rel="noreferrer"><ExternalLink data-icon="inline-start" />Open Telegram</a>
                        </div>
                      </div>
                    ) : null}
                    {phase === "ready" ? (
                      <Field>
                        <FieldLabel htmlFor="telegram-trusted-id">Trusted Telegram account ID</FieldLabel>
                        <Input id="telegram-trusted-id" value={trustedTelegramId} onChange={(event) => { setTrustedTelegramId(event.target.value); setError(""); }} placeholder="123456789" inputMode="numeric" aria-invalid={trustedIdInvalid} />
                        <FieldDescription>{trustedIdInvalid ? "Use your numeric Telegram user ID." : "Only this account can talk to the agent."}</FieldDescription>
                      </Field>
                    ) : null}
                  </div>
                </Field>
              ) : (
                <>
                  <Field data-invalid={botTokenInvalid || undefined}>
                    <FieldLabel htmlFor="telegram-bot-token">Bot token</FieldLabel>
                    <Input id="telegram-bot-token" value={botToken} onChange={(event) => { setBotToken(event.target.value); setError(""); }} placeholder="123456789:AA..." autoFocus aria-invalid={botTokenInvalid} />
                    <FieldDescription>{botTokenInvalid ? "Use the token from BotFather." : "Saved as TELEGRAM_BOT_TOKEN in this agent's environment."}</FieldDescription>
                  </Field>
                  <Field data-invalid={trustedIdInvalid || undefined}>
                    <FieldLabel htmlFor="existing-telegram-trusted-id">Trusted Telegram account ID</FieldLabel>
                    <Input id="existing-telegram-trusted-id" value={trustedTelegramId} onChange={(event) => { setTrustedTelegramId(event.target.value); setError(""); }} placeholder="123456789" inputMode="numeric" aria-invalid={trustedIdInvalid} />
                    <FieldDescription>{trustedIdInvalid ? "Use a numeric Telegram user ID." : "Saved as TELEGRAM_ALLOWED_USERS and TELEGRAM_HOME_CHANNEL."}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="telegram-bot-username">Bot username</FieldLabel>
                    <Input id="telegram-bot-username" value={botUsername} onChange={(event) => setBotUsername(event.target.value)} placeholder="@my_agent_bot" />
                    <FieldDescription>Optional label for job output and future reference.</FieldDescription>
                  </Field>
                </>
              )}
            </FieldGroup>
            {error ? <Alert variant="warning">{error}</Alert> : null}
          </CardContent>
          <CardFooter className="create-agent-footer">
            <Button variant="outline" type="button" onClick={() => mode === "qr" ? void cancelSetup() : onClose()} disabled={busy}>Cancel</Button>
            <Button disabled={!canSubmit || busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
              Connect Telegram
            </Button>
          </CardFooter>
        </CardForm>
      </DialogContent>
    </DialogOverlay>
  );
}
