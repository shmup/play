export type ClientMessage = {
  type: "move";
  x: number;
  y: number;
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
};

export type CursorState = {
  x: number;
  y: number;
  color: string;
};
