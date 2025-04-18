import type { ClientMessage } from "../../types/shared.ts";
import type {
  ServerAppState,
  ServerPlugin,
  ServerPluginContext,
} from "../../types/server.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";

export const CursorServerPlugin: ServerPlugin = {
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: ServerPluginContext) {
    context.setState((state: ServerAppState) => {
      state.cursors = {};
    });
  },

  onClientConnect(clientId: string, context: ServerPluginContext) {
    const color = getRandomColor();

    // We'll initialize with default center values
    // The actual position will be updated when the client sends its dimensions
    const defaultX = 500;
    const defaultY = 300;

    context.setState((state: ServerAppState) => {
      if (!state.cursors) state.cursors = {};
      state.cursors[clientId] = { x: defaultX, y: defaultY, color };
    });

    // Send current cursor positions to new client
    const state = context.getState();
    context.sendTo(clientId, {
      type: "init",
      clientId,
      cursors: state.cursors || {},
    });

    // Notify other clients about new cursor
    context.broadcast({
      type: "update",
      clientId,
      x: defaultX,
      y: defaultY,
      color,
    }, clientId);
  },

  onClientDisconnect(clientId: string, context: ServerPluginContext) {
    context.setState((state) => {
      if (state.cursors) {
        delete state.cursors[clientId];
      }
    });

    context.broadcast({
      type: "disconnect",
      clientId,
    });
  },

  onMessage(
    clientId: string,
    message: ClientMessage,
    context: ServerPluginContext,
  ) {
    // Handle window dimensions message to center cursor
    if (message.type === "custom" && message.pluginId === PLUGIN_ID && message.data?.windowSize) {
      const { width, height } = message.data.windowSize;
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const state = context.getState();
      const cursorState = state.cursors?.[clientId];

      if (cursorState) {
        // Update server state with centered position
        context.setState((state) => {
          if (state.cursors) {
            state.cursors[clientId] = {
              ...state.cursors[clientId],
              x: centerX,
              y: centerY,
            };
          }
        });

        // Broadcast to all clients
        context.broadcast({
          type: "update",
          clientId,
          x: centerX,
          y: centerY,
          color: cursorState.color,
        });
      }
      
      return false;
    }
    
    if (message.type === "move") {
      const state = context.getState();
      const cursorState = state.cursors?.[clientId];

      if (cursorState) {
        // Update server state
        context.setState((state) => {
          if (state.cursors) {
            state.cursors[clientId] = {
              ...state.cursors[clientId],
              x: message.x,
              y: message.y,
            };
          }
        });

        // Broadcast to all clients INCLUDING sender
        // This ensures everyone has the same state
        context.broadcast({
          type: "update",
          clientId,
          x: message.x,
          y: message.y,
          color: cursorState.color,
        });

        // Return false to prevent other plugins from handling this message
        return false;
      }
    }

    // Allow other plugins to handle this message
    return true;
  },
};

function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
