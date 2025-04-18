import { bundle } from "jsr:@deno/emit";
import type { ClientMessage, ServerMessage } from "./types/shared.ts";
import type {
  ClientState,
  ServerAppState,
  ServerPlugin,
  ServerPluginContext,
} from "./types/server.ts";
import { CursorServerPlugin } from "./plugins/cursors/server.ts";

const result = await bundle(new URL("./client.ts", import.meta.url));
const clientScript = result.code;

const appState: ServerAppState = {
  clients: new Map<string, ClientState>(),
  cursors: {},
};

const plugins: ServerPlugin[] = [];
registerPlugin(CursorServerPlugin);

function registerPlugin(plugin: ServerPlugin) {
  plugins.push(plugin);
  plugins.sort((a, b) => a.priority - b.priority);

  const context = createPluginContext();
  if (plugin.onInit) {
    plugin.onInit(context);
  }
}

function createPluginContext(): ServerPluginContext {
  return {
    broadcast: (message: ServerMessage, excludeClientId?: string) => {
      for (const [id, client] of appState.clients.entries()) {
        if ((!excludeClientId || id !== excludeClientId) &&
            client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify(message));
        }
      }
    },

    sendTo: (clientId: string, message: ServerMessage) => {
      const client = appState.clients.get(clientId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    },

    getState: () => ({ ...appState }),

    setState: (updater) => {
      updater(appState);
    }
  };
}

Deno.serve((req) => {
  const url = new URL(req.url);

  if (url.pathname === "/" || url.pathname === "") {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>don't blink</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            overflow: hidden;
            width: 100%;
            height: 100%;
            cursor: none;
          }
          canvas {
            display: block;
          }
        </style>
      </head>
      <body>
        <canvas id="canvas"></canvas>
        <script type="module">
          ${clientScript}
          initializeClient();
        </script>
      </body>
      </html>`,
      {
        headers: {
          "content-type": "text/html",
        },
      },
    );
  }

  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("Request must be a WebSocket upgrade", {
        status: 400,
      });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const clientId = crypto.randomUUID();

    appState.clients.set(clientId, {
      socket,
    });

    socket.onopen = () => {
      console.log(`Client ${clientId} connected`);

      const context = createPluginContext();
      for (const plugin of plugins) {
        if (plugin.onClientConnect) {
          plugin.onClientConnect(clientId, context);
        }
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ClientMessage;
        const context = createPluginContext();

        for (const plugin of plugins) {
          if (plugin.onMessage) {
            const shouldContinue = plugin.onMessage(clientId, message, context);
            if (shouldContinue === false) {
              break;
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    socket.onclose = () => {
      console.log(`Client ${clientId} disconnected`);

      const context = createPluginContext();
      for (const plugin of plugins) {
        if (plugin.onClientDisconnect) {
          plugin.onClientDisconnect(clientId, context);
        }
      }

      appState.clients.delete(clientId);
    };

    return response;
  }

  return new Response("Not found", { status: 404 });
});
