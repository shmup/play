import { ServerPlugin, ServerPluginContext } from "../../types/server.ts";
import { ClientMessage, DrawLine } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import type { DrawClientMessageData } from "./shared.ts";
import type { CursorState } from "../../types/shared.ts";

// Define our server plugin state shape
type DrawServerState = {
  drawLines?: DrawLine[];
  clientDrawStates?: Record<
    string,
    { isDrawing: boolean; lastX: number; lastY: number }
  >;
  cursors?: Record<string, CursorState>;
};

export const DrawServerPlugin: ServerPlugin = {
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: ServerPluginContext) {
    context.setState((state) => {
      const s = state as unknown as DrawServerState;
      s.drawLines = [];
    });
  },

  onMessage(
    clientId: string,
    message: ClientMessage,
    context: ServerPluginContext,
  ) {
    if (message.type === "draw") {
      console.log(`From ${clientId.slice(0, 8)}:`, message);

      const appState = context.getState() as unknown as DrawServerState;
      const cursors = appState.cursors || {};

      let cursor = cursors[clientId];
      if (!cursor) {
        console.log(
          `From ${clientId.substring(0, 8)}: No cursor found, using default`,
        );
        cursor = {
          x: message.x || 0,
          y: message.y || 0,
          color: "#FF0000",
        };
      }

      // Initialize client draw states if needed
      let clientDrawStates = appState.clientDrawStates;
      if (!clientDrawStates) {
        context.setState((s) => {
          s.clientDrawStates = {};
        });
        clientDrawStates = {};
      }
      // Retrieve or default the draw state for this client
      const drawState = clientDrawStates[clientId] || {
        isDrawing: false,
        lastX: cursor.x,
        lastY: cursor.y,
      };

      if (message.isDrawing) {
        // Get the client's cursor color
        const color = cursor.color;

        // Get the client's previous position
        const prevX = drawState.isDrawing ? drawState.lastX : message.x;
        const prevY = drawState.isDrawing ? drawState.lastY : message.y;

        // Create a line even if it's the first point (to handle single clicks)
        {
          // Create a new line
          const line: DrawLine = {
            clientId,
            startX: prevX,
            startY: prevY,
            endX: message.x,
            endY: message.y,
            color,
          };

          // Add the line to the state
          context.setState((state) => {
            const s = state as unknown as DrawServerState;
            if (!s.drawLines) {
              s.drawLines = [];
            }
            s.drawLines.push(line);
          });

          // Broadcast the line to all clients
          context.broadcast({
            type: "drawUpdate",
            clientId,
            x: message.x,
            y: message.y,
            prevX,
            prevY,
            color,
          });
        }

        // Update drawing state
        context.setState((state) => {
          const s = state as unknown as DrawServerState;
          if (!s.clientDrawStates) {
            s.clientDrawStates = {};
          }
          s.clientDrawStates[clientId] = {
            isDrawing: true,
            lastX: message.x,
            lastY: message.y,
          };
        });

        // Update cursor position
        context.setState((state) => {
          const s = state as unknown as DrawServerState;
          if (s.cursors && s.cursors[clientId]) {
            s.cursors[clientId].x = message.x;
            s.cursors[clientId].y = message.y;
          }
        });
      } else {
        // Stop drawing
        context.setState((state) => {
          const s = state as unknown as DrawServerState;
          if (!s.clientDrawStates) {
            s.clientDrawStates = {};
          }
          s.clientDrawStates[clientId] = {
            isDrawing: false,
            lastX: message.x || cursor.x,
            lastY: message.y || cursor.y,
          };
        });
      }
    }

    // Handle custom messages
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as DrawClientMessageData;

      // Client is requesting drawing history
      if (data.requestHistory) {
        const serverState = context.getState() as unknown as DrawServerState;
        const lines = serverState.drawLines ?? [];

        // Send the drawing history to the client
        context.sendTo(clientId, {
          type: "custom",
          pluginId: PLUGIN_ID,
          data: {
            lines,
          },
        });
      }
    }
  },
};
