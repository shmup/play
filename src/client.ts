import type {
  ClientMessage,
  CursorState,
  ServerMessage,
} from "./types/shared.ts";
import { CursorPlugin } from "./plugins/cursors.ts";

export interface Plugin {
  id: string;
  priority: number;
  onInit?: (context: PluginContext) => void;
  onMessage?: (
    message: ServerMessage,
    context: PluginContext,
  ) => boolean | void;
  onBeforeSend?: (
    message: ClientMessage,
    context: PluginContext,
  ) => ClientMessage | false;
  onRender?: (ctx: CanvasRenderingContext2D, context: PluginContext) => void;
}

export interface PluginContext {
  clientId: string;
  sendMessage: (message: ClientMessage) => void;
  getState: () => AppState;
  setState: (updater: (state: AppState) => void) => void;
}

export interface AppState {
  cursors: Record<string, CursorState>;
  [key: string]: unknown;
}

export function initializeClient() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  let clientId = "";
  let appState: AppState = { cursors: {} };
  let reconnectAttempts = 0;
  let ws: WebSocket | null = null;

  const maxReconnectAttempts = 10;
  const reconnectDelay = 1000;

  const plugins: Plugin[] = [];

  registerPlugin(CursorPlugin);

  function registerPlugin(plugin: Plugin) {
    plugins.push(plugin);
    plugins.sort((a, b) => a.priority - b.priority);
  }

  function resizeCanvas() {
    canvas.width = globalThis.innerWidth;
    canvas.height = globalThis.innerHeight;
    render();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const context = createPluginContext();
    for (const plugin of plugins) {
      if (plugin.onRender) {
        plugin.onRender(ctx, context);
      }
    }
  }

  function createPluginContext(): PluginContext {
    return {
      clientId,
      sendMessage: (message: ClientMessage) => sendMessage(message),
      getState: () => ({ ...appState }),
      setState: (updater) => {
        const newState = { ...appState };
        updater(newState);
        appState = newState;
        render();
      },
    };
  }

  function sendMessage(message: ClientMessage) {
    let processedMessage = message;
    const context = createPluginContext();

    for (const plugin of plugins) {
      if (plugin.onBeforeSend) {
        const result = plugin.onBeforeSend(processedMessage, context);
        if (result === false) {
          return;
        } else if (result) {
          processedMessage = result;
        }
      }
    }

    // Send to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(processedMessage));
    }
  }

  function handleServerMessage(data: ServerMessage) {
    const context = createPluginContext();

    if (data.type === "init") {
      clientId = data.clientId;
    }

    for (const plugin of plugins) {
      if (plugin.onMessage) {
        const shouldContinue = plugin.onMessage(data, context);
        if (shouldContinue === false) {
          break;
        }
      }
    }

    render();
  }

  function connectWebSocket() {
    ws = new WebSocket(`ws://${globalThis.location.host}/ws`);

    ws.onopen = () => {
      console.log("Connected to server");
      reconnectAttempts = 0;

      const context = createPluginContext();
      for (const plugin of plugins) {
        if (plugin.onInit) {
          plugin.onInit(context);
        }
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as ServerMessage;
      handleServerMessage(data);
    };

    ws.onclose = (event) => {
      if (!event.wasClean) {
        console.log("Connection lost. Attempting to reconnect...");
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, reconnectDelay);
        } else {
          console.error(
            "Max reconnection attempts reached. Reload the page to try again.",
          );
        }
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connectWebSocket();
  globalThis.addEventListener("resize", resizeCanvas);
  resizeCanvas();
}
