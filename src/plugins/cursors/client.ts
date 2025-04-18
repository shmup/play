import { defineClientPlugin } from "../framework/client.ts";
import type { ClientMessage, ServerMessage } from "../../types/shared.ts";
import type { AppState, PluginContext } from "../framework/client.ts";
import type { CursorState } from "../../types/shared.ts";
import { DirtyRegion } from "../../utils/canvas-manager.ts";

// Constants
const CURSOR_LAYER = 'cursor';
const CURSOR_SIZE = 10;
const LABEL_PADDING = 5;
const LABEL_HEIGHT = 20;

export const CursorPlugin = defineClientPlugin({
  id: "cursor",
  priority: 10,

  onInit(context: PluginContext) {
    context.setState((state) => {
      state.cursors = {};
    });
    
    // Initialize cursor layer with high z-index
    context.canvasManager.getLayer(CURSOR_LAYER, 10);

    // Send window dimensions to server for proper cursor centering
    const sendWindowDimensions = () => {
      context.sendMessage({
        type: "custom",
        pluginId: "cursor",
        data: {
          windowSize: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      });
    };

    // Send dimensions on init
    sendWindowDimensions();

    // Also send dimensions when window is resized
    window.addEventListener("resize", sendWindowDimensions);

    document.addEventListener("mousemove", (e) => {
      const position = { x: e.clientX, y: e.clientY };
      const state = context.getState() as any;
      
      // Update local cursor position
      context.setState((state) => {
        if (context.clientId && state.cursors) {
          state.cursors[context.clientId] = {
            x: position.x,
            y: position.y,
            color: state.cursors[context.clientId]?.color || "#000000",
          };
        }
      });

      // Only send move message if not currently drawing
      if (!state.isDrawing) {
        context.sendMessage({
          type: "move",
          x: position.x,
          y: position.y,
        });
      }
      
      // Mark cursor layer as dirty
      context.markLayerDirty(CURSOR_LAYER);
    });

    document.body.style.cursor = "none";
  },

  onMessage(message: ServerMessage, context: PluginContext) {
    if (message.type === "init") {
      context.setState((state) => {
        state.cursors = message.cursors;
      });
      context.markLayerDirty(CURSOR_LAYER);
    } else if (message.type === "update") {
      context.setState((state) => {
        state.cursors[message.clientId] = {
          x: message.x,
          y: message.y,
          color: message.color,
        };
      });
      
      // Mark cursor layer as dirty
      context.markLayerDirty(CURSOR_LAYER);
    } else if (message.type === "disconnect") {
      context.setState((state) => {
        delete state.cursors[message.clientId];
      });
      
      // Mark cursor layer as dirty
      context.markLayerDirty(CURSOR_LAYER);
    }
    return true;
  },

  onBeforeRender(context: PluginContext): string[] {
    // Register our cursor layer for rendering
    return [CURSOR_LAYER];
  },
  
  onRenderLayer(layerId: string, ctx: CanvasRenderingContext2D, context: PluginContext) {
    if (layerId !== CURSOR_LAYER) return;
    
    const state = context.getState();
    const { cursors } = state as { cursors: Record<string, CursorState> };

    // Always clear the cursor layer completely to prevent ghosting
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const id in cursors) {
      const cursor = cursors[id];
      
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, CURSOR_SIZE, 0, 2 * Math.PI);
      ctx.fillStyle = cursor.color;
      ctx.fill();

      if (id === context.clientId) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.font = "12px Arial";
      ctx.fillStyle = "black";
      ctx.fillText(id.slice(0, 6), cursor.x + 15, cursor.y + 5);
    }
  },
  
  // Keep legacy onRender for backward compatibility
  onRender(ctx: CanvasRenderingContext2D, context: PluginContext) {
    // This is now a no-op as we use the layered rendering
  },
});
