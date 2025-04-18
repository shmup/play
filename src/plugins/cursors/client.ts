import { defineClientPlugin } from "../framework/client.ts";
import type { ClientMessage, ServerMessage } from "../../types/shared.ts";
import type { AppState, PluginContext } from "../framework/client.ts";
import type { CursorState } from "../../types/shared.ts";

export const CursorPlugin = defineClientPlugin({
  id: "cursor",
  priority: 10,

  onInit(context: PluginContext) {
    context.setState((state) => {
      state.cursors = {};
    });

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
    });

    document.body.style.cursor = "none";
  },

  onMessage(message: ServerMessage, context: PluginContext) {
    if (message.type === "init") {
      context.setState((state) => {
        state.cursors = message.cursors;
      });
    } else if (message.type === "update") {
      context.setState((state) => {
        state.cursors[message.clientId] = {
          x: message.x,
          y: message.y,
          color: message.color,
        };
      });
    } else if (message.type === "disconnect") {
      context.setState((state) => {
        delete state.cursors[message.clientId];
      });
    }
    return true;
  },

  onRender(ctx: CanvasRenderingContext2D, context: PluginContext) {
    const state = context.getState();
    const { cursors } = state as { cursors: Record<string, CursorState> };

    for (const id in cursors) {
      const cursor = cursors[id];
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 10, 0, 2 * Math.PI);
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
