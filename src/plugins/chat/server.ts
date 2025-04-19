import type { ClientMessage } from "../../types/shared.ts";
import type { ServerPlugin, ServerPluginContext } from "../../types/server.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import type {
  ChatPluginState,
  ChatClientMessageData,
  ChatServerMessageData,
} from "./shared.ts";

export const ChatServerPlugin: ServerPlugin = {
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: ServerPluginContext) {
    context.setState((state) => {
      const s = state as unknown as ChatPluginState;
      s.chat = [];
    });
  },

  onMessage(
    clientId: string,
    message: ClientMessage,
    context: ServerPluginContext,
  ) {
    // Handle chat plugin messages
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as ChatClientMessageData & { requestHistory?: boolean };
      // Client requests history
      if (data.requestHistory) {
      const state = context.getState() as unknown as ChatPluginState;
        const chats = state.chat as ChatServerMessageData[] | undefined;
        if (chats && chats.length > 0) {
          for (const chatData of chats) {
            context.sendTo(clientId, {
              type: "custom",
              pluginId: PLUGIN_ID,
              data: chatData,
            });
          }
        }
        return false;
      }
      // New chat message
      const text = data.text!;
      const chatData: ChatServerMessageData = { clientId, text };
      context.setState((state) => {
        const s = state as unknown as ChatPluginState;
        s.chat.push(chatData);
      });
      context.broadcast({
        type: "custom",
        pluginId: PLUGIN_ID,
        data: chatData,
      });
      return false;
    }
    return true;
  },
};
