import { assertEquals } from "@std/assert";
import { appState, createContext } from "../src/plugins/framework/server.ts";

Deno.test("createContext.getState returns state copy", () => {
  appState["foo"] = 1;
  const context = createContext();
  const stateCopy = context.getState();
  stateCopy.foo = 2;
  assertEquals(appState["foo"], 1);
});

Deno.test("createContext.setState updates appState", () => {
  delete appState["foo"];
  const context = createContext();
  context.setState((state) => {
    state.foo = 3;
  });
  assertEquals(appState["foo"], 3);
});

Deno.test("createContext.broadcast sends to open websocket clients", () => {
  appState.clients.clear();
  const messages: [string, unknown][] = [];
  const client1 = {
    readyState: WebSocket.OPEN,
    send: (msg: unknown) => messages.push(["1", msg]),
  };
  const client2 = {
    readyState: WebSocket.CLOSING,
    send: (msg: unknown) => messages.push(["2", msg]),
  };
  appState.clients.set("1", { socket: client1 });
  appState.clients.set("2", { socket: client2 });
  const context = createContext();
  const message = { type: "custom", pluginId: "test", data: null } as const;
  context.broadcast(message);
  assertEquals(messages.length, 1);
  assertEquals(messages[0][0], "1");
});

Deno.test("createContext.broadcast excludes specified client", () => {
  appState.clients.clear();
  const messages: [string, unknown][] = [];
  const client1 = {
    readyState: WebSocket.OPEN,
    send: (msg: unknown) => messages.push(["1", msg]),
  };
  const client2 = {
    readyState: WebSocket.OPEN,
    send: (msg: unknown) => messages.push(["2", msg]),
  };
  appState.clients.set("1", { socket: client1 });
  appState.clients.set("2", { socket: client2 });
  const context = createContext();
  const message = { type: "custom", pluginId: "test", data: null } as const;
  context.broadcast(message, "1");
  assertEquals(messages.length, 1);
  assertEquals(messages[0][0], "2");
});

Deno.test("createContext.sendTo sends only to the specified client", () => {
  appState.clients.clear();
  const messages: [string, unknown][] = [];
  const client1 = {
    readyState: WebSocket.OPEN,
    send: (msg: unknown) => messages.push(["1", msg]),
  };
  const client2 = {
    readyState: WebSocket.OPEN,
    send: (msg: unknown) => messages.push(["2", msg]),
  };
  appState.clients.set("1", { socket: client1 });
  appState.clients.set("2", { socket: client2 });
  const context = createContext();
  const message = { type: "custom", pluginId: "test", data: null } as const;
  context.sendTo("2", message);
  assertEquals(messages.length, 1);
  assertEquals(messages[0][0], "2");
});
