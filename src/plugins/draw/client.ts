import { defineClientPlugin } from "../framework/client.ts";
import { ClientMessage, DrawLine, ServerMessage } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import { PluginContext } from "../../types/plugin.ts";

let historyRequested = false;

export const DrawPlugin = defineClientPlugin({
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: PluginContext) {
    context.setState((state) => {
      state.drawLines = [];
      state.isDrawing = false;
      state.lastX = 0;
      state.lastY = 0;
    });

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    
    // Mouse down event - start drawing
    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      context.setState((state) => {
        state.isDrawing = true;
        state.lastX = x;
        state.lastY = y;
      });
      
      // Send initial draw position
      context.sendMessage({
        type: "draw",
        x,
        y,
        isDrawing: true
      });
    });
    
    // Mouse move event - continue drawing if mouse is down
    canvas.addEventListener("mousemove", (e) => {
      const state = context.getState() as any;
      if (!state.isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Send draw update
      context.sendMessage({
        type: "draw",
        x,
        y,
        isDrawing: true
      });
      
      context.setState((state) => {
        state.lastX = x;
        state.lastY = y;
      });
    });
    
    // Mouse up and mouse leave events - stop drawing
    const stopDrawing = () => {
      context.setState((state) => {
        state.isDrawing = false;
      });
      
      // Send stop drawing message
      context.sendMessage({
        type: "draw",
        x: 0,
        y: 0,
        isDrawing: false
      });
    };
    
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);
  },

  onMessage(message: ServerMessage, context: PluginContext) {
    // On initial server init, request drawing history
    if (message.type === "init" && !historyRequested) {
      context.sendMessage({
        type: "custom",
        pluginId: PLUGIN_ID,
        data: { requestHistory: true },
      });
      historyRequested = true;
      
      // If server sent lines with init message
      if (message.lines) {
        context.setState((state) => {
          (state as any).drawLines = message.lines;
        });
      }
    }
    
    // Handle draw updates from other clients
    if (message.type === "drawUpdate") {
      const line: DrawLine = {
        clientId: message.clientId,
        startX: message.prevX,
        startY: message.prevY,
        endX: message.x,
        endY: message.y,
        color: message.color
      };
      
      context.setState((state) => {
        (state as any).drawLines = [...((state as any).drawLines || []), line];
      });
      
      context.forceRender();
    }
    
    // Handle custom messages with drawing history
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as any;
      if (data.lines) {
        context.setState((state) => {
          (state as any).drawLines = data.lines;
        });
        context.forceRender();
      }
    }
  },

  onRender(ctx: CanvasRenderingContext2D, context: PluginContext) {
    const state = context.getState() as any;
    const lines = state.drawLines as DrawLine[] | undefined;
    
    if (!lines || lines.length === 0) {
      return;
    }
    
    // Draw all lines
    for (const line of lines) {
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }
});
