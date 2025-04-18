import { ClientMessage } from "./shared.ts";

export interface AppState {
  cursors: Record<string, CursorState>;
  [key: string]: unknown;
}

export interface PluginContext {
  clientId: string;
  sendMessage: (message: ClientMessage) => void;
  getState: () => AppState;
  setState: (updater: (state: AppState) => void) => void;
}
