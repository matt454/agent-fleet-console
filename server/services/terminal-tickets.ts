import crypto from "node:crypto";
import { TERMINAL_TICKET_TTL_MS } from "../config.ts";

const tickets = new Map<string, { name: string; expiresAt: number }>();

export function createTerminalTicket(name: string) {
  const ticket = crypto.randomBytes(24).toString("base64url");
  tickets.set(ticket, { name, expiresAt: Date.now() + TERMINAL_TICKET_TTL_MS });
  return ticket;
}

export function validateTerminalTicket(name: string, ticket: string) {
  const row = tickets.get(ticket);
  if (!row || row.name !== name || row.expiresAt < Date.now()) {
    tickets.delete(ticket);
    return false;
  }
  tickets.delete(ticket);
  return true;
}
