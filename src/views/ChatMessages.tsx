import { ReactNode, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { classNames } from "../controllers/format.ts";
import type { Message } from "../models/fleet.ts";
import { Avatar, AvatarFallback } from "../components/ui/avatar.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty.tsx";

function initials(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AI";
}

function messageBlocks(content: string) {
  const value = content?.trim() || "(empty)";
  const parsed = parseStructuredMessage(value);
  if (parsed.valid) return <JsonValue value={parsed.value} />;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ children, className }) {
          const language = /language-([A-Za-z0-9_-]+)/.exec(className || "")?.[1];
          return <code data-language={language || undefined}>{children}</code>;
        },
        a({ children, href }) {
          return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
        },
      }}
    >
      {value}
    </ReactMarkdown>
  );
}

function parseStructuredMessage(value: string): { valid: true; value: unknown } | { valid: false } {
  if (!value || !/^[\[{]/.test(value)) return { valid: false };
  try {
    const parsed = JSON.parse(value);
    if (!looksLikeToolEvent(parsed)) return { valid: false };
    return { valid: true, value: parsed };
  } catch {
    return { valid: false };
  }
}

function looksLikeToolEvent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(looksLikeToolEvent);
  if (!value || typeof value !== "object") return false;
  const keys = new Set(Object.keys(value as Record<string, unknown>).map((key) => key.toLowerCase()));
  return ["tool", "tool_name", "toolcall", "tool_call", "status", "error", "result", "approval"].some((key) => keys.has(key));
}

function JsonValue({ value, name }: { value: unknown; name?: string }): ReactNode {
  if (Array.isArray(value)) {
    return (
      <div className="json-node">
        {name ? <span className="json-key">{name}</span> : null}
        <div className="json-summary">Array <span>{value.length}</span></div>
        <div className="json-children">
          {value.length ? value.map((item, index) => <JsonValue key={index} name={String(index)} value={item} />) : <span className="json-empty">Empty array</span>}
        </div>
      </div>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="json-node">
        {name ? <span className="json-key">{name}</span> : null}
        <div className="json-summary">Object <span>{entries.length}</span></div>
        <div className="json-children">
          {entries.length ? entries.map(([key, item]) => <JsonValue key={key} name={key} value={item} />) : <span className="json-empty">Empty object</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="json-leaf">
      {name ? <span className="json-key">{name}</span> : null}
      <span className={`json-value json-${value === null ? "null" : typeof value}`}>{formatJsonScalar(value)}</span>
    </div>
  );
}

function formatJsonScalar(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return String(value);
}

export function ChatMessages({
  agentName,
  messages,
  agentIsTyping,
}: {
  agentName: string;
  messages: Message[];
  agentIsTyping: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, agentIsTyping]);

  if (!messages.length && !agentIsTyping) {
    return (
      <Empty className="chat-empty-state">
        <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No messages yet</EmptyTitle>
          <EmptyDescription>Start a focused chat with {agentName}.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="chat-message-list">
      {messages.map((message) => {
        const fromUser = message.role === "user";
        const role = message.role.toLowerCase();
        const systemRole = ["system", "tool", "function", "error"].includes(role);
        const label = fromUser ? "You" : role === "tool" || role === "function" ? "Tool" : role === "system" ? "System" : role === "error" ? "Error" : agentName;
        return (
          <article className={classNames("chat-message-row", fromUser && "user", systemRole && role, message.pending && "pending")} key={message.id}>
            {!fromUser ? <Avatar size="sm" className="chat-avatar"><AvatarFallback>{initials(agentName)}</AvatarFallback></Avatar> : null}
            <div className="chat-message-stack">
              <span className="chat-message-meta">{label}{message.pending ? " · pending" : ""}</span>
              <div className="chat-message-bubble">{messageBlocks(message.content)}</div>
            </div>
          </article>
        );
      })}
      {agentIsTyping ? (
        <article className="chat-message-row">
          <Avatar size="sm" className="chat-avatar"><AvatarFallback>{initials(agentName)}</AvatarFallback></Avatar>
          <div className="chat-message-stack">
            <span className="chat-message-meta">{agentName}</span>
            <div className="chat-message-bubble muted">
              <span className="typing-dots" aria-label={`${agentName} is working`}><span /><span /><span /></span>
            </div>
          </div>
        </article>
      ) : null}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
