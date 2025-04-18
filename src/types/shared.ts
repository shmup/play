export type ClientMessage = {
  type: "move";
  x: number;
  y: number;
} | {
  type: "draw";
  x: number;
  y: number;
  isDrawing: boolean;
} | {
  type: "custom";
  pluginId: string;
  data: unknown;
};

export type ServerMessage = {
  type: "init";
  clientId: string;
  cursors: Record<string, CursorState>;
  lines?: DrawLine[];
} | {
  type: "update";
  clientId: string;
  x: number;
  y: number;
  color: string;
} | {
  type: "drawUpdate";
  clientId: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
} | {
  type: "disconnect";
  clientId: string;
} | {
  type: "custom";
  pluginId: string;
  data: unknown;
};

export type CursorState = {
  x: number;
  y: number;
  color: string;
};

export type DrawLine = {
  clientId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
};
