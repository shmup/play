import { defineClientPlugin } from "../framework/client.ts";
import type { ServerMessage } from "../../types/shared.ts";
import type { PluginContext } from "../framework/client.ts";
import type { CursorState } from "../../types/shared.ts";

const CURSOR_LAYER = "cursor";
const CURSOR_SIZE = 10;

export const CursorPlugin = defineClientPlugin({
  id: "cursor",
  priority: 10,

  onInit(context: PluginContext) {
    context.setState((state) => {
      state.cursors = {};
    });

    context.canvasManager.getLayer(CURSOR_LAYER, 10);
    context.markLayerDirty(CURSOR_LAYER);

    const sendWindowDimensions = () => {
      context.sendMessage({
        type: "custom",
        pluginId: "cursor",
        data: {
          windowSize: {
            width: globalThis.innerWidth,
            height: globalThis.innerHeight,
          },
        },
      });
    };

    sendWindowDimensions();
    globalThis.addEventListener("resize", sendWindowDimensions);

    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousemove", (e) => {
        const position = { x: e.clientX, y: e.clientY };

        context.setState((state) => {
          if (context.clientId && state.cursors) {
            state.cursors[context.clientId] = {
              x: position.x,
              y: position.y,
              color: state.cursors[context.clientId]?.color || "#000000",
            };
          }
        });

        context.sendMessage({
          type: "move",
          x: position.x,
          y: position.y,
        });

        context.markLayerDirty(CURSOR_LAYER);
      });
    }

    if (document && document.body && document.body.style) {
      document.body.style.cursor = "none";
    }
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

      context.markLayerDirty(CURSOR_LAYER);
    } else if (message.type === "disconnect") {
      context.setState((state) => {
        delete state.cursors[message.clientId];
      });

      context.markLayerDirty(CURSOR_LAYER);
    }
    return true;
  },

  onBeforeRender(_context: PluginContext): string[] {
    // register our cursor layer for rendering
    return [CURSOR_LAYER];
  },

  onRenderLayer(
    layerId: string,
    ctx: CanvasRenderingContext2D,
    context: PluginContext,
  ) {
    if (layerId !== CURSOR_LAYER) return;

    const state = context.getState();
    const { cursors } = state as { cursors: Record<string, CursorState> };

    // always clear the cursor layer completely to prevent ghosting
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
});
