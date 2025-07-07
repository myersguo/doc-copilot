// src/types/index.ts

export interface ExtensionConfig {
  urls: string[];
  apiUrl: string;
  apiKey: string;
  model: string;
  waitTime: number;
  prompt: string;
    aiTalkTools: AITalkTool[];

}

export interface AITalkTool {
  id: string;
  name: string;
  icon: string;
  prompt: string;
  enabled: boolean;
}


export interface CursorContext {
  before: string;
  after: string;
  fullContext: string;
}

export interface ScreenPosition {
  x: number;
  y: number;
}

// For chrome.runtime.sendMessage
export interface AICompletionRequest {
  type: 'AI_COMPLETION_REQUEST';
  requestId: number;
  config: ExtensionConfig;
  context: string;
}

export interface AICompletionResponse {
  success: boolean;
  requestId: number;
  completion?: string;
  error?: string;
}

export interface AITalkRequest {
  type: 'AI_TALK_REQUEST';
  requestId: number;
  config: ExtensionConfig;
  selectedText: string;
  prompt: string;
  conversationHistory?: ConversationMessage[];
}

export interface AITalkResponse {
  success: boolean;
  requestId: number;
  response?: string;
  error?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}




export interface ConfigUpdateRequest {
  type: 'CONFIG_UPDATED';
  config: ExtensionConfig;
}


export interface ShowToolbarRequest {
  type: 'SHOW_TOOLBAR';
  selectedText: string;
  position: ScreenPosition;
}

export interface OpenSidePanelRequest {
  type: 'OPEN_SIDE_PANEL';
  toolId: string;
  selectedText: string;
}

export type RuntimeMessage = AICompletionRequest | AITalkRequest | ConfigUpdateRequest | ShowToolbarRequest | OpenSidePanelRequest;
