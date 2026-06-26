import { api, apiErrorMessage } from "../controllers/api.ts";
import type { Instance, Session } from "../models/fleet.ts";
import type { AgentSessionState } from "./chat-utils.ts";

export async function fetchSessionsByAgent(instances: Instance[]): Promise<Array<[string, AgentSessionState]>> {
  return Promise.all(instances.map(async (instance): Promise<[string, AgentSessionState]> => {
    const key = instance.fleetKey || `${instance.nodeId || "local"}:${instance.name}`;
    try {
      const data = await api<{ sessions: Session[] }>(`/api/fleet/${encodeURIComponent(instance.nodeId || "local")}/instances/${encodeURIComponent(instance.name)}/sessions`);
      return [key, { sessions: data.sessions || [], loaded: true }];
    } catch (error: unknown) {
      return [key, { sessions: [], loaded: true, error: apiErrorMessage(error, "Unavailable") }];
    }
  }));
}
