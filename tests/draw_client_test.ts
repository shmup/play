import { assertEquals } from "@std/assert";
import { DrawPlugin } from "../src/plugins/draw/client.ts";
import {
  ACTIVE_LAYER,
  PLUGIN_ID,
  STATIC_LAYER,
} from "../src/plugins/draw/shared.ts";

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
          strokeStyle: "",
          lineWidth: 1,
        }),
      };
    },
    body: {
      appendChild: () => {},
    },
  };

  (globalThis as any).globalThis = {
    addEventListener: () => {},
    innerWidth: 800,
    innerHeight: 600,
  };
};

Deno.test("DrawPlugin initialization", () => {
  mockDocument();
  const context = createMockContext();

  DrawPlugin.onInit!(context);

  const state = context.getState();
  assertEquals(Array.isArray(state.drawLines), true);
  assertEquals(state.isDrawing, false);
  assertEquals(state.lastX, 0);
  assertEquals(state.lastY, 0);
  assertEquals(Array.isArray(state.pendingLines), true);
});

Deno.test("DrawPlugin requests history on init", () => {
  mockDocument();
  const context = createMockContext();

  DrawPlugin.onInit!(context);

  DrawPlugin.onMessage!({
    type: "init",
    clientId: "test-client-id",
    cursors: {},
  }, context);

  const messages = context._getMessages();
  assertEquals(messages.length, 1);
  assertEquals(messages[0].type, "custom");
  assertEquals(messages[0].pluginId, PLUGIN_ID);
  assertEquals(messages[0].data.requestHistory, true);
});

Deno.test("DrawPlugin handles draw history", () => {
  mockDocument();
  const context = createMockContext();

  DrawPlugin.onInit!(context);

  DrawPlugin.onMessage!({
    type: "custom",
    pluginId: PLUGIN_ID,
    data: {
      lines: [
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
      ],
    },
  }, context);

  const state = context.getState();
  assertEquals(state.drawLines.length, 2);
  assertEquals(state.drawLines[0].clientId, "client1");
  assertEquals(state.drawLines[0].startX, 10);
  assertEquals(state.drawLines[0].startY, 20);
  assertEquals(state.drawLines[0].endX, 30);
  assertEquals(state.drawLines[0].endY, 40);
  assertEquals(state.drawLines[0].color, "#FF0000");

  const dirtyLayers = context._getDirtyLayers();
  assertEquals(dirtyLayers.includes(STATIC_LAYER), true);
});

Deno.test("DrawPlugin registers layers for rendering", () => {
  mockDocument();
  const context = createMockContext();

  DrawPlugin.onInit!(context);

  const layers = DrawPlugin.onBeforeRender!(context);

  assertEquals(layers.includes(STATIC_LAYER), true);
  assertEquals(layers.includes(ACTIVE_LAYER), true);
});
