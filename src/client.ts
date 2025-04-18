import {
  initializeClient,
  registerPlugin,
} from "./plugins/framework/client.ts";
import { ChatPlugin } from "./plugins/chat/index.ts";
import { CursorPlugin } from "./plugins/cursors/index.ts";

registerPlugin(ChatPlugin);
registerPlugin(CursorPlugin);
initializeClient();
