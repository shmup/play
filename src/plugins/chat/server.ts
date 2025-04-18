import type { ClientMessage } from "../../types/shared.ts";
import type { ServerPlugin, ServerPluginContext } from "../../types/server.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";

export const ChatServerPlugin: ServerPlugin = {
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: ServerPluginContext) {
    context.setState((state) => {
      (state as any).chat = [];
    });
  },
  onClientConnect(clientId: string, context: ServerPluginContext) {
    const state = context.getState() as any;
    const chats = state.chat as { clientId: string; text: string }[] | undefined;
    if (chats && chats.length > 0) {
      for (const chatData of chats) {
        context.sendTo(clientId, {
          type: "custom",
          pluginId: PLUGIN_ID,
          data: chatData,
        });
      }
    }
  },

  onMessage(
    clientId: string,
    message: ClientMessage,
    context: ServerPluginContext,
  ) {
    if (message.type === "custom" && (message as any).pluginId === PLUGIN_ID) {
      const data = (message as any).data as { text: string };
      const chatData = { clientId, text: data.text };
      context.setState((state) => {
        (state as any).chat.push(chatData);
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