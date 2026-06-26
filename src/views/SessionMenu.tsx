import type { RefObject } from "react";
import { Activity, ChevronDown, Plus, Search } from "lucide-react";
import { classNames } from "../controllers/format.ts";
import type { Job } from "../models/fleet.ts";
import { Button } from "../components/ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu.tsx";
import { Input } from "../components/ui/input.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { type AgentSessions, isJobActive, messageCountLabel, messagePreview } from "./chat-utils.ts";

export function SessionMenu({
  activeJobs,
  filter,
  filterInputRef,
  filterValue,
  groupedSessions,
  onFilterChange,
  onOpenChange,
  onSelectAgent,
  onSelectSession,
  onStartNewChat,
  open,
  selectedName,
  selectedAgentLabel,
  selectedSessionId,
  sessionsLoading,
  singleAgent,
}: {
  activeJobs: Job[];
  filter: string;
  filterInputRef: RefObject<HTMLInputElement | null>;
  filterValue: string;
  groupedSessions: AgentSessions[];
  onFilterChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelectAgent: (agentKey: string) => void;
  onSelectSession: (agentKey: string, sessionId: string) => void;
  onStartNewChat: () => void;
  open: boolean;
  selectedName: string;
  selectedAgentLabel: string;
  selectedSessionId: string;
  sessionsLoading: boolean;
  singleAgent: boolean;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ChevronDown data-icon="inline-start" />
          Sessions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="session-menu-content" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuLabel>Sessions</DropdownMenuLabel>
        <div className="session-search">
          <Search />
          <Input
            ref={filterInputRef}
            className="session-search-input"
            value={filterValue}
            onChange={(event) => onFilterChange(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={singleAgent ? "Search sessions" : "Search agents or sessions"}
          />
        </div>
        <DropdownMenuItem className="session-option new" onSelect={onStartNewChat}>
          <Plus data-icon="inline-start" />
          {singleAgent ? "New chat" : `New chat with ${selectedAgentLabel}`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!singleAgent && sessionsLoading ? <Skeleton className="session-menu-skeleton" /> : null}
        {groupedSessions.map((group) => {
          const visible = group.sessions.filter((session) => {
            const title = session.title || "Untitled";
            const haystack = singleAgent ? title.toLowerCase() : `${group.label} ${title}`.toLowerCase();
            return !filter || haystack.includes(filter);
          });
          if (!visible.length && filter) return null;
          return (
            <DropdownMenuGroup className="session-group" key={group.agentKey}>
              {!singleAgent ? (
                <DropdownMenuItem className={classNames("session-agent", selectedName === group.agentKey && "active")} onSelect={() => onSelectAgent(group.agentKey)}>
                  <span>{group.label}</span>
                  {isJobActive(group.agent, activeJobs, group.nodeId) ? <Activity data-icon="inline-end" /> : null}
                </DropdownMenuItem>
              ) : null}
              {visible.map((session) => (
                <DropdownMenuItem
                  key={session.id}
                  className={classNames("session-option", selectedName === group.agentKey && session.id === selectedSessionId && "active")}
                  onSelect={() => onSelectSession(group.agentKey, session.id)}
                >
                  <span>{messagePreview(session.title || "Untitled", 34)}</span>
                  <small>{messageCountLabel(session.messageCount)}</small>
                </DropdownMenuItem>
              ))}
              {!visible.length && !filter && group.loaded && group.error ? (
                <div className="session-state unavailable">Sessions unavailable · {messagePreview(group.error, 44)}</div>
              ) : null}
              {!visible.length && !filter && group.loaded && !group.error ? (
                <div className="session-state">No saved sessions</div>
              ) : null}
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
