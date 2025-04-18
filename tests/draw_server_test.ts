import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { DrawServerPlugin } from "../src/plugins/draw/server.ts";
import { PLUGIN_ID } from "../src/plugins/draw/shared.ts";

// Mock ServerPluginContext
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
  
  // Initialize the plugin
  DrawServerPlugin.onInit!(context);
  
  // Check if state was initialized correctly
  const state = context.getState();
  assertEquals(Array.isArray(state.drawLines), true);
});

Deno.test("DrawServerPlugin handles history request", () => {
  const context = createMockContext();
  
  // Initialize the plugin
  DrawServerPlugin.onInit!(context);
  
  // Add some lines to state
  context.setState((state) => {
    state.drawLines = [
      { clientId: "client1", startX: 10, startY: 20, endX: 30, endY: 40, color: "#FF0000" },
      { clientId: "client2", startX: 50, startY: 60, endX: 70, endY: 80, color: "#00FF00" },
    ];
  });
  
  // Simulate history request
  DrawServerPlugin.onMessage!("test-client", {
    type: "custom",
    pluginId: PLUGIN_ID,
    data: { requestHistory: true }
  }, context);
  
  // Check if history was sent to the client
  const directMessages = context._getDirectMessages();
  const clientMessages = directMessages.get("test-client") || [];
  
  assertEquals(clientMessages.length, 1);
  assertEquals(clientMessages[0].type, "custom");
  assertEquals(clientMessages[0].pluginId, PLUGIN_ID);
  assertEquals(Array.isArray(clientMessages[0].data.lines), true);
  assertEquals(clientMessages[0].data.lines.length, 2);
});

Deno.test("DrawServerPlugin handles draw message", () => {
  const context = createMockContext();
  
  // Initialize the plugin
  DrawServerPlugin.onInit!(context);
  
  // Simulate draw message
  DrawServerPlugin.onMessage!("test-client", {
    type: "draw",
    startX: 10,
    startY: 20,
    endX: 30,
    endY: 40,
    color: "#FF0000"
  }, context);
  
  // Check if line was added to state
  const state = context.getState();
  assertEquals(state.drawLines.length, 1);
  assertEquals(state.drawLines[0].clientId, "test-client");
  assertEquals(state.drawLines[0].startX, 10);
  assertEquals(state.drawLines[0].startY, 20);
  assertEquals(state.drawLines[0].endX, 30);
  assertEquals(state.drawLines[0].endY, 40);
  assertEquals(state.drawLines[0].color, "#FF0000");
  
  // Check if broadcast was sent
  const broadcasts = context._getBroadcastMessages();
  assertEquals(broadcasts.length, 1);
  assertEquals(broadcasts[0].message.type, "draw");
  assertEquals(broadcasts[0].message.clientId, "test-client");
  assertEquals(broadcasts[0].message.startX, 10);
  assertEquals(broadcasts[0].message.startY, 20);
  assertEquals(broadcasts[0].message.endX, 30);
  assertEquals(broadcasts[0].message.endY, 40);
  assertEquals(broadcasts[0].message.color, "#FF0000");
});
