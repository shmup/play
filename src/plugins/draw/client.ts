import { defineClientPlugin } from "../framework/client.ts";
import { DrawLine, ServerMessage, CursorState } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import type { PluginContext } from "../framework/client.ts";
import type { DirtyRegion, CanvasLayer } from "../../utils/canvas-manager.ts";
import {
  sendDrawMessage,
  setupDebugEventListeners,
  setupDebugUI,
} from "./debug-utils.ts";

type DrawClientState = {
  drawLines?: DrawLine[];
  pendingLines?: DrawLine[];
  isDrawing: boolean;
  lastX: number;
  lastY: number;
  cursors?: Record<string, CursorState>;
};

import type { DrawServerMessageData } from "./shared.ts";

let historyRequested = false;

const LINE_WIDTH = 3;
const PADDING = LINE_WIDTH * 2; // Padding for dirty regions

const STATIC_LAYER = "draw-static";
const ACTIVE_LAYER = "draw-active";

export const DrawPlugin = defineClientPlugin({
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: PluginContext) {
    console.log("Draw plugin initialized");

    context.setState((state) => {
      state.drawLines = [];
      state.isDrawing = false;
      state.lastX = 0;
      state.lastY = 0;
      state.pendingLines = [];
    });

    context.canvasManager.getLayer(STATIC_LAYER, 1);
    context.canvasManager.getLayer(ACTIVE_LAYER, 2);

    // use main interaction canvas (fallback to getlayer if getmaincanvas not available)
    let canvas: HTMLCanvasElement;
    if (typeof context.canvasManager.getMainCanvas === "function") {
      canvas = context.canvasManager.getMainCanvas();
    } else {
      // fallback: get default 'main' layer canvas
      const mainLayer = context.canvasManager.getLayer("main") as CanvasLayer;
      canvas = mainLayer.canvas;
    }

    // Setup debug UI and get the debug overlay reference
    const { debugOverlay, updateDebugOverlay } = setupDebugUI(context, canvas);

    // Setup debug event listeners
    setupDebugEventListeners(canvas);

    // Add mousemove listener to update debug overlay
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        const state = context.getState() as unknown as DrawClientState;
        updateDebugOverlay(x, y, state.isDrawing);
      });
    }

    // mouse down event - start drawing (if supported)
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousedown", (e) => {
        console.log("RAW MOUSEDOWN EVENT", e.button, e.clientX, e.clientY);

        // only handle left mouse button (button === 0)
        if (e.button !== 0) return;

        // check if the click is within the canvas
        const rect = canvas.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          return;
        }

        // check if we clicked on ui elements
        const target = e.target as HTMLElement;
        if (
          target.tagName === "BUTTON" || target.tagName === "INPUT" ||
          target.tagName === "DIV"
        ) {
          // let the event propagate for ui elements
          return;
        }

        e.preventDefault(); // Prevent default to ensure we capture the event
        e.stopPropagation(); // Stop propagation to prevent other handlers

        // we already have rect from the check above
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        console.log("MOUSEDOWN EVENT CAPTURED", x, y);

        // get current cursor color
        const state = context.getState() as unknown as DrawClientState;
        const color = state.cursors?.[context.clientId]?.color || "#000000";

        context.setState((state) => {
          const s = state as unknown as DrawClientState;
          s.isDrawing = true;
          s.lastX = x;
          s.lastY = y;
        });

        // update debug overlay immediately
        debugOverlay.textContent = `Mouse: ${x},${y} | Drawing: true`;

        // create a dot for immediate visual feedback
        const dot: DrawLine = {
          clientId: context.clientId,
          startX: x,
          startY: y,
          endX: x + 0.1, // Tiny offset to ensure it renders
          endY: y + 0.1,
          color,
        };

        context.setState((state) => {
          const s = state as unknown as DrawClientState;
          s.pendingLines = [...(s.pendingLines || []), dot];
        });

        // mark the active layer as dirty
        context.markLayerDirty(ACTIVE_LAYER, {
          x: x - PADDING,
          y: y - PADDING,
          width: PADDING * 2,
          height: PADDING * 2,
        });

        // send initial draw position
        sendDrawMessage(context, x, y, true, "mousedown");

        // Force a redraw of the active layer
        context.markLayerDirty(ACTIVE_LAYER);

        console.log("Drawing started at", x, y);
      });
    }

    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousemove", (e) => {
        const state = context.getState() as unknown as DrawClientState;
        if (!state.isDrawing) return;

        console.log("RAW MOUSEMOVE EVENT - isDrawing:", state.isDrawing);

        const rect = canvas.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Skip if position hasn't changed significantly
        if (Math.abs(x - state.lastX) < 1 && Math.abs(y - state.lastY) < 1) {
          return;
        }

        // Calculate dirty region for this line segment
        const dirtyRegion: DirtyRegion = {
          x: Math.min(state.lastX, x) - PADDING,
          y: Math.min(state.lastY, y) - PADDING,
          width: Math.abs(x - state.lastX) + PADDING * 2,
          height: Math.abs(y - state.lastY) + PADDING * 2,
        };

        // Create a line for local rendering
        const line: DrawLine = {
          clientId: context.clientId,
          startX: state.lastX,
          startY: state.lastY,
          endX: x,
          endY: y,
          color: state.cursors?.[context.clientId]?.color || "#000000",
        };

        // Add to pending lines
        context.setState((state) => {
          const s = state as unknown as DrawClientState;
          s.pendingLines = [...(s.pendingLines || []), line];
          s.lastX = x;
          s.lastY = y;
        });

        // Mark the active layer as dirty in this region
        context.markLayerDirty(ACTIVE_LAYER, dirtyRegion);

        // Send draw update - this is critical!
        console.log("MOUSEMOVE - Sending draw message:", x, y);

        // Draw the line locally immediately for responsive feedback
        const ctx = context.canvasManager.getLayer(ACTIVE_LAYER).ctx;
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = state.cursors?.[context.clientId]?.color || "#000000";
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = "round";
        ctx.stroke();

        console.log(
          `Drew line from (${state.lastX},${state.lastY}) to (${x},${y})`,
        );

        // Send draw message
        sendDrawMessage(context, x, y, true, "mousemove");
      });
    }

    // Mouse up and mouse leave events - stop drawing
    const stopDrawing = (e: MouseEvent) => {
      const state = context.getState() as unknown as DrawClientState;
      if (!state.isDrawing) return;

      // Check if we're interacting with UI elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" || target.tagName === "INPUT" ||
        target.tagName === "DIV"
      ) {
        // Don't prevent default for UI elements
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      console.log("STOP DRAWING EVENT CAPTURED");

      context.setState((state) => {
        const s = state as unknown as DrawClientState;
        s.isDrawing = false;
        // Update debug overlay immediately
        updateDebugOverlay(s.lastX, s.lastY, false);
        // Commit pending lines to static layer
        if (s.pendingLines && s.pendingLines.length > 0) {
          // Add pending lines to permanent lines
          s.drawLines = [...(s.drawLines || []), ...(s.pendingLines || [])];
          // Mark static layer as dirty
          context.markLayerDirty(STATIC_LAYER);
          // Clear active layer since we're committing to static
          context.markLayerDirty(ACTIVE_LAYER);
          // Clear pending lines after commit
          s.pendingLines = [];
          console.log("Drawing ended, committed lines to static layer");
        }
      });

      // Send stop drawing message
      sendDrawMessage(context, state.lastX, state.lastY, false, "mouseup");
    };

    // Stop drawing on mouse up or leave if supported
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mouseup", stopDrawing);
      document.addEventListener("mouseleave", stopDrawing);
    }

    // Debug event listeners are now handled by setupDebugEventListeners
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
          const s = state as unknown as DrawClientState;
          s.drawLines = message.lines;
        });
        // Mark static layer as dirty to redraw all lines
        context.markLayerDirty(STATIC_LAYER);
      }
    }

    // Handle draw updates from other clients
    if (message.type === "drawUpdate") {
      console.log("Received drawUpdate:", JSON.stringify(message));

      const line: DrawLine = {
        clientId: message.clientId,
        startX: message.prevX,
        startY: message.prevY,
        endX: message.x,
        endY: message.y,
        color: message.color,
      };

      console.log(
        `Drawing line from (${line.startX},${line.startY}) to (${line.endX},${line.endY}) with color ${line.color}`,
      );

      // Calculate dirty region for this line
      const dirtyRegion: DirtyRegion = {
        x: Math.min(line.startX, line.endX) - PADDING,
        y: Math.min(line.startY, line.endY) - PADDING,
        width: Math.abs(line.endX - line.startX) + PADDING * 2,
        height: Math.abs(line.endY - line.startY) + PADDING * 2,
      };

      context.setState((state) => {
        const s = state as unknown as DrawClientState;
        s.drawLines = [...(s.drawLines || []), line];
        // Add to pending lines that will be drawn on active layer
        s.pendingLines = [...(s.pendingLines || []), line];
      });

      // Mark only the affected region as dirty
      context.markLayerDirty(ACTIVE_LAYER, dirtyRegion);

      // Also mark the static layer as dirty to ensure lines are properly rendered
      context.markLayerDirty(STATIC_LAYER, dirtyRegion);
    }

    // Handle custom messages with drawing history or draw actions
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as DrawServerMessageData & {
        action?: "drawUpdate";
        clientId?: string;
        x?: number;
        y?: number;
        prevX?: number;
        prevY?: number;
        color?: string;
      };

      // Handle history response
      if (data.lines) {
        context.setState((state) => {
          const s = state as unknown as DrawClientState;
          s.drawLines = data.lines;
        });
        // Mark static layer as dirty to redraw all lines
        context.markLayerDirty(STATIC_LAYER);
      }

      // Handle draw updates that come through custom messages
      if (data.action === "drawUpdate") {
        console.log("Received custom drawUpdate:", data);

        const line: DrawLine = {
          clientId: data.clientId!,
          startX: data.prevX!,
          startY: data.prevY!,
          endX: data.x!,
          endY: data.y!,
          color: data.color!,
        };

        // Calculate dirty region for this line
        const dirtyRegion: DirtyRegion = {
          x: Math.min(line.startX, line.endX) - PADDING,
          y: Math.min(line.startY, line.endY) - PADDING,
          width: Math.abs(line.endX - line.startX) + PADDING * 2,
          height: Math.abs(line.endY - line.startY) + PADDING * 2,
        };

        context.setState((state) => {
          const s = state as unknown as DrawClientState;
          s.drawLines = [...(s.drawLines || []), line];
          // Add to pending lines that will be drawn on active layer
          s.pendingLines = [...(s.pendingLines || []), line];
        });

        // Mark only the affected region as dirty
        context.markLayerDirty(ACTIVE_LAYER, dirtyRegion);

        // Also mark the static layer as dirty to ensure lines are properly rendered
        context.markLayerDirty(STATIC_LAYER, dirtyRegion);
      }
    }
  },

  onBeforeRender(_context: PluginContext): string[] {
    // Register our layers for rendering
    return [STATIC_LAYER, ACTIVE_LAYER];
  },

  onRenderLayer(
    layerId: string,
    ctx: CanvasRenderingContext2D,
    context: PluginContext,
  ) {
    const state = context.getState() as unknown as DrawClientState;

    if (layerId === STATIC_LAYER) {
      // Draw all permanent lines on the static layer
      const lines = state.drawLines as DrawLine[] | undefined;

      if (!lines || lines.length === 0) {
        return;
      }

      console.log(`Rendering ${lines.length} lines on static layer`);

      // Draw all lines
      for (const line of lines) {
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        ctx.lineTo(line.endX, line.endY);
        ctx.strokeStyle = line.color || "#000000";
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    } else if (layerId === ACTIVE_LAYER) {
      // Draw only pending lines (active drawing) on the active layer
      const pendingLines = (state.pendingLines || []) as DrawLine[];

      if (pendingLines.length === 0) {
        return;
      }

      console.log(
        `Rendering ${pendingLines.length} pending lines on active layer`,
      );

      // Draw pending lines
      for (const line of pendingLines) {
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        ctx.lineTo(line.endX, line.endY);
        ctx.strokeStyle = line.color || "#000000";
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }
  },
});
