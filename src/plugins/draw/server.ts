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
      console.log(`Received draw message from ${clientId}:`, JSON.stringify(message));
      
      const state = context.getState() as any;
      const cursors = state.cursors || {};
      const cursor = cursors[clientId];
      
      if (!cursor) {
        console.log("No cursor found for client:", clientId);
        return;
      }
      
      // Initialize client draw states if needed
      if (!state.clientDrawStates) {
        context.setState(state => {
          state.clientDrawStates = {};
        });
      }
      
      const drawState = state.clientDrawStates[clientId] || { 
        isDrawing: false,
        lastX: cursor.x,
        lastY: cursor.y
      };
      
      if (message.isDrawing) {
        // Get the client's cursor color
        const color = cursor.color;
        
        // Get the client's previous position
        const prevX = drawState.isDrawing ? drawState.lastX : message.x;
        const prevY = drawState.isDrawing ? drawState.lastY : message.y;
        
        console.log(`Drawing state: isDrawing=${drawState.isDrawing}, lastX=${drawState.lastX}, lastY=${drawState.lastY}`);
        console.log(`Current position: x=${message.x}, y=${message.y}`);
        
        // Create a line even if it's the first point (to handle single clicks)
        if (drawState.isDrawing || true) {
          console.log(`Creating line from (${prevX},${prevY}) to (${message.x},${message.y})`);
          
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
          
          // Log the broadcast
          console.log(`Broadcasting line: (${prevX},${prevY}) to (${message.x},${message.y}) with color ${color}`);
        } else {
          console.log(`Starting draw or no movement: isDrawing=${drawState.isDrawing}, prevPos=(${prevX},${prevY}), newPos=(${message.x},${message.y})`);
        }
        
        // Update drawing state
        context.setState(state => {
          if (!state.clientDrawStates) {
            state.clientDrawStates = {};
          }
          state.clientDrawStates[clientId] = {
            isDrawing: true,
            lastX: message.x,
            lastY: message.y
          };
        });
        
        // Update cursor position
        context.setState((state) => {
          if (state.cursors && state.cursors[clientId]) {
            state.cursors[clientId].x = message.x;
            state.cursors[clientId].y = message.y;
          }
        });
      } else {
        console.log(`Stopping drawing for client ${clientId}`);
        console.log(`Final position: x=${message.x}, y=${message.y}`);
        // Stop drawing
        context.setState(state => {
          if (!state.clientDrawStates) {
            state.clientDrawStates = {};
          }
          state.clientDrawStates[clientId] = {
            isDrawing: false,
            lastX: message.x || cursor.x,
            lastY: message.y || cursor.y
          };
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
