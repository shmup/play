import type { ClientMessage, ServerMessage } from "./shared.ts";

export interface ServerPlugin {
  id: string;
  priority: number;
  onInit?: (context: ServerPluginContext) => void;
  onClientConnect?: (clientId: string, context: ServerPluginContext) => void;
  onClientDisconnect?: (clientId: string, context: ServerPluginContext) => void;
  onMessage?: (
    clientId: string,
    message: ClientMessage,
    context: ServerPluginContext,
  ) => boolean | void;
}

export interface ServerPluginContext {
  broadcast: (message: ServerMessage, excludeClientId?: string) => void;
  sendTo: (clientId: string, message: ServerMessage) => void;
  getState: () => ServerAppState;
  setState: (updater: (state: ServerAppState) => void) => void;
}

export interface ServerAppState {
  clients: Map<string, ClientState>;
  [key: string]: unknown;
}

export interface ClientState {
  socket: WebSocket;
  [key: string]: unknown;
}
