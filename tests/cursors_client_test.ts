import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { CursorPlugin } from "../src/plugins/cursors/client.ts";
import { CURSOR_LAYER } from "../src/plugins/cursors/shared.ts";

// Mock PluginContext
const createMockContext = () => {
  const state: any = {};
  const messages: any[] = [];
  const dirtyLayers: string[] = [];
  
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
      getDimensions: () => ({ width: 800, height: 600 }),
    },
    markLayerDirty: (layerId: string) => {
      dirtyLayers.push(layerId);
    },
    _getMessages: () => messages,
    _resetMessages: () => {
      messages.length = 0;
    },
    _getDirtyLayers: () => dirtyLayers,
  };
};

// Create a mock document for testing
const mockDocument = () => {
  (globalThis as any).document = {
    createElement: () => {
      return {
        style: {},
        width: 800,
        height: 600,
        appendChild: () => {},
        addEventListener: () => {},
        getContext: () => ({
          clearRect: () => {},
          fillStyle: "",
          fillRect: () => {},
          font: "",
          fillText: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          arc: () => {},
          fill: () => {},
        }),
      };
    },
    body: {
      appendChild: () => {},
    },
  };
  
  (globalThis as any).window = {
    addEventListener: () => {},
    innerWidth: 800,
    innerHeight: 600,
  };
};

Deno.test("CursorPlugin initialization", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  CursorPlugin.onInit!(context);
  
  // Check if state was initialized correctly
  const state = context.getState();
  assertEquals(typeof state.cursors, "object");
  
  // Check if cursor layer was marked dirty
  const dirtyLayers = context._getDirtyLayers();
  assertEquals(dirtyLayers.includes(CURSOR_LAYER), true);
});

Deno.test("CursorPlugin handles cursor updates", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  CursorPlugin.onInit!(context);
  
  // Simulate receiving a cursor update
  CursorPlugin.onMessage!({
    type: "update",
    clientId: "other-client",
    x: 100,
    y: 200,
    color: "#FF0000",
  }, context);
  
  // Check if the cursor was updated in state
  const state = context.getState();
  assertEquals(state.cursors["other-client"].x, 100);
  assertEquals(state.cursors["other-client"].y, 200);
  assertEquals(state.cursors["other-client"].color, "#FF0000");
  
  // Check if cursor layer was marked dirty
  const dirtyLayers = context._getDirtyLayers();
  assertEquals(dirtyLayers.includes(CURSOR_LAYER), true);
});

Deno.test("CursorPlugin handles init message", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  CursorPlugin.onInit!(context);
  
  // Simulate receiving init message with cursors
  CursorPlugin.onMessage!({
    type: "init",
    clientId: "test-client-id",
    cursors: {
      "client1": { x: 100, y: 200, color: "#FF0000" },
      "client2": { x: 300, y: 400, color: "#00FF00" },
    },
  }, context);
  
  // Check if cursors were set in state
  const state = context.getState();
  assertEquals(state.cursors["client1"].x, 100);
  assertEquals(state.cursors["client1"].y, 200);
  assertEquals(state.cursors["client1"].color, "#FF0000");
  assertEquals(state.cursors["client2"].x, 300);
  assertEquals(state.cursors["client2"].y, 400);
  assertEquals(state.cursors["client2"].color, "#00FF00");
});

Deno.test("CursorPlugin registers layer for rendering", () => {
  mockDocument();
  const context = createMockContext();
  
  // Initialize the plugin
  CursorPlugin.onInit!(context);
  
  // Call onBeforeRender
  const layers = CursorPlugin.onBeforeRender!(context);
  
  // Check if cursor layer is registered
  assertEquals(layers.includes(CURSOR_LAYER), true);
});
