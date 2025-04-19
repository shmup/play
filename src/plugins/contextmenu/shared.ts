import type { PluginContext } from "../framework/client.ts";
export const PLUGIN_ID = "contextmenu";
export const PLUGIN_PRIORITY = 50;

/**
 * Option for context menu entries.
 * @param label Display text for the menu item.
 * @param value Identifier for the action.
 * @param onClick Optional handler invoked on selection.
 */
export interface ContextMenuOption {
  label: string;
  value: string;
  onClick?: (
    context: PluginContext,
    option: ContextMenuOption,
    event: MouseEvent
  ) => void;
}

export interface ContextMenuPluginState {
  visible: boolean;
  x: number;
  y: number;
  options: ContextMenuOption[];
}