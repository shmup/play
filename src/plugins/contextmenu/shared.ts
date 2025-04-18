export const PLUGIN_ID = "contextmenu";
export const PLUGIN_PRIORITY = 50;

export interface ContextMenuOption {
  label: string;
  value: string;
}

export interface ContextMenuPluginState {
  visible: boolean;
  x: number;
  y: number;
  options: ContextMenuOption[];
}