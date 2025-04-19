import { assertEquals } from "@std/assert";
import { CursorServerPlugin } from "../src/plugins/cursors/server.ts";

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

Deno.test("CursorServerPlugin initialization", () => {
  const context = createMockContext();

  // Initialize the plugin
  CursorServerPlugin.onInit!(context);

  // Check if state was initialized correctly
  const state = context.getState();
  assertEquals(typeof state.cursors, "object");
});

Deno.test("CursorServerPlugin handles client connect", () => {
  const context = createMockContext();

  // Initialize the plugin
  CursorServerPlugin.onInit!(context);

  // Simulate client connection
  CursorServerPlugin.onClientConnect!("test-client", context);

  // Check if client cursor was added to state
  const state = context.getState();
  assertEquals(typeof state.cursors["test-client"], "object");
  assertEquals(typeof state.cursors["test-client"].color, "string");
  assertEquals(state.cursors["test-client"].color.startsWith("#"), true);

  // Check if broadcast was sent (cursor update to others)
  const broadcasts = context._getBroadcastMessages();
  assertEquals(broadcasts.length, 1);
  // Plugin broadcasts an 'update' event on connect
  assertEquals(broadcasts[0].message.type, "update");
  assertEquals(broadcasts[0].message.clientId, "test-client");
});

Deno.test("CursorServerPlugin handles client disconnect", () => {
  const context = createMockContext();

  // Initialize the plugin
  CursorServerPlugin.onInit!(context);

  // Add a client cursor to state
  context.setState((state) => {
    state.cursors = {
      "test-client": { x: 100, y: 200, color: "#FF0000" },
    };
  });

  // Simulate client disconnection
  CursorServerPlugin.onClientDisconnect!("test-client", context);

  // Check if client cursor was removed from state
  const state = context.getState();
  assertEquals(state.cursors["test-client"], undefined);

  // Check if broadcast was sent
  const broadcasts = context._getBroadcastMessages();
  assertEquals(broadcasts.length, 1);
  assertEquals(broadcasts[0].message.type, "disconnect");
  assertEquals(broadcasts[0].message.clientId, "test-client");
});

Deno.test("CursorServerPlugin handles cursor move message", () => {
  const context = createMockContext();

  // Initialize the plugin
  CursorServerPlugin.onInit!(context);

  // Add a client cursor to state
  context.setState((state) => {
    state.cursors = {
      "test-client": { x: 0, y: 0, color: "#FF0000" },
    };
  });

  // Simulate cursor move message
  CursorServerPlugin.onMessage!("test-client", {
    type: "move",
    x: 100,
    y: 200,
  }, context);

  // Check if cursor position was updated
  const state = context.getState();
  assertEquals(state.cursors["test-client"].x, 100);
  assertEquals(state.cursors["test-client"].y, 200);

  // Check if broadcast was sent
  const broadcasts = context._getBroadcastMessages();
  assertEquals(broadcasts.length, 1);
  assertEquals(broadcasts[0].message.type, "update");
  assertEquals(broadcasts[0].message.clientId, "test-client");
  assertEquals(broadcasts[0].message.x, 100);
  assertEquals(broadcasts[0].message.y, 200);
});
