import type { ClientMessage } from "../../types/shared.ts";
import type {
  ServerAppState,
  ServerPlugin,
  ServerPluginContext,
} from "../../types/server.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import type { CursorState } from "../../types/shared.ts";

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
      (state.cursors as Record<string, CursorState>)[clientId] = {
        x: defaultX,
        y: defaultY,
        color,
      };
    });

    // Send current cursor positions to new client
    const state = context.getState();
    context.sendTo(clientId, {
      type: "init",
      clientId,
      cursors: (state.cursors ?? {}) as Record<string, CursorState>,
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
        delete (state.cursors as Record<string, CursorState>)[clientId];
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
    // Handle windowSize update (custom client message)
    if (
      message.type === "custom" && message.pluginId === PLUGIN_ID &&
      typeof (message.data as {
          windowSize?: { width: number; height: number };
        }).windowSize === "object"
    ) {
      const windowSize =
        (message.data as { windowSize?: { width: number; height: number } })
          .windowSize;
      if (windowSize) {
        const centerX = Math.floor(windowSize.width / 2);
        const centerY = Math.floor(windowSize.height / 2);
        const state = context.getState();
        const cursorState =
          (state.cursors as Record<string, CursorState> | undefined)
            ?.[clientId];

        if (cursorState) {
          // update server state with centered position
          context.setState((state) => {
            const cursors = state.cursors as Record<string, CursorState>;
            if (cursors) {
              cursors[clientId] = {
                ...cursors[clientId],
                x: centerX,
                y: centerY,
              };
            }
          });

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
    }

    // Handle move (cursor move messages)
    if (message.type === "move") {
      const state = context.getState();
      const cursors = state.cursors as Record<string, CursorState> | undefined;
      const cursorState = cursors?.[clientId];

      if (cursorState) {
        // update server state
        context.setState((state) => {
          const c = state.cursors as Record<string, CursorState>;
          if (c) {
            c[clientId] = {
              ...c[clientId],
              x: message.x,
              y: message.y,
            };
          }
        });

        context.broadcast({
          type: "update",
          clientId,
          x: message.x,
          y: message.y,
          color: cursorState.color,
        });

        // return false to prevent other plugins from handling this message
        return false;
      }
    }

    // allow other plugins to handle this message
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
