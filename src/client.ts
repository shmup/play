import {
  initializeClient,
  registerPlugin,
} from "./plugins/framework/client.ts";
import { ChatPlugin } from "./plugins/chat/index.ts";
import { CursorPlugin } from "./plugins/cursors/index.ts";
import { DrawPlugin } from "./plugins/draw/index.ts";
import { createContextMenuPlugin } from "./plugins/contextmenu/index.ts";
import { BackgroundPlugin } from "./plugins/background/index.ts";

registerPlugin(BackgroundPlugin); // Register background plugin first so it renders behind other elements
registerPlugin(ChatPlugin);
registerPlugin(CursorPlugin);
registerPlugin(DrawPlugin);
registerPlugin(
  createContextMenuPlugin([
    {
      label: "Clear Canvas",
      value: "clearCanvas",
      onClick: (context) => {
        // (1) directly clear local canvas
        if (typeof window !== "undefined") {
          globalThis.dispatchEvent(new Event("ClearCanvas"));
        }
        // (2) notify draw plugin via custom message for possible cross-client action
        context.sendMessage({
          type: "custom",
          pluginId: "contextmenu",
          data: { action: "clearCanvas" },
        });
      },
    },
    {
      label: "Log State",
      value: "logState",
      onClick: (context) => {
        console.log("App state:", context.getState());
      },
    },
  ]),
);
initializeClient();
