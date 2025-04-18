import { assertEquals } from "@std/assert";
import { appState, createContext } from "../src/plugins/framework/server.ts";
import { ChatServerPlugin } from "../src/plugins/chat/index.ts";

Deno.test("ChatServerPlugin onInit initializes chat state", () => {
  delete (appState as any).chat;
  const context = createContext();
  ChatServerPlugin.onInit?.(context);
  assertEquals(Array.isArray((appState as any).chat), true);
  assertEquals(((appState as any).chat as unknown[]).length, 0);
});

Deno.test("ChatServerPlugin onMessage broadcasts chat messages", () => {
  const messages: unknown[] = [];
  const context = {
    broadcast: (msg: unknown) => messages.push(msg),
    sendTo: () => {},
    getState: () => ({}),
    setState: () => {},
  } as any;
  const customMessage = {
    type: "custom",
    pluginId: "chat",
    data: { text: "hello world" },
  } as any;
  const result = ChatServerPlugin.onMessage!("client1", customMessage, context);
  assertEquals(messages, [{
    type: "custom",
    pluginId: "chat",
    data: { clientId: "client1", text: "hello world" },
  }]);
  assertEquals(result, false);
});

Deno.test("ChatServerPlugin onMessage ignores non-chat messages", () => {
  const messages: unknown[] = [];
  const context = {
    broadcast: (msg: unknown) => messages.push(msg),
    sendTo: () => {},
    getState: () => ({}),
    setState: () => {},
  } as any;
  const otherMessage = {
    type: "custom",
    pluginId: "other",
    data: { text: "test" },
  } as any;
  const result = ChatServerPlugin.onMessage!("client1", otherMessage, context);
  assertEquals(messages.length, 0);
  assertEquals(result, true);
});
