import { assertEquals, assertNotEquals } from "@std/assert";
import { CanvasManager } from "../src/utils/canvas-manager.ts";

// Create a mock document for testing
const mockDocument = () => {
  (globalThis as any).document = {
    getElementById: () => ({
      appendChild: () => {},
    }),
    createElement: () => {
      return {
        style: {},
        width: 800,
        height: 600,
        getContext: () => ({
          clearRect: () => {},
          fillStyle: "",
          fillRect: () => {},
        }),
      };
    },
  };

  (globalThis as any).innerWidth = 800;
  (globalThis as any).innerHeight = 600;
  (globalThis as any).addEventListener = () => {};
};

Deno.test("CanvasManager initialization", () => {
  mockDocument();
  const manager = new CanvasManager("test-container");

  // Check if dimensions are set correctly
  const dimensions = manager.getDimensions();
  assertEquals(dimensions.width, 800);
  assertEquals(dimensions.height, 600);
});

Deno.test("CanvasManager creates layers", () => {
  mockDocument();
  const manager = new CanvasManager("test-container");

  // Create a layer
  const layer1 = manager.getLayer("test-layer", 5);

  // Check if layer was created correctly
  assertNotEquals(layer1, undefined);
  assertEquals(layer1.canvas.width, 800);
  assertEquals(layer1.canvas.height, 600);
  assertEquals(layer1.canvas.style.zIndex, "5");

  // Get the same layer again
  const layer2 = manager.getLayer("test-layer");

  // Check if it's the same layer
  assertEquals(layer1, layer2);
});

Deno.test("CanvasManager marks layers as dirty", () => {
  mockDocument();
  const manager = new CanvasManager("test-container");

  // Create a layer
  const layer = manager.getLayer("test-layer");

  // Mark the layer as dirty
  manager.markDirty("test-layer");

  // Check if layer is marked as dirty
  assertEquals(layer.isDirty, true);
  assertEquals(layer.needsFullRedraw, true);

  // Mark a specific region as dirty
  manager.markDirty("test-layer", { x: 10, y: 20, width: 30, height: 40 });

  // Check if region was added to dirty regions
  assertEquals(layer.dirtyRegions.length, 1);
  assertEquals(layer.dirtyRegions[0].x, 10);
  assertEquals(layer.dirtyRegions[0].y, 20);
  assertEquals(layer.dirtyRegions[0].width, 30);
  assertEquals(layer.dirtyRegions[0].height, 40);
});

Deno.test("CanvasManager clears layers", () => {
  mockDocument();
  const manager = new CanvasManager("test-container");

  // Create a layer
  const layer = manager.getLayer("test-layer");

  // Mark the layer as dirty
  manager.markDirty("test-layer");

  // Clear the layer
  manager.clearLayer("test-layer");

  // Check if layer is no longer dirty
  assertEquals(layer.isDirty, false);
  assertEquals(layer.dirtyRegions.length, 0);
  assertEquals(layer.needsFullRedraw, false);
});

Deno.test("CanvasManager handles resize", () => {
  mockDocument();
  const manager = new CanvasManager("test-container");

  // Create a layer
  const layer = manager.getLayer("test-layer");

  // Change globalThis dimensions
  (globalThis as any).innerWidth = 1024;
  (globalThis as any).innerHeight = 768;

  // Trigger resize
  manager.resize();

  // Check if dimensions were updated
  const dimensions = manager.getDimensions();
  assertEquals(dimensions.width, 1024);
  assertEquals(dimensions.height, 768);

  // Check if layer was updated
  assertEquals(layer.canvas.width, 1024);
  assertEquals(layer.canvas.height, 768);
  assertEquals(layer.needsFullRedraw, true);
  assertEquals(layer.isDirty, true);
});
