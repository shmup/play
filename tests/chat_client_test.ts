import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { ChatPlugin } from "../src/plugins/chat/client.ts";
import { PLUGIN_ID } from "../src/plugins/chat/shared.ts";

// Mock PluginContext
const createMockContext = () => {
  const state: any = {};
  const messages: any[] = [];
  
  return {
    clientId: "test-client-id",
    sendMessage: (message: any) => {
      messages.push(message);
      return message;
    },
    getState: () => ({ ...state }),
    setState: (updater: (state: any) => void) => {
      updater(state);
    },
    forceRender: () => {},
    canvasManager: {
      getLayer: () => ({
        canvas: document.createElement("canvas"),
        ctx: document.createElement("canvas").getContext("2d"),
      }),
      markDirty: () => {},
    },
    markLayerDirty: () => {},
    _getMessages: () => messages,
    _resetMessages: () => {
      messages.length = 0;
    },
  };
};

// Create a mock document for testing
const mockDocument = () => {
  (globalThis as any).document = {
    createElement: () => {
      return {
        style: {},
        appendChild: () => {},
        addEventListener: () => {},
        getContext: () => ({
          clearRect: () => {},
          fillStyle: "",
          fillRect: () => {},
          font: "",
          fillText: () => {},
          measureText: () => ({ width: 100 }),
        }),
      };
    },
    body: {
      appendChild: () => {},
    },
  };
};

Deno.test("ChatPlugin initialization", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  ChatPlugin.onInit!(context);
  
  // Check if state was initialized correctly
  const state = context.getState();
  assertEquals(Array.isArray(state.chat), true);
  assertEquals(state.chat.length, 0);
});

Deno.test("ChatPlugin handles chat messages", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  ChatPlugin.onInit!(context);
  
  // Simulate receiving a chat message
  ChatPlugin.onMessage!({
    type: "custom",
    pluginId: PLUGIN_ID,
    data: {
      clientId: "other-client",
      text: "Hello world",
    },
  }, context);
  
  // Check if the message was added to the state
  const state = context.getState();
  assertEquals(state.chat.length, 1);
  assertEquals(state.chat[0].clientId, "other-client");
  assertEquals(state.chat[0].text, "Hello world");
});

Deno.test("ChatPlugin requests history on init", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  ChatPlugin.onInit!(context);
  
  // Simulate receiving init message
  ChatPlugin.onMessage!({
    type: "init",
    clientId: "test-client-id",
    cursors: {},
  }, context);
  
  // Check if history request was sent
  const messages = context._getMessages();
  assertEquals(messages.length, 1);
  assertEquals(messages[0].type, "custom");
  assertEquals(messages[0].pluginId, PLUGIN_ID);
  assertEquals(messages[0].data.requestHistory, true);
});
