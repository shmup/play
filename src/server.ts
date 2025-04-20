import { bundle } from "jsr:@deno/emit";
import type { ClientMessage } from "./types/shared.ts";
import { ChatServerPlugin } from "./plugins/chat/index.ts";
import { CursorServerPlugin } from "./plugins/cursors/index.ts";
import { DrawServerPlugin } from "./plugins/draw/index.ts";
import { CodenamesServerPlugin } from "./plugins/codenames/index.ts";
import {
  appState,
  createContext,
  plugins,
  registerPlugin,
} from "./plugins/framework/server.ts";

const result = await bundle(new URL("./client.ts", import.meta.url));
const clientScript = result.code;

registerPlugin(ChatServerPlugin);
registerPlugin(CursorServerPlugin);
registerPlugin(DrawServerPlugin);
registerPlugin(CodenamesServerPlugin);

const staticFiles = [
  ["assets/favicon.ico", "image/x-icon"],
];

Deno.serve((req) => {
  const url = new URL(req.url);

  // handle static files
  for (const [path, contentType] of staticFiles) {
    if (url.pathname === `/${path.split("/").pop()}`) {
      try {
        const fileContent = Deno.readFileSync(path);
        return new Response(fileContent, {
          headers: {
            "content-type": contentType,
          },
        });
      } catch (e) {
        console.error(`Error serving ${path}:`, e);
        return new Response(`${path} not found`, { status: 404 });
      }
    }
  }

  if (url.pathname === "/" || url.pathname === "") {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>don't blink</title>
        <link rel="icon" href="/favicon.ico" type="image/x-icon">
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

      const context = createContext();
      for (const plugin of plugins) {
        plugin.onClientConnect?.(clientId, context);
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ClientMessage;
        console.log(`From ${clientId.slice(0, 8)}:`, message);
        const context = createContext();
        for (const plugin of plugins) {
          const shouldContinue = plugin.onMessage?.(clientId, message, context);
          if (shouldContinue === false) break;
        }
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    socket.onclose = () => {
      console.log(`Client ${clientId} disconnected`);

      const context = createContext();
      for (const plugin of plugins) {
        plugin.onClientDisconnect?.(clientId, context);
      }

      appState.clients.delete(clientId);
    };

    return response;
  }

  return new Response("Not found", { status: 404 });
});
