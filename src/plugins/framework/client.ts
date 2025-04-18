import type { ClientMessage, ServerMessage } from "../../types/shared.ts";
import { CanvasManager } from "../../utils/canvas-manager.ts";

export interface PluginContext {
  clientId: string;
  sendMessage: (message: ClientMessage) => void;
  getState: () => AppState;
  setState: (updater: (state: AppState) => void) => void;
  forceRender: () => void;
  canvasManager: CanvasManager;
  markLayerDirty: (layerId: string, region?: { x: number, y: number, width: number, height: number }) => void;
}

export interface AppState {
  [key: string]: unknown;
}

export interface ClientPlugin {
  id: string;
  priority: number;
  onInit?: (context: PluginContext) => void;
  onBeforeSend?: (
    message: ClientMessage,
    context: PluginContext,
  ) => ClientMessage | false;
  onMessage?: (
    message: ServerMessage,
    context: PluginContext,
  ) => boolean | void;
  onBeforeRender?: (context: PluginContext) => string[] | void;
  onRenderLayer?: (
    layerId: string, 
    ctx: CanvasRenderingContext2D, 
    context: PluginContext
  ) => void;
  onRender?: (ctx: CanvasRenderingContext2D, context: PluginContext) => void;
}

const plugins: ClientPlugin[] = [];

export function defineClientPlugin(plugin: ClientPlugin): ClientPlugin {
  return plugin;
}

export function registerPlugin(plugin: ClientPlugin): void {
  plugins.push(plugin);
  plugins.sort((a, b) => a.priority - b.priority);
}

export function initializeClient(): void {
  // Create canvas manager instead of using a single canvas
  const canvasManager = new CanvasManager("canvas-container");
  const mainCanvas = canvasManager.getMainCanvas();

  let clientId = "";
  let appState: AppState = {};
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let renderScheduled = false;

  const maxReconnectAttempts = 10;
  const reconnectDelay = 1000;

  function createContext(): PluginContext {
    return {
      clientId,
      sendMessage: (message) => sendMessage(message),
      getState: () => ({ ...appState }),
      setState: (updater) => {
        const newState = { ...appState };
        updater(newState);
        appState = newState;
        // Schedule a render on the next animation frame for better performance
        scheduleRender();
      },
      forceRender: () => {
        render();
      },
      canvasManager,
      markLayerDirty: (layerId, region) => {
        canvasManager.markDirty(layerId, region);
        scheduleRender();
      },
    };
  }

  function scheduleRender(): void {
    if (!renderScheduled) {
      renderScheduled = true;
      requestAnimationFrame(() => {
        render();
        renderScheduled = false;
      });
    }
  }

  function render(): void {
    try {
      const context = createContext();
      
      // Get all layers that need rendering
      const layerIds = new Set<string>();
      
      // Let plugins register which layers they want to render
      for (const plugin of plugins) {
        if (plugin.onBeforeRender) {
          const pluginLayers = plugin.onBeforeRender(context) || [];
          pluginLayers.forEach(id => layerIds.add(id));
        }
      }
      
      // Add default layers
      layerIds.add('main');
      layerIds.add('ui');
      
      // Clear and render each dirty layer
      layerIds.forEach(layerId => {
        const layer = canvasManager.getLayer(layerId);
        if (layer.isDirty || layer.needsFullRedraw) {
          // Special handling for cursor layer - always clear completely
          if (layerId === 'cursor') {
            canvasManager.clearLayer(layerId);
          } else {
            canvasManager.clearDirtyRegions(layerId);
          }
          
          // Let plugins render to this specific layer
          for (const plugin of plugins) {
            plugin.onRenderLayer?.(layerId, layer.ctx, context);
          }
        }
      });
      
      // Call the legacy onRender method for backward compatibility
      // This renders to the main layer
      const mainLayer = canvasManager.getLayer('main');
      for (const plugin of plugins) {
        plugin.onRender?.(mainLayer.ctx, context);
      }
      
      // Debug rendering - only log occasionally to reduce console spam
      if (Math.random() < 0.05) {
        console.log("Rendered layers:", Array.from(layerIds));
      }
    } catch (error) {
      console.error("Render error:", error);
      // Schedule another render attempt on failure
      scheduleRender();
    }
  }

  function sendMessage(message: ClientMessage): void {
    let processed = message;
    const context = createContext();
    
    // Special handling for draw messages - bypass plugin processing
    if (message.type === "draw") {
      console.log("DIRECT SEND for draw message:", message);
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          const stringMessage = JSON.stringify(message);
          console.log("Sending raw draw message:", stringMessage);
          ws.send(stringMessage);
          return;
        } catch (error) {
          console.error("Error sending draw message:", error);
        }
      } else {
        console.warn("WebSocket not open, draw message not sent");
        return;
      }
    }
    
    // Normal processing for non-draw messages
    for (const plugin of plugins) {
      if (plugin.onBeforeSend) {
        const result = plugin.onBeforeSend(processed, context);
        if (result === false) {
          return;
        }
        processed = result;
      }
    }
    
    if (ws?.readyState === WebSocket.OPEN) {
      // Log outgoing messages for debugging (except frequent cursor moves)
      if (message.type !== "move") {
        console.log("Sending message:", message.type, message);
      }
      
      // Make sure we're actually sending the message
      try {
        ws.send(JSON.stringify(processed));
      } catch (error) {
        console.error("Error sending message:", error);
      }
    } else {
      console.warn("WebSocket not open, message not sent:", message.type);
    }
  }

  function handleServerMessage(message: ServerMessage): void {
    const context = createContext();
    if (message.type === "init") {
      clientId = message.clientId;
    }
    
    // Log incoming messages for debugging (except frequent cursor updates)
    if (message.type !== "update") {
      console.log("Received message:", message.type, message);
    }
    
    for (const plugin of plugins) {
      if (plugin.onMessage) {
        const shouldContinue = plugin.onMessage(message, context);
        if (shouldContinue === false) {
          break;
        }
      }
    }
    // Ensure render happens after all message processing
    // Use both immediate and delayed renders to ensure content appears
    render();
    requestAnimationFrame(() => render());
  }

  function connect(): void {
    ws = new WebSocket(`ws://${globalThis.location.host}/ws`);
    // Expose WebSocket for debugging
    (window as any).debugSocket = ws;
    
    ws.onopen = () => {
      reconnectAttempts = 0;
      const context = createContext();
      for (const plugin of plugins) {
        plugin.onInit?.(context);
      }
      // Force multiple renders after connection is established
      // to ensure everything is properly displayed
      render();
      setTimeout(() => render(), 100);
      setTimeout(() => render(), 500);
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as ServerMessage;
      handleServerMessage(data);
    };
    ws.onclose = (event) => {
      if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connect, reconnectDelay);
      }
    };
    ws.onerror = () => {
      ws?.close();
    };
  }

  globalThis.addEventListener("resize", () => {
    canvasManager.resize();
    scheduleRender();
  });

  connect();
  render();
}
