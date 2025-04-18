/**
 * Canvas manager for optimized rendering with layered canvases and dirty region tracking
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

export class CanvasManager {
  private layers: Map<string, CanvasLayer> = new Map();
  private container: HTMLElement;
  private width: number = 0;
  private height: number = 0;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) || document.body;
    this.resize();

    // Handle window resize
    globalThis.addEventListener("resize", () => this.resize());
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
