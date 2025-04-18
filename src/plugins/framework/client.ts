import type { ClientMessage, ServerMessage } from "../../types/shared.ts";

export interface PluginContext {
  clientId: string;
  sendMessage: (message: ClientMessage) => void;
  getState: () => AppState;
  setState: (updater: (state: AppState) => void) => void;
  forceRender: () => void;
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
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  let clientId = "";
  let appState: AppState = {};
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;

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
        requestAnimationFrame(() => render());
      },
      forceRender: () => {
        render();
      },
    };
  }

  function render(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const context = createContext();
    for (const plugin of plugins) {
      plugin.onRender?.(ctx, context);
    }
  }

  function sendMessage(message: ClientMessage): void {
    let processed = message;
    const context = createContext();
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
      ws.send(JSON.stringify(processed));
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
    // Ensure render happens after all message processing
    requestAnimationFrame(() => render());
  }

  function connect(): void {
    ws = new WebSocket(`ws://${globalThis.location.host}/ws`);
    ws.onopen = () => {
      reconnectAttempts = 0;
      const context = createContext();
      for (const plugin of plugins) {
        plugin.onInit?.(context);
      }
      // Force an initial render after connection is established
      render();
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
    canvas.width = globalThis.innerWidth;
    canvas.height = globalThis.innerHeight;
    render();
  });

  canvas.width = globalThis.innerWidth;
  canvas.height = globalThis.innerHeight;

  connect();
  render();
}
