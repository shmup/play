export const PLUGIN_ID = "chat";
export const PLUGIN_PRIORITY = 5;

export interface ChatClientMessageData {
  text: string;
}

export interface ChatServerMessageData {
  clientId: string;
  text: string;
}

export interface ChatMessage {
  clientId: string;
  text: string;
}

export interface ChatPluginState {
  chat: ChatMessage[];
}