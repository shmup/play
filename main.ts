type BroadcastMessage = {
  type: "init" | "update" | "disconnect";
  clientId: string;
  x?: number;
  y?: number;
  color?: string;
};

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

function broadcastToOthers(senderId: string, message: BroadcastMessage) {
  for (const [id, client] of clients.entries()) {
    if (id !== senderId && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }
}

function getClientsState() {
  const state: Record<string, { x: number; y: number; color: string }> = {};
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
        <title>Multiplayer Canvas</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            overflow: hidden;
            width: 100%;
            height: 100%;
          }
          canvas {
            display: block;
          }
        </style>
      </head>
      <body>
        <canvas id="canvas"></canvas>
        <script>
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          let cursors = {};
          let clientId = '';

          // Resize canvas to fill the window
          function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            renderCursors();
          }

          // Render all cursors
          function renderCursors() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const id in cursors) {
              const cursor = cursors[id];
              ctx.beginPath();
              ctx.arc(cursor.x, cursor.y, 10, 0, 2 * Math.PI);
              ctx.fillStyle = cursor.color;
              ctx.fill();

              // Add a ring or indicator for the user's own cursor
              if (id === clientId) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.stroke();
              }

              ctx.font = '12px Arial';
              ctx.fillStyle = 'black';
              ctx.fillText(id.slice(0, 6), cursor.x + 15, cursor.y + 5);
            }
          }

          // Set up WebSocket connection
          const ws = new WebSocket(\`ws://\${window.location.host}/ws\`);

          ws.onopen = () => {
            console.log('Connected to server');
          };

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'init') {
              clientId = data.clientId;
              cursors = data.cursors;
              renderCursors();
            } else if (data.type === 'update') {
              cursors[data.clientId] = {
                x: data.x,
                y: data.y,
                color: data.color
              };
              renderCursors();
            } else if (data.type === 'disconnect') {
              delete cursors[data.clientId];
              renderCursors();
            }
          };

          // Track mouse movement
          document.addEventListener('mousemove', (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'move',
                x: e.clientX,
                y: e.clientY
              }));
            }
          });

          // Add after ws.onmessage handler:
          let myPosition = { x: 0, y: 0 };

          document.addEventListener('mousemove', (e) => {
            myPosition = { x: e.clientX, y: e.clientY };

            // Update own cursor locally for immediate feedback
            if (clientId) {
              cursors[clientId] = {
                x: myPosition.x,
                y: myPosition.y,
                color: cursors[clientId]?.color || '#000000'
              };
              renderCursors();
            }

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'move',
                x: e.clientX,
                y: e.clientY
              }));
            }
          });

          // Handle window resize
          window.addEventListener('resize', resizeCanvas);
          resizeCanvas();
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

      socket.send(JSON.stringify({
        type: "init",
        clientId,
        cursors: getClientsState(),
      }));

      broadcastToOthers(clientId, {
        type: "update",
        clientId,
        x: 0,
        y: 0,
        color: clientColor,
      });
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "move") {
          const client = clients.get(clientId);
          if (client) {
            client.x = data.x;
            client.y = data.y;
          }

          broadcastToOthers(clientId, {
            type: "update",
            clientId,
            x: data.x,
            y: data.y,
            color: clientColor,
          });
        }
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    socket.onclose = () => {
      console.log(`Client ${clientId} disconnected`);
      clients.delete(clientId);

      broadcastToOthers(clientId, {
        type: "disconnect",
        clientId,
      });
    };

    return response;
  }

  return new Response("Not found", { status: 404 });
});

console.log("Server running at http://localhost:8000");
