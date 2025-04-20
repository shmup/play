import { defineClientPlugin } from "../framework/client.ts";
import {
  BACKGROUND_LAYER,
  BackgroundPluginState,
  Cloud,
  PLUGIN_ID,
  PLUGIN_PRIORITY,
} from "./shared.ts";

// Constants for background configuration
const CLOUD_COUNT = 15;
const CLOUD_MIN_WIDTH = 150;
const CLOUD_MAX_WIDTH = 400;
const CLOUD_MIN_HEIGHT = 80;
const CLOUD_MAX_HEIGHT = 200;
const CLOUD_MIN_OPACITY = 0.2;
const CLOUD_MAX_OPACITY = 0.5;
const CLOUD_MIN_SPEED = 0.1;
const CLOUD_MAX_SPEED = 0.5;
const BACKGROUND_COLOR = "#e6f7ff"; // Light blue

export const BackgroundPlugin = defineClientPlugin({
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context) {
    // Create the background layer with lowest z-index
    context.canvasManager.getLayer(BACKGROUND_LAYER, 1);

    // Initialize state with random clouds
    context.setState((state) => {
      const viewport = context.canvasManager.getViewport();
      const dimensions = context.canvasManager.getDimensions();

      // Generate random clouds across a larger area than the viewport
      const clouds: Cloud[] = [];
      const areaWidth = dimensions.width * 3;
      const areaHeight = dimensions.height * 3;

      for (let i = 0; i < CLOUD_COUNT; i++) {
        clouds.push({
          x: Math.random() * areaWidth - areaWidth / 3,
          y: Math.random() * areaHeight - areaHeight / 3,
          width: CLOUD_MIN_WIDTH +
            Math.random() * (CLOUD_MAX_WIDTH - CLOUD_MIN_WIDTH),
          height: CLOUD_MIN_HEIGHT +
            Math.random() * (CLOUD_MAX_HEIGHT - CLOUD_MIN_HEIGHT),
          opacity: CLOUD_MIN_OPACITY +
            Math.random() * (CLOUD_MAX_OPACITY - CLOUD_MIN_OPACITY),
          speed: CLOUD_MIN_SPEED +
            Math.random() * (CLOUD_MAX_SPEED - CLOUD_MIN_SPEED),
        });
      }

      (state as { background: BackgroundPluginState }).background = {
        scrollOffset: { x: viewport.x, y: viewport.y },
        clouds,
      };
    });

    // Mark the background layer as dirty to trigger initial render
    context.markLayerDirty(BACKGROUND_LAYER);

    // Set up animation loop for cloud movement
    let lastTime = performance.now();
    const animate = () => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update cloud positions
      context.setState((state) => {
        const bgState =
          (state as { background: BackgroundPluginState }).background;
        if (!bgState) return;

        // Update each cloud position based on its speed
        bgState.clouds.forEach((cloud) => {
          cloud.x += cloud.speed * deltaTime * 10;

          // Wrap clouds around when they go off-screen
          const viewport = context.canvasManager.getViewport();
          const dimensions = context.canvasManager.getDimensions();
          if (cloud.x - bgState.scrollOffset.x > dimensions.width * 2) {
            cloud.x = bgState.scrollOffset.x - cloud.width -
              Math.random() * dimensions.width;
            cloud.y = Math.random() * dimensions.height * 3 - dimensions.height;
          }
        });

        // Update scroll offset based on viewport
        const viewport = context.canvasManager.getViewport();
        if (
          bgState.scrollOffset.x !== viewport.x ||
          bgState.scrollOffset.y !== viewport.y
        ) {
          bgState.scrollOffset = { x: viewport.x, y: viewport.y };
        }
      });

      // Mark the background layer as dirty to trigger re-render
      context.markLayerDirty(BACKGROUND_LAYER);

      // Continue animation loop
      requestAnimationFrame(animate);
    };

    // Start the animation loop
    animate();
  },

  onBeforeRender(context) {
    // Register our background layer for rendering
    return [BACKGROUND_LAYER];
  },

  onRenderLayer(layerId, ctx, context) {
    if (layerId !== BACKGROUND_LAYER) return;

    const state = context.getState() as { background?: BackgroundPluginState };
    if (!state.background) return;

    const { scrollOffset, clouds } = state.background;
    const dimensions = context.canvasManager.getDimensions();

    // Clear the canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw background color
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw clouds with parallax effect
    clouds.forEach((cloud) => {
      // Calculate parallax position based on scroll offset
      const parallaxX = cloud.x - scrollOffset.x * 0.7;
      const parallaxY = cloud.y - scrollOffset.y * 0.7;

      // Only draw clouds that are visible or close to the viewport
      if (
        parallaxX < -cloud.width * 2 ||
        parallaxY < -cloud.height * 2 ||
        parallaxX > dimensions.width * 2 ||
        parallaxY > dimensions.height * 2
      ) {
        return;
      }

      // Draw cloud shape
      ctx.save();
      ctx.globalAlpha = cloud.opacity;
      drawCloud(ctx, parallaxX, parallaxY, cloud.width, cloud.height);
      ctx.restore();
    });
  },
});

// Helper function to draw a cloud shape
function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const radiusX = width / 6;
  const radiusY = height / 2;

  ctx.beginPath();
  ctx.moveTo(x + radiusX, y + height / 2);

  // Draw cloud bubbles
  ctx.arc(x + radiusX, y + height / 2, radiusX, 0, Math.PI * 2);
  ctx.arc(x + width / 3, y + height / 3, radiusX * 1.2, 0, Math.PI * 2);
  ctx.arc(x + width / 2, y + height / 2, radiusX * 1.4, 0, Math.PI * 2);
  ctx.arc(x + width * 2 / 3, y + height / 3, radiusX * 1.1, 0, Math.PI * 2);
  ctx.arc(x + width - radiusX, y + height / 2, radiusX, 0, Math.PI * 2);

  ctx.fillStyle = "white";
  ctx.fill();
}
