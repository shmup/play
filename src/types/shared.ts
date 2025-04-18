export type ClientMessage = {
  type: "move";
  x: number;
  y: number;
} | {
  type: "custom";
  pluginId: string;
  data: unknown;
};

export type ServerMessage = {
  type: "init";
  clientId: string;
  cursors: Record<string, CursorState>;
} | {
  type: "update";
  clientId: string;
  x: number;
  y: number;
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
