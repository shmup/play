import {
  initializeClient,
  registerPlugin,
} from "./plugins/framework/client.ts";
import { ChatPlugin } from "./plugins/chat/index.ts";
import { CursorPlugin } from "./plugins/cursors/index.ts";
import { DrawPlugin } from "./plugins/draw/index.ts";
import { ContextMenuPlugin } from "./plugins/contextmenu/index.ts";

registerPlugin(ChatPlugin);
registerPlugin(CursorPlugin);
registerPlugin(DrawPlugin);
registerPlugin(ContextMenuPlugin);
initializeClient();
