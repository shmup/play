import { PluginContext } from "../framework/client.ts";
import type { ClientMessage } from "../../types/shared.ts";

/**
 * Creates and attaches debug UI elements for the draw plugin
 */
export function setupDebugUI(): {
  debugOverlay: HTMLDivElement;
  updateDebugOverlay: (x: number, y: number, isDrawing: boolean) => void;
} {
  // Skip debug UI in non-browser or test environments
  if (
    typeof document === "undefined" ||
    typeof document.querySelectorAll !== "function" ||
    typeof document.createElement !== "function" ||
    typeof document.body?.appendChild !== "function"
  ) {
    return {
      debugOverlay: {} as HTMLDivElement,
      updateDebugOverlay: (_x: number, _y: number, _isDrawing: boolean) => {},
    };
  }
  // remove existing overlays
  const existingOverlays = document.querySelectorAll(
    'div[data-debug-overlay="draw"]',
  );
  existingOverlays.forEach((overlay) => overlay.remove());

  const debugOverlay = document.createElement("div");
  debugOverlay.setAttribute("data-debug-overlay", "draw"); // Add identifier attribute
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
): void {
  const drawMessage: ClientMessage = {
    type: "draw",
    x,
    y,
    isDrawing,
  };

  // Try direct WebSocket first for better performance
  const socket =
    (globalThis as unknown as { debugSocket?: WebSocket }).debugSocket;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(drawMessage));
  } else {
    context.sendMessage(drawMessage);
  }
}

/**
 * Adds debug event listeners to canvas
 */
export function setupDebugEventListeners(_canvas: HTMLCanvasElement): void {}
