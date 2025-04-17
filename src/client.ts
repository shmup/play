import type { ClientMessage, CursorState, ServerMessage } from "./shared.ts";

export function initializeClient() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const ctx = canvas.getContext("2d")!;
  let cursors: Record<string, CursorState> = {};
  let clientId = "";

  function resizeCanvas() {
    canvas.width = globalThis.innerWidth;
    canvas.height = globalThis.innerHeight;
    renderCursors();
  }

  function renderCursors() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const id in cursors) {
      const cursor = cursors[id];
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = cursor.color;
      ctx.fill();

      if (id === clientId) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.font = "12px Arial";
      ctx.fillStyle = "black";
      ctx.fillText(id.slice(0, 6), cursor.x + 15, cursor.y + 5);
    }
  }

  const ws = new WebSocket(`ws://${globalThis.location.host}/ws`);

  ws.onopen = () => {
    console.log("Connected to server");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data) as ServerMessage;

    if (data.type === "init") {
      clientId = data.clientId;
      cursors = data.cursors;
      renderCursors();
    } else if (data.type === "update") {
      cursors[data.clientId] = {
        x: data.x,
        y: data.y,
        color: data.color,
      };
      renderCursors();
    } else if (data.type === "disconnect") {
      delete cursors[data.clientId];
      renderCursors();
    }
  };

  let myPosition = { x: 0, y: 0 };

  document.addEventListener("mousemove", (e) => {
    myPosition = { x: e.clientX, y: e.clientY };

    if (clientId) {
      cursors[clientId] = {
        x: myPosition.x,
        y: myPosition.y,
        color: cursors[clientId]?.color || "#000000",
      };
      renderCursors();
    }

    if (ws.readyState === WebSocket.OPEN) {
      const message: ClientMessage = {
        type: "move",
        x: e.clientX,
        y: e.clientY,
      };
      ws.send(JSON.stringify(message));
    }
  });

  globalThis.addEventListener("resize", resizeCanvas);
  resizeCanvas();
}
