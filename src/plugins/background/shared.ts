export const PLUGIN_ID = "background";
export const PLUGIN_PRIORITY = 5; // Lower priority to render before other plugins
export const BACKGROUND_LAYER = "background";

export interface BackgroundPluginState {
  scrollOffset: {
    x: number;
    y: number;
  };
  clouds: Cloud[];
}

export interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  speed: number;
}
