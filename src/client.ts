import {
  initializeClient,
  registerPlugin,
} from "./plugins/framework/client.ts";
import { CursorPlugin } from "./plugins/cursors/index.ts";

registerPlugin(CursorPlugin);
initializeClient();
