import { assertEquals } from "@std/assert";
import { DrawServerPlugin } from "../src/plugins/draw/server.ts";
import { PLUGIN_ID } from "../src/plugins/draw/shared.ts";

const createMockContext = () => {
  const state: any = {};
  const broadcastMessages: any[] = [];
  const directMessages: Map<string, any[]> = new Map();

  return {
    broadcast: (message: any, excludeClientId?: string) => {
      broadcastMessages.push({ message, excludeClientId });
    },
    sendTo: (clientId: string, message: any) => {
      if (!directMessages.has(clientId)) {
        directMessages.set(clientId, []);
      }
      directMessages.get(clientId)!.push(message);
    },
    getState: () => ({ ...state }),
    setState: (updater: (state: any) => void) => {
      updater(state);
    },
    _getBroadcastMessages: () => broadcastMessages,
    _getDirectMessages: () => directMessages,
    _resetMessages: () => {
      broadcastMessages.length = 0;
      directMessages.clear();
    },
  };
};

Deno.test("DrawServerPlugin initialization", () => {
  const context = createMockContext();

  DrawServerPlugin.onInit!(context);

  const state = context.getState();
  assertEquals(Array.isArray(state.drawLines), true);
});

Deno.test("DrawServerPlugin handles history request", () => {
  const context = createMockContext();

  DrawServerPlugin.onInit!(context);

  context.setState((state) => {
    state.drawLines = [
      {
        clientId: "client1",
        startX: 10,
        startY: 20,
        endX: 30,
        endY: 40,
        color: "#FF0000",
      },
      {
        clientId: "client2",
        startX: 50,
        startY: 60,
        endX: 70,
        endY: 80,
        color: "#00FF00",
      },
    ];
  });

  DrawServerPlugin.onMessage!("test-client", {
    type: "custom",
    pluginId: PLUGIN_ID,
    data: { requestHistory: true },
  }, context);

  const directMessages = context._getDirectMessages();
  const clientMessages = directMessages.get("test-client") || [];

  assertEquals(clientMessages.length, 1);
  assertEquals(clientMessages[0].type, "custom");
  assertEquals(clientMessages[0].pluginId, PLUGIN_ID);
  assertEquals(Array.isArray(clientMessages[0].data.lines), true);
  assertEquals(clientMessages[0].data.lines.length, 2);
});

Deno.test("DrawServerPlugin handles draw message sequence", () => {
  const context = createMockContext();
  DrawServerPlugin.onInit!(context);

  DrawServerPlugin.onMessage!("test-client", {
    type: "draw",
    x: 10,
    y: 20,
    isDrawing: true,
  }, context);
  DrawServerPlugin.onMessage!("test-client", {
    type: "draw",
    x: 30,
    y: 40,
    isDrawing: true,
  }, context);

  const state = context.getState();
  assertEquals(Array.isArray(state.drawLines), true);

  const segment = state.drawLines[1];
  assertEquals(segment.clientId, "test-client");
  assertEquals(segment.startX, 10);
  assertEquals(segment.startY, 20);
  assertEquals(segment.endX, 30);
  assertEquals(segment.endY, 40);
  assertEquals(segment.color, "#FF0000");

  const broadcasts = context._getBroadcastMessages();
  assertEquals(broadcasts.length, 2);
  const update = broadcasts[1].message;
  assertEquals(update.type, "drawUpdate");
  assertEquals(update.clientId, "test-client");
  assertEquals(update.x, 30);
  assertEquals(update.y, 40);
  assertEquals(update.prevX, 10);
  assertEquals(update.prevY, 20);
  assertEquals(update.color, "#FF0000");
});
