import { defineClientPlugin } from "../framework/client.ts";
import { ClientMessage, DrawLine, ServerMessage } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import type { PluginContext } from "../framework/client.ts";
import { DirtyRegion } from "../../utils/canvas-manager.ts";

let historyRequested = false;

// Constants for drawing
const LINE_WIDTH = 3;
const PADDING = LINE_WIDTH * 2; // Padding for dirty regions

// Static canvas for persistent drawings
const STATIC_LAYER = "draw-static";
// Dynamic canvas for active drawing
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
      state.pendingLines = []; // Lines waiting to be committed to static layer
    });

    // Add a debug button to force a draw message
    const debugButton = document.createElement("button");
    debugButton.textContent = "Test Draw";
    debugButton.style.position = "fixed";
    debugButton.style.bottom = "10px";
    debugButton.style.right = "10px";
    debugButton.style.zIndex = "1000";
    debugButton.style.padding = "8px 12px";
    debugButton.style.backgroundColor = "#4CAF50";
    debugButton.style.color = "white";
    debugButton.style.border = "none";
    debugButton.style.borderRadius = "4px";
    debugButton.style.cursor = "pointer";
    debugButton.onclick = () => {
      console.log("Sending test draw message");
      // Prepare a test draw message
      const testMessage: ClientMessage = {
        type: "draw",
        x: 100,
        y: 100,
        isDrawing: true,
      };
      context.sendMessage(testMessage);

      // Also try direct WebSocket send
      const socket = (globalThis as any).debugSocket;
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("Sending direct test draw message");
        socket.send(JSON.stringify(testMessage));
      }
    };
    document.body.appendChild(debugButton);

    // Add a debug overlay to show mouse coordinates and drawing state
    const debugOverlay = document.createElement("div");
    debugOverlay.style.position = "fixed";
    debugOverlay.style.top = "10px";
    debugOverlay.style.right = "10px";
    debugOverlay.style.backgroundColor = "rgba(0,0,0,0.7)";
    debugOverlay.style.color = "white";
    debugOverlay.style.padding = "10px";
    debugOverlay.style.borderRadius = "5px";
    debugOverlay.style.zIndex = "1000";
    debugOverlay.style.fontFamily = "monospace";
    debugOverlay.style.fontSize = "12px";
    debugOverlay.textContent = "Mouse: 0,0 | Drawing: false";
    document.body.appendChild(debugOverlay);

    // Add a manual draw toggle button
    const drawToggleButton = document.createElement("button");
    drawToggleButton.textContent = "Toggle Drawing";
    drawToggleButton.style.position = "fixed";
    drawToggleButton.style.bottom = "10px";
    drawToggleButton.style.right = "100px";
    drawToggleButton.style.zIndex = "1000";
    drawToggleButton.style.padding = "8px 12px";
    drawToggleButton.style.backgroundColor = "#2196F3";
    drawToggleButton.style.color = "white";
    drawToggleButton.style.border = "none";
    drawToggleButton.style.borderRadius = "4px";
    drawToggleButton.style.cursor = "pointer";
    drawToggleButton.onclick = () => {
      const state = context.getState() as any;
      const isCurrentlyDrawing = state.isDrawing;

      if (isCurrentlyDrawing) {
        // Stop drawing
        context.setState((state) => {
          state.isDrawing = false;

          // Commit pending lines to static layer
          if (
            (state as any).pendingLines &&
            (state as any).pendingLines.length > 0
          ) {
            // Add pending lines to permanent lines
            (state as any).drawLines = [
              ...((state as any).drawLines || []),
              ...((state as any).pendingLines || []),
            ];

            // Clear pending lines after commit
            (state as any).pendingLines = [];
          }
        });

        debugOverlay.textContent =
          `Mouse: ${state.lastX},${state.lastY} | Drawing: false`;
        drawToggleButton.textContent = "Start Drawing";
        drawToggleButton.style.backgroundColor = "#2196F3";
      } else {
        // Start drawing
        const rect = canvas.getBoundingClientRect();
        const x = Math.round(rect.width / 2);
        const y = Math.round(rect.height / 2);

        context.setState((state) => {
          state.isDrawing = true;
          state.lastX = x;
          state.lastY = y;
        });

        debugOverlay.textContent = `Mouse: ${x},${y} | Drawing: true`;
        drawToggleButton.textContent = "Stop Drawing";
        drawToggleButton.style.backgroundColor = "#F44336";
      }

      // Force redraw
      context.markLayerDirty(ACTIVE_LAYER);
      context.markLayerDirty(STATIC_LAYER);
    };
    document.body.appendChild(drawToggleButton);

    // Update debug overlay on mouse move
    // Update debug overlay on mouse move if supported
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        const state = context.getState() as any;
        debugOverlay.textContent =
          `Mouse: ${x},${y} | Drawing: ${state.isDrawing}`;
      });
    }

    // Initialize our layers
    context.canvasManager.getLayer(STATIC_LAYER, 1);
    context.canvasManager.getLayer(ACTIVE_LAYER, 2);

    // Use main interaction canvas (fallback to getLayer if getMainCanvas not available)
    let canvas: HTMLCanvasElement;
    if (typeof context.canvasManager.getMainCanvas === "function") {
      canvas = context.canvasManager.getMainCanvas();
    } else {
      // Fallback: get default 'main' layer canvas
      const mainLayer = context.canvasManager.getLayer("main");
      canvas = (mainLayer && (mainLayer as any).canvas) as HTMLCanvasElement;
    }

    // Mouse down event - start drawing (if supported)
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousedown", (e) => {
        console.log("RAW MOUSEDOWN EVENT", e.button, e.clientX, e.clientY);

        // Only handle left mouse button (button === 0)
        if (e.button !== 0) return;

        // Check if the click is within the canvas
        const rect = canvas.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          return;
        }

        // Check if we clicked on UI elements
        const target = e.target as HTMLElement;
        if (
          target.tagName === "BUTTON" || target.tagName === "INPUT" ||
          target.tagName === "DIV"
        ) {
          // Let the event propagate for UI elements
          return;
        }

        e.preventDefault(); // Prevent default to ensure we capture the event
        e.stopPropagation(); // Stop propagation to prevent other handlers

        // We already have rect from the check above
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        console.log("MOUSEDOWN EVENT CAPTURED", x, y);

        // Get current cursor color
        const state = context.getState() as any;
        const color = state.cursors?.[context.clientId]?.color || "#000000";

        context.setState((state) => {
          state.isDrawing = true;
          state.lastX = x;
          state.lastY = y;
        });

        // Update debug overlay immediately
        debugOverlay.textContent = `Mouse: ${x},${y} | Drawing: true`;

        // Create a dot for immediate visual feedback
        const dot: DrawLine = {
          clientId: context.clientId,
          startX: x,
          startY: y,
          endX: x + 0.1, // Tiny offset to ensure it renders
          endY: y + 0.1,
          color,
        };

        context.setState((state) => {
          (state as any).pendingLines = [
            ...((state as any).pendingLines || []),
            dot,
          ];
        });

        // Mark the active layer as dirty
        context.markLayerDirty(ACTIVE_LAYER, {
          x: x - PADDING,
          y: y - PADDING,
          width: PADDING * 2,
          height: PADDING * 2,
        });

        // Send initial draw position using draw message type
        console.log("MOUSEDOWN - Sending draw message:", x, y);

        // Use a direct WebSocket message to bypass any potential plugin filtering
        const socket = (globalThis as any).debugSocket;
        if (socket && socket.readyState === WebSocket.OPEN) {
          const initialDrawMessage: ClientMessage = {
            type: "draw",
            x,
            y,
            isDrawing: true,
          };
          console.log(
            "Sending direct draw message:",
            JSON.stringify(initialDrawMessage),
          );
          socket.send(JSON.stringify(initialDrawMessage));
          console.log("Direct draw message sent successfully");
        } else {
          // Fallback to normal send
          const initialDrawMessage: ClientMessage = {
            type: "draw",
            x,
            y,
            isDrawing: true,
          };
          console.log(
            "Sending initial draw message:",
            JSON.stringify(initialDrawMessage),
          );
          context.sendMessage(initialDrawMessage);
        }

        // Force a redraw of the active layer
        context.markLayerDirty(ACTIVE_LAYER);

        console.log("Drawing started at", x, y);
      });
    }

    // Mouse move event - continue drawing if mouse is down
    // Mouse move event - continue drawing if mouse is down (if supported)
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mousemove", (e) => {
        const state = context.getState() as any;
        if (!state.isDrawing) return;

        console.log("RAW MOUSEMOVE EVENT - isDrawing:", state.isDrawing);

        // Check if the mouse is within the canvas
        const rect = canvas.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          return;
        }

        e.preventDefault(); // Prevent default to ensure we capture the event
        e.stopPropagation(); // Stop propagation to prevent cursor plugin from handling

        console.log("MOUSEMOVE EVENT CAPTURED - isDrawing:", state.isDrawing);

        // Use the rect variable that's already defined above
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
          (state as any).pendingLines = [
            ...((state as any).pendingLines || []),
            line,
          ];
          state.lastX = x;
          state.lastY = y;
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

        // Send through WebSocket or context
        const socket = (globalThis as any).debugSocket;
        if (socket && socket.readyState === WebSocket.OPEN) {
          const drawMessage: ClientMessage = {
            type: "draw",
            x,
            y,
            isDrawing: true,
          };
          console.log(
            "Sending direct draw message:",
            JSON.stringify(drawMessage),
          );
          socket.send(JSON.stringify(drawMessage));
        } else {
          // Fallback to normal send
          const drawMessage: ClientMessage = {
            type: "draw",
            x,
            y,
            isDrawing: true,
          };
          console.log("Sending draw message:", JSON.stringify(drawMessage));
          context.sendMessage(drawMessage);
        }
      });
    }

    // Mouse up and mouse leave events - stop drawing
    const stopDrawing = (e: MouseEvent) => {
      const state = context.getState() as any;
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
        state.isDrawing = false;

        // Update debug overlay immediately
        debugOverlay.textContent =
          `Mouse: ${state.lastX},${state.lastY} | Drawing: false`;

        // Commit pending lines to static layer
        if (
          (state as any).pendingLines && (state as any).pendingLines.length > 0
        ) {
          // Add pending lines to permanent lines
          (state as any).drawLines = [
            ...((state as any).drawLines || []),
            ...((state as any).pendingLines || []),
          ];

          // Mark static layer as dirty
          context.markLayerDirty(STATIC_LAYER);

          // Clear active layer since we're committing to static
          context.markLayerDirty(ACTIVE_LAYER);

          // Clear pending lines after commit
          (state as any).pendingLines = [];

          console.log("Drawing ended, committed lines to static layer");
        }
      });

      // Send stop drawing message
      console.log("MOUSEUP - Sending draw stop message");

      // Use a direct WebSocket message to bypass any potential plugin filtering
      const socket = (globalThis as any).debugSocket;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const stopDrawMessage: ClientMessage = {
          type: "draw",
          x: state.lastX, // Use the last position instead of 0,0
          y: state.lastY,
          isDrawing: false,
        };
        console.log(
          "Sending direct draw message:",
          JSON.stringify(stopDrawMessage),
        );
        socket.send(JSON.stringify(stopDrawMessage));
      } else {
        // Fallback to normal send
        const stopDrawMessage: ClientMessage = {
          type: "draw",
          x: state.lastX, // Use the last position instead of 0,0
          y: state.lastY,
          isDrawing: false,
        };
        console.log(
          "Sending stop draw message:",
          JSON.stringify(stopDrawMessage),
        );
        context.sendMessage(stopDrawMessage);
      }
    };

    // Stop drawing on mouse up or leave if supported
    if (typeof document.addEventListener === "function") {
      document.addEventListener("mouseup", stopDrawing);
      document.addEventListener("mouseleave", stopDrawing);
    }

    // Debug mouse events
    canvas.addEventListener("click", (e) => {
      console.log("CANVAS CLICK EVENT", e.clientX, e.clientY);
    });
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
        (state as any).drawLines = [...((state as any).drawLines || []), line];
        // Add to pending lines that will be drawn on active layer
        (state as any).pendingLines = [
          ...((state as any).pendingLines || []),
          line,
        ];
      });

      // Mark only the affected region as dirty
      context.markLayerDirty(ACTIVE_LAYER, dirtyRegion);

      // Also mark the static layer as dirty to ensure lines are properly rendered
      context.markLayerDirty(STATIC_LAYER, dirtyRegion);
    }

    // Handle custom messages with drawing history or draw actions
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as any;

      // Handle history response
      if (data.lines) {
        context.setState((state) => {
          (state as any).drawLines = data.lines;
        });
        // Mark static layer as dirty to redraw all lines
        context.markLayerDirty(STATIC_LAYER);
      }

      // Handle draw updates that come through custom messages
      if (data.action === "drawUpdate") {
        console.log("Received custom drawUpdate:", data);

        const line: DrawLine = {
          clientId: data.clientId,
          startX: data.prevX,
          startY: data.prevY,
          endX: data.x,
          endY: data.y,
          color: data.color,
        };

        // Calculate dirty region for this line
        const dirtyRegion: DirtyRegion = {
          x: Math.min(line.startX, line.endX) - PADDING,
          y: Math.min(line.startY, line.endY) - PADDING,
          width: Math.abs(line.endX - line.startX) + PADDING * 2,
          height: Math.abs(line.endY - line.startY) + PADDING * 2,
        };

        context.setState((state) => {
          (state as any).drawLines = [
            ...((state as any).drawLines || []),
            line,
          ];
          // Add to pending lines that will be drawn on active layer
          (state as any).pendingLines = [
            ...((state as any).pendingLines || []),
            line,
          ];
        });

        // Mark only the affected region as dirty
        context.markLayerDirty(ACTIVE_LAYER, dirtyRegion);

        // Also mark the static layer as dirty to ensure lines are properly rendered
        context.markLayerDirty(STATIC_LAYER, dirtyRegion);
      }
    }
  },

  onBeforeRender(context: PluginContext): string[] {
    // Register our layers for rendering
    return [STATIC_LAYER, ACTIVE_LAYER];
  },

  onRenderLayer(
    layerId: string,
    ctx: CanvasRenderingContext2D,
    context: PluginContext,
  ) {
    const state = context.getState() as any;

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

  // Keep legacy onRender for backward compatibility
  onRender(ctx: CanvasRenderingContext2D, context: PluginContext) {
    // This is now a no-op as we use the layered rendering
  },
});
