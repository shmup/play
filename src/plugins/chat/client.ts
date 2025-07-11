import { defineClientPlugin } from "../framework/client.ts";
import type { PluginContext } from "../framework/client.ts";
import type { ServerMessage } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";
import type { ChatPluginState, ChatServerMessageData } from "./shared.ts";

let historyRequested = false;
export const ChatPlugin = defineClientPlugin({
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: PluginContext) {
    context.setState((state) => {
      const s = state as ChatPluginState;
      s.chat = [];
    });

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "50%";
    overlay.style.left = "50%";
    overlay.style.transform = "translate(-50%, -50%)";
    overlay.style.background = "rgba(0, 0, 0, 0.7)";
    overlay.style.padding = "10px";
    overlay.style.display = "none";
    overlay.style.zIndex = "1000";
    overlay.style.borderRadius = "5px";
    overlay.style.maxWidth = "400px";
    overlay.style.width = "80%";

    const input = document.createElement("input");
    input.type = "text";
    input.style.width = "100%";
    input.style.fontSize = "16px";
    input.style.padding = "5px";
    input.style.boxSizing = "border-box";
    input.style.outline = "none";
    input.style.border = "1px solid #ccc";
    overlay.appendChild(input);
    document.body.appendChild(overlay);

    // listen for toggle and cancel keys, if supported
    if (typeof document.addEventListener === "function") {
      document.addEventListener("keydown", (e) => {
        if (e.key === "t" && overlay.style.display === "none") {
          overlay.style.display = "block";
          input.value = "";
          input.focus();
          e.preventDefault();
        } else if (e.key === "Escape" && overlay.style.display === "block") {
          overlay.style.display = "none";
          input.blur();
          e.preventDefault();
        }
      });
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const text = input.value.trim();
        if (text) {
          context.sendMessage({
            type: "custom",
            pluginId: PLUGIN_ID,
            data: { text },
          });
        }
        overlay.style.display = "none";
        input.blur();
        e.preventDefault();
      }
    });
    // reset flag for history request on new connection
    historyRequested = false;
  },

  onMessage(message: ServerMessage, context: PluginContext) {
    // On initial server init, request chat history once
    if (message.type === "init" && !historyRequested) {
      context.sendMessage({
        type: "custom",
        pluginId: PLUGIN_ID,
        data: { requestHistory: true },
      });
      historyRequested = true;
    }
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as ChatServerMessageData & {
        history?: ChatServerMessageData[];
      };
      // only handle actual chat entries (must have clientId and text)
      if (typeof data.clientId === "string" && typeof data.text === "string") {
        context.setState((state) => {
          const s = state as ChatPluginState;
          if (!s.chat) {
            s.chat = [];
          }
          s.chat.push({ clientId: data.clientId, text: data.text });
        });
        context.forceRender();
      } else if (Array.isArray(data.history)) {
        context.setState((state) => {
          const s = state as ChatPluginState;
          // data.history is guaranteed array here
          s.chat = [...(data.history as ChatServerMessageData[])];
        });
        context.forceRender();
      }
    }
    return true;
  },

  onRender(ctx: CanvasRenderingContext2D, context: PluginContext) {
    const state = context.getState() as ChatPluginState;
    const chats = state.chat;
    if (!chats || chats.length === 0) {
      return;
    }
    const maxMessages = 30;
    const start = chats.length > maxMessages ? chats.length - maxMessages : 0;
    ctx.font = "16px Arial";
    ctx.fillStyle = "black";
    for (let i = start; i < chats.length; i++) {
      const msg = chats[i];
      const text = `${msg.clientId.slice(0, 6)}: ${msg.text}`;
      ctx.fillText(text, 10, 20 + (i - start) * 20);
    }
  },
});
