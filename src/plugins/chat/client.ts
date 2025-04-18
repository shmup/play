import { defineClientPlugin } from "../framework/client.ts";
import type { PluginContext } from "../framework/client.ts";
import type { ServerMessage } from "../../types/shared.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY } from "./shared.ts";

let historyRequested = false;
export const ChatPlugin = defineClientPlugin({
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: PluginContext) {
    context.setState((state) => {
      (state as any).chat = [];
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
    // Reset flag for history request on new connection
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
    // Handle actual chat entries
    if (message.type === "custom" && message.pluginId === PLUGIN_ID) {
      const data = message.data as any;
      // Only handle actual chat entries (must have clientId and text)
      if (typeof data.clientId === "string" && typeof data.text === "string") {
        context.setState((state) => {
          const s = state as any;
          if (!s.chat) s.chat = [];
          s.chat.push({ clientId: data.clientId, text: data.text });
        });
        // Force immediate render after receiving a chat message
        setTimeout(() => context.forceRender(), 0);
      } // If we received chat history (multiple messages at once), force a render
      else if (Array.isArray(data.history)) {
        context.setState((state) => {
          const s = state as any;
          if (!s.chat) s.chat = [];
          s.chat = [...data.history];
        });
        // Force immediate render after receiving chat history
        // Use a slightly longer timeout to ensure state is fully updated
        setTimeout(() => context.forceRender(), 50);
      }
    }
    return true;
  },

  onRender(ctx: CanvasRenderingContext2D, context: PluginContext) {
    const state = context.getState() as any;
    const chats = state.chat as
      | { clientId: string; text: string }[]
      | undefined;
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
