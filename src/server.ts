import { bundle } from "jsr:@deno/emit";
import type { ClientMessage, ServerMessage } from "./types/shared.ts";
import type {
  ClientMessage,
  CursorState,
  ServerMessage,
} from "./types/shared.ts";

const result = await bundle(new URL("./client.ts", import.meta.url));
const clientScript = result.code;

const clients = new Map<string, {
  socket: WebSocket;
  x: number;
  y: number;
  color: string;
}>();

function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function broadcastToOthers(senderId: string, message: ServerMessage) {
  for (const [id, client] of clients.entries()) {
    if (id !== senderId && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }
}

function getClientsState(): Record<string, CursorState> {
  const state: Record<string, CursorState> = {};
  for (const [id, client] of clients.entries()) {
    state[id] = {
      x: client.x,
      y: client.y,
      color: client.color,
    };
  }
  return state;
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
    const clientColor = getRandomColor();

    clients.set(clientId, {
      socket,
      x: 0,
      y: 0,
      color: clientColor,
    });

    socket.onopen = () => {
      console.log(`Client ${clientId} connected`);

      const initMessage: ServerMessage = {
        type: "init",
        clientId,
        cursors: getClientsState(),
      };
      socket.send(JSON.stringify(initMessage));

      const updateMessage: ServerMessage = {
        type: "update",
        clientId,
        x: 0,
        y: 0,
        color: clientColor,
      };
      broadcastToOthers(clientId, updateMessage);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ClientMessage;

        if (data.type === "move") {
          const client = clients.get(clientId);
          if (client) {
            client.x = data.x;
            client.y = data.y;
          }

          const updateMessage: ServerMessage = {
            type: "update",
            clientId,
            x: data.x,
            y: data.y,
            color: clientColor,
          };
          broadcastToOthers(clientId, updateMessage);
        }
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    socket.onclose = () => {
      console.log(`Client ${clientId} disconnected`);
      clients.delete(clientId);

      const disconnectMessage: ServerMessage = {
        type: "disconnect",
        clientId,
      };
      broadcastToOthers(clientId, disconnectMessage);
    };

    return response;
  }

  return new Response("Not found", { status: 404 });
});
