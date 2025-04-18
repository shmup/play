export const PLUGIN_ID = "draw";
export const PLUGIN_PRIORITY = 20;

export interface DrawPluginState {
  lines: DrawLine[];
  isDrawing: boolean;
  lastX: number;
  lastY: number;
}

export interface DrawLine {
  clientId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

export interface DrawClientMessageData {
  requestHistory?: boolean;
}

export interface DrawServerMessageData {
  lines: DrawLine[];
}
// Layer identifiers for rendering draw plugin
export const STATIC_LAYER = "draw-static";
export const ACTIVE_LAYER = "draw-active";
