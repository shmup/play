import {
  initializeClient,
  registerPlugin,
} from "./plugins/framework/client.ts";
import { ChatPlugin } from "./plugins/chat/index.ts";
import { CursorPlugin } from "./plugins/cursors/index.ts";
import { DrawPlugin } from "./plugins/draw/index.ts";
import { createContextMenuPlugin } from "./plugins/contextmenu/index.ts";

registerPlugin(ChatPlugin);
registerPlugin(CursorPlugin);
registerPlugin(DrawPlugin);
// Context menu plugin with custom actions
registerPlugin(
  createContextMenuPlugin([
    {
      label: "Clear Canvas",
      value: "clearCanvas",
      onClick: (context) => {
        // send a custom message; handle on server if desired
        context.sendMessage({ type: "custom", pluginId: "contextmenu", data: { action: "clearCanvas" } });
      },
    },
    {
      label: "Log State",
      value: "logState",
      onClick: (context) => {
        console.log("App state:", context.getState());
      },
    },
  ])
);
initializeClient();
