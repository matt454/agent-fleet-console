import { FormEvent } from "react";
import { Activity, AlertTriangle, RefreshCw, Send, Square } from "lucide-react";
import type { Instance, Job } from "../models/fleet.ts";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import { Textarea } from "../components/ui/input.tsx";
import { ScrollArea } from "../components/ui/scroll-area.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { chatAlertTitle, chatErrorDescription } from "./chat-utils.ts";
import { ChatMessages } from "./ChatMessages.tsx";
import { SessionMenu } from "./SessionMenu.tsx";
import { useChatPanel } from "./useChatPanel.ts";
import { DashboardPanelHeader } from "../components/layout/FleetShell.tsx";

export function ChatPanel({
  selected,
  jobs,
  instances,
  openAgent,
}: {
  selected: Instance;
  jobs: Job[];
  instances: Instance[];
  openAgent: (name: string, nodeId?: string) => void;
}) {
  const chat = useChatPanel({ selected, jobs, instances, openAgent });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    chat.sendMessage(chat.text);
  }

  return (
    <Card as="section" className="transcript-panel">
      <DashboardPanelHeader
        title={chat.selectedAgentLabel}
        subtitle={`${chat.nodeLabel} · ${chat.selectedSessionTitle}`}
        actions={
          <>
            <Badge variant="outline" className="typing-indicator"><Activity /> {chat.statusLabel}</Badge>
            {chat.canStop ? (
              <Button type="button" variant="outline" size="sm" onClick={chat.stopTurn}>
                <Square data-icon="inline-start" />
                Stop
              </Button>
            ) : null}
            <SessionMenu
              activeJobs={chat.activeJobs}
              filter={chat.filter}
              filterInputRef={chat.filterInputRef}
              filterValue={chat.dropdownFilter}
              groupedSessions={chat.groupedSessions}
              onFilterChange={chat.setDropdownFilter}
              onOpenChange={chat.setDropdownOpen}
              onSelectAgent={chat.selectAgent}
              onSelectSession={chat.selectSession}
              onStartNewChat={chat.startNewChat}
              open={chat.dropdownOpen}
              selectedName={selected.fleetKey || `${selected.nodeId || "local"}:${selected.name}`}
              selectedAgentLabel={chat.selectedAgentLabel}
              selectedSessionId={chat.selectedSessionId}
              sessionsLoading={chat.sessionsLoading}
              singleAgent={chat.singleAgent}
            />
          </>
        }
      />
      <div className="chat-panel-body">
        {chat.chatError ? (
          <Alert variant="warning" className="chat-alert">
            <AlertTriangle />
            <div>
              <strong>{chatAlertTitle(chat.chatError, selected)}</strong>
              <span>{chatErrorDescription(chat.chatError, selected.name, selected)}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => chat.loadSessions()} disabled={chat.loading}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </Alert>
        ) : null}
        <CardContent className="chat-panel-content">
          {chat.loading ? (
            <div className="chat-loading"><Skeleton /><Skeleton /><Skeleton /></div>
          ) : (
            <ScrollArea className="chat-scroll-area">
              <div className="chat-scroll-content">
                <ChatMessages agentName={selected.name} messages={chat.messages} agentIsTyping={chat.agentIsTyping} />
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </div>
      <form className="chat-composer-form" onSubmit={submit}>
        <div className="chat-execution-policy">
          <label title="Runs this chat turn with Hermes approval prompts bypassed. Hard-blocked commands still stay blocked.">
            <Checkbox
              checked={chat.bypassApprovals}
              disabled={chat.turnActive}
              onChange={(event) => chat.setBypassApprovals(event.target.checked)}
            />
            <span>
              <strong>Bypass approvals</strong>
              <small>Use for trusted publish or maintenance tasks.</small>
            </span>
          </label>
          {chat.bypassApprovals ? <Badge variant="outline" className="execution-policy-badge">YOLO</Badge> : null}
        </div>
        <div className="chat-composer-field">
          <Textarea
            className="chat-composer-input"
            value={chat.text}
            onChange={(event) => chat.setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                chat.sendMessage(chat.text);
              }
            }}
            placeholder={`Message ${selected.name}`}
            disabled={chat.turnActive}
            rows={1}
          />
          <Button className="chat-send-button" type="submit" size="icon" aria-label="Send message" disabled={!chat.text.trim() || chat.turnActive}>
            <Send />
          </Button>
        </div>
      </form>
    </Card>
  );
}
