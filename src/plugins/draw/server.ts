import { ServerPlugin, ServerPluginContext } from "../../types/server.ts";
import { ClientMessage, DrawLine, ServerMessage } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";

export const DrawServerPlugin: ServerPlugin = {
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: ServerPluginContext) {
    context.setState((state) => {
      (state as any).drawLines = [];
    });
  },

  onClientConnect(clientId: string, context: ServerPluginContext) {
    // When a client connects, we'll send them the current drawing state
    // This happens via the custom message request in the client
  },

  onClientDisconnect(clientId: string, context: ServerPluginContext) {
    // We don't need to do anything special when a client disconnects
    // Their drawings remain for others to see
  },

  onMessage(
    clientId: string,
    message: ClientMessage,
    context: ServerPluginContext,
  ) {
    // Handle draw messages
    if (message.type === "draw") {
      const state = context.getState() as any;
      const cursors = state.cursors || {};
      const cursor = cursors[clientId];
      
      if (!cursor) return;
      
      if (message.isDrawing) {
        // Get the client's cursor color
        const color = cursor.color;
        
        // Get the client's previous position
        const prevX = cursor.x;
        const prevY = cursor.y;
        
        // Create a new line
        const line: DrawLine = {
          clientId,
          startX: prevX,
          startY: prevY,
          endX: message.x,
          endY: message.y,
          color
        };
        
        // Add the line to the state
        context.setState((state) => {
          if (!(state as any).drawLines) {
            (state as any).drawLines = [];
          }
          (state as any).drawLines.push(line);
        });
        
        // Broadcast the line to all clients
        context.broadcast({
          type: "drawUpdate",
          clientId,
          x: message.x,
          y: message.y,
          prevX,
          prevY,
          color
        });
        
        // Update cursor position
        context.setState((state) => {
          if (state.cursors && state.cursors[clientId]) {
            state.cursors[clientId].x = message.x;
            state.cursors[clientId].y = message.y;
          }
        });
      }
    }
    
    // Handle custom messages
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as any;
      
      // Client is requesting drawing history
      if (data.requestHistory) {
        const state = context.getState() as any;
        const lines = (state.drawLines || []) as DrawLine[];
        
        // Send the drawing history to the client
        context.sendTo(clientId, {
          type: "custom",
          pluginId: PLUGIN_ID,
          data: {
            lines
          }
        });
      }
    }
  }
};
