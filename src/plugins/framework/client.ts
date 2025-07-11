import type { ClientMessage, ServerMessage } from "../../types/shared.ts";
import { CanvasManager } from "../../utils/canvas-manager.ts";
import type { DirtyRegion } from "../../utils/canvas-manager.ts";

export interface PluginCanvasLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
}

export interface PluginCanvasManager {
  getLayer(layerId: string, zIndex?: number): PluginCanvasLayer;
  markDirty(layerId: string, region?: DirtyRegion): void;
  getMainCanvas?(): HTMLCanvasElement;
  getDimensions?(): { width: number; height: number };
  getViewport?(): { x: number; y: number; width: number; height: number };
  updateScrollFromCursor?(x: number, y: number): boolean;
  screenToWorld?(x: number, y: number): { x: number; y: number };
  worldToScreen?(x: number, y: number): { x: number; y: number };
  resetViewport?(): void;
}

export interface PluginContext {
  clientId: string;
  sendMessage: (message: ClientMessage) => void;
  getState: () => AppState;
  setState: (updater: (state: AppState) => void) => void;
  forceRender: () => void;
  canvasManager: PluginCanvasManager;
  markLayerDirty: (layerId: string, region?: DirtyRegion) => void;
}

export interface AppState {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
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
  // Called before rendering; plugins must return an array of layer IDs to render
  onBeforeRender?: (context: PluginContext) => string[];
  onRenderLayer?: (
    layerId: string,
    ctx: CanvasRenderingContext2D,
    context: PluginContext,
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
  const canvasManager = new CanvasManager("canvas-container");

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

      const layerIds = new Set<string>();

      for (const plugin of plugins) {
        if (plugin.onBeforeRender) {
          const pluginLayers = plugin.onBeforeRender(context) || [];
          pluginLayers.forEach((id) => layerIds.add(id));
        }
      }

      layerIds.add("main");
      layerIds.add("ui");

      // clear and render each dirty layer
      layerIds.forEach((layerId) => {
        const layer = canvasManager.getLayer(layerId);
        if (layer.isDirty || layer.needsFullRedraw) {
          if (layerId === "cursor") {
            canvasManager.clearLayer(layerId);
          } else {
            canvasManager.clearDirtyRegions(layerId);
          }

          const ctx = layer.ctx;
          ctx.save();

          if (layerId !== "ui" && layerId !== "cursor") {
            const viewport = canvasManager.getViewport?.() || { x: 0, y: 0 };
            ctx.translate(-viewport.x, -viewport.y);
          }

          for (const plugin of plugins) {
            plugin.onRenderLayer?.(layerId, ctx, context);
          }

          ctx.restore();
        }
      });

      // call the legacy onrender method for backward compatibility
      // this renders to the main layer
      const mainLayer = canvasManager.getLayer("main");
      for (const plugin of plugins) {
        plugin.onRender?.(mainLayer.ctx, context);
      }
    } catch (error) {
      console.error("Render error:", error);
      scheduleRender();
    }
  }

  function sendMessage(message: ClientMessage): void {
    let processed = message;
    const context = createContext();

    // Special handling for draw messages - bypass plugin processing
    if (message.type === "draw") {
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          const stringMessage = JSON.stringify(message);
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

    // proces non-drawing messages
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

    for (const plugin of plugins) {
      if (plugin.onMessage) {
        const shouldContinue = plugin.onMessage(message, context);
        if (shouldContinue === false) {
          break;
        }
      }
    }
    // ensure render happens after all message processing
    // use both immediate and delayed renders to ensure content appears
    render();
    requestAnimationFrame(() => render());
  }

  function connect(): void {
    ws = new WebSocket(`ws://${globalThis.location.host}/ws`);
    // expose websocket for debugging
    (globalThis as { debugSocket?: WebSocket }).debugSocket = ws;

    ws.onopen = () => {
      reconnectAttempts = 0;
      const context = createContext();
      for (const plugin of plugins) {
        plugin.onInit?.(context);
      }
      // force multiple renders after connection is established
      // to ensure everything is properly displayed
      render();
      setTimeout(() => render(), 100);
      setTimeout(() => render(), 500);

      globalThis.addEventListener("keydown", (event) => {
        if (event.code === "Space" && !event.repeat) {
          event.preventDefault();
          canvasManager.resetViewport?.();
          scheduleRender();
        }
      });
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
