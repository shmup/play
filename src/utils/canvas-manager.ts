/**
 * Canvas manager for optimized rendering with layered canvases and dirty region tracking
 * Supports infinite scrolling with viewport management
 */

export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  isDirty: boolean;
  dirtyRegions: DirtyRegion[];
  needsFullRedraw: boolean;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CanvasManager {
  private layers: Map<string, CanvasLayer> = new Map();
  private container: HTMLElement;
  private width: number = 0;
  private height: number = 0;
  
  // Viewport properties for infinite scrolling
  private viewport: Viewport = { x: 0, y: 0, width: 0, height: 0 };
  private scrollSpeed: number = 10;
  private isScrolling: boolean = false;
  private scrollDirection = { x: 0, y: 0 };
  private scrollThreshold = 50; // pixels from edge to trigger scrolling
  private maxScrollDistance = 10000; // maximum scroll distance in any direction

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) || document.body;
    this.resize();

    // Handle window resize
    globalThis.addEventListener("resize", () => this.resize());
    
    // Start the scroll animation loop
    this.startScrollLoop();
  }
  
  /**
   * Start the animation loop for smooth scrolling
   */
  private startScrollLoop(): void {
    const scrollLoop = () => {
      if (this.isScrolling) {
        this.updateViewport();
      }
      requestAnimationFrame(scrollLoop);
    };
    requestAnimationFrame(scrollLoop);
  }
  
  /**
   * Update viewport position based on scroll direction
   */
  private updateViewport(): void {
    if (!this.isScrolling) return;

    // For intuitive drawing, we invert the scroll direction:
    // When the cursor is at the bottom, scroll the viewport DOWN (ie, move drawing area UP),
    // so that drawing can continue downwards as expected.
    // Therefore, when scrollDirection.y > 0 (cursor at bottom), we should INCREASE viewport.y
    // (scroll down); conversely, when scrollDirection.y < 0 (cursor at top), we should DECREASE viewport.y (scroll up).
    // The same logic applies for X/left/right.
    // So, instead of subtracting, we ADD scrollDirection * scrollSpeed
    const newX = this.viewport.x + (this.scrollDirection.x * this.scrollSpeed);
    const newY = this.viewport.y + (this.scrollDirection.y * this.scrollSpeed);

    // Apply bounds checking
    this.viewport.x = Math.max(-this.maxScrollDistance, Math.min(this.maxScrollDistance, newX));
    this.viewport.y = Math.max(-this.maxScrollDistance, Math.min(this.maxScrollDistance, newY));

    // Mark all layers as dirty for redraw
    this.layers.forEach((layer) => {
      layer.needsFullRedraw = true;
      layer.isDirty = true;
    });
  }

  /**
   * Create a new canvas layer or return existing one
   */
  public getLayer(id: string, zIndex: number = 0): CanvasLayer {
    if (this.layers.has(id)) {
      return this.layers.get(id)!;
    }

    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = zIndex.toString();
    canvas.style.pointerEvents = zIndex === 0 ? "auto" : "none";

    this.container.appendChild(canvas);

    const ctx = canvas.getContext("2d")!;

    const layer: CanvasLayer = {
      canvas,
      ctx,
      isDirty: true,
      dirtyRegions: [],
      needsFullRedraw: true,
    };

    this.layers.set(id, layer);
    return layer;
  }

  /**
   * Mark a region as dirty to be redrawn
   */
  public markDirty(layerId: string, region?: DirtyRegion): void {
    const layer = this.getLayer(layerId);

    if (!region) {
      layer.needsFullRedraw = true;
      return;
    }

    // Ensure region is within bounds
    const boundedRegion = {
      x: Math.max(0, region.x),
      y: Math.max(0, region.y),
      width: Math.min(region.width, this.width - region.x),
      height: Math.min(region.height, this.height - region.y),
    };

    // Only add if region has positive dimensions
    if (boundedRegion.width > 0 && boundedRegion.height > 0) {
      layer.isDirty = true;
      layer.dirtyRegions.push(boundedRegion);
    }
  }

  /**
   * Clear a specific layer
   */
  public clearLayer(layerId: string): void {
    const layer = this.getLayer(layerId);
    layer.ctx.clearRect(0, 0, this.width, this.height);
    layer.isDirty = false;
    layer.dirtyRegions = [];
    layer.needsFullRedraw = false;
  }

  /**
   * Resize all canvases
   */
  public resize(): void {
    this.width = globalThis.innerWidth;
    this.height = globalThis.innerHeight;

    this.layers.forEach((layer) => {
      layer.canvas.width = this.width;
      layer.canvas.height = this.height;
      layer.needsFullRedraw = true;
      layer.isDirty = true;
    });
  }

  /**
   * Get canvas dimensions
   */
  public getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
  
  /**
   * Get current viewport
   */
  public getViewport(): Viewport {
    return { ...this.viewport };
  }
  
  /**
   * Set scroll direction based on cursor position
   * @param x Cursor X position
   * @param y Cursor Y position
   * @returns true if scrolling, false otherwise
   */
  public updateScrollFromCursor(x: number, y: number): boolean {
    // Calculate scroll direction based on cursor position
    const dirX = this.calculateScrollDirection(x, 0, this.width);
    const dirY = this.calculateScrollDirection(y, 0, this.height);
    
    this.scrollDirection = { x: dirX, y: dirY };
    this.isScrolling = dirX !== 0 || dirY !== 0;
    
    return this.isScrolling;
  }
  
  /**
   * Calculate scroll direction for a single axis
   */
  private calculateScrollDirection(pos: number, min: number, max: number): number {
    if (pos < min + this.scrollThreshold) {
      return -1; // Scroll negative direction (move viewport UP/LEFT when cursor at top/left)
    } else if (pos > max - this.scrollThreshold) {
      return 1;  // Scroll positive direction (move viewport DOWN/RIGHT when cursor at bottom/right)
    }
    return 0;    // No scrolling
  }
  
  /**
   * Convert screen coordinates to world coordinates
   */
  public screenToWorld(x: number, y: number): { x: number, y: number } {
    return {
      x: x + this.viewport.x,
      y: y + this.viewport.y
    };
  }
  
  /**
   * Convert world coordinates to screen coordinates
   */
  public worldToScreen(x: number, y: number): { x: number, y: number } {
    return {
      x: x - this.viewport.x,
      y: y - this.viewport.y
    };
  }

  /**
   * Get the main interaction canvas (lowest z-index)
   */
  public getMainCanvas(): HTMLCanvasElement {
    return this.getLayer("main", 0).canvas;
  }

  /**
   * Clear dirty regions on a layer
   */
  public clearDirtyRegions(layerId: string): void {
    const layer = this.getLayer(layerId);

    if (layer.needsFullRedraw) {
      this.clearLayer(layerId);
      return;
    }

    if (layer.dirtyRegions.length === 0) {
      // If no specific regions but layer is dirty, clear the whole layer
      if (layer.isDirty) {
        this.clearLayer(layerId);
      }
      return;
    }

    layer.dirtyRegions.forEach((region) => {
      // Ensure region is within bounds
      const x = Math.max(0, region.x);
      const y = Math.max(0, region.y);
      const width = Math.min(region.width, this.width - x);
      const height = Math.min(region.height, this.height - y);

      if (width > 0 && height > 0) {
        layer.ctx.clearRect(x, y, width, height);
      }
    });

    layer.dirtyRegions = [];
    layer.isDirty = false;
  }
}
