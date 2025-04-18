import type { CursorState } from "../../types/shared.ts";

export const PLUGIN_ID = "cursor";
export const PLUGIN_PRIORITY = 10;

export interface CursorClientState {
  x: number;
  y: number;
  color: string;
}

export interface CursorsPluginState {
  cursors: Record<string, CursorState>;
}
