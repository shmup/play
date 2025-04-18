import { PluginContext } from "../framework/client.ts";
import { ClientMessage } from "../../types/shared.ts";

/**
 * Creates and attaches debug UI elements for the draw plugin
 */
export function setupDebugUI(
  context: PluginContext,
  canvas: HTMLCanvasElement,
): {
  debugOverlay: HTMLDivElement;
  updateDebugOverlay: (x: number, y: number, isDrawing: boolean) => void;
} {
  // Create debug button
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
    const testMessage: ClientMessage = {
      type: "draw",
      x: 100,
      y: 100,
      isDrawing: true,
    };
    context.sendMessage(testMessage);

    const socket = (globalThis as any).debugSocket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("Sending direct test draw message");
      socket.send(JSON.stringify(testMessage));
    }
  };
  document.body.appendChild(debugButton);

  // Create debug overlay
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

  // Create draw toggle button
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
      context.setState((state) => {
        state.isDrawing = false;

        if (
          (state as any).pendingLines &&
          (state as any).pendingLines.length > 0
        ) {
          (state as any).drawLines = [
            ...((state as any).drawLines || []),
            ...((state as any).pendingLines || []),
          ];

          (state as any).pendingLines = [];
        }
      });

      debugOverlay.textContent =
        `Mouse: ${state.lastX},${state.lastY} | Drawing: false`;
      drawToggleButton.textContent = "Start Drawing";
      drawToggleButton.style.backgroundColor = "#2196F3";
    } else {
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
    context.markLayerDirty("draw-active");
    context.markLayerDirty("draw-static");
  };
  document.body.appendChild(drawToggleButton);

  // Helper function to update debug overlay
  const updateDebugOverlay = (x: number, y: number, isDrawing: boolean) => {
    debugOverlay.textContent = `Mouse: ${x},${y} | Drawing: ${isDrawing}`;
  };

  return { debugOverlay, updateDebugOverlay };
}

/**
 * Sends a draw message directly via WebSocket or through context
 */
export function sendDrawMessage(
  context: PluginContext,
  x: number,
  y: number,
  isDrawing: boolean,
  messageType: string = "draw",
): void {
  console.log(`Sending ${messageType} message:`, x, y, isDrawing);

  const drawMessage: ClientMessage = {
    type: "draw",
    x,
    y,
    isDrawing,
  };

  // Try direct WebSocket first for better performance
  const socket = (globalThis as any).debugSocket;
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("Sending direct draw message:", JSON.stringify(drawMessage));
    socket.send(JSON.stringify(drawMessage));
  } else {
    // Fallback to normal send
    console.log(
      "Sending draw message via context:",
      JSON.stringify(drawMessage),
    );
    context.sendMessage(drawMessage);
  }
}

/**
 * Adds debug event listeners to canvas
 */
export function setupDebugEventListeners(canvas: HTMLCanvasElement): void {
  canvas.addEventListener("click", (e) => {
    console.log("CANVAS CLICK EVENT", e.clientX, e.clientY);
  });
}
