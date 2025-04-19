import type { ServerMessage } from "../../types/shared.ts";
import type {
  ClientState,
  ServerAppState,
  ServerPlugin,
  ServerPluginContext,
} from "../../types/server.ts";

export const plugins: ServerPlugin[] = [];

export const appState: ServerAppState = {
  clients: new Map<string, ClientState>(),
};

export function registerPlugin(plugin: ServerPlugin): void {
  plugins.push(plugin);
  plugins.sort((a, b) => a.priority - b.priority);
  plugin.onInit?.(createContext());
}

export function createContext(): ServerPluginContext {
  return {
    broadcast: (message: ServerMessage, excludeClientId?) => {
      for (const [id, client] of appState.clients.entries()) {
        if (
          (!excludeClientId || id !== excludeClientId) &&
          client.socket.readyState === WebSocket.OPEN
        ) {
          client.socket.send(JSON.stringify(message));
        }
      }
    },

    sendTo: (clientId, message) => {
      const client = appState.clients.get(clientId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    },

    getState: () => ({ ...appState }),

    setState: (updater) => {
      updater(appState);
    },
  };
}
