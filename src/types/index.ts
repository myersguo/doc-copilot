// src/types/index.ts

export type AISearchMode = 'always' | 'questionMark' | 'manual';

export interface AISearchConfig {
  enabled: boolean;
  searchMode: AISearchMode;
}

export interface ExtensionConfig {
  urls: string[];
  apiUrl: string;
  apiKey: string;
  model: string;
  waitTime: number;
  prompt: string;
  aiTalkTools: AITalkTool[];
  stream?: boolean; // 新增，支持流式开关
  aiSearchConfig: AISearchConfig;
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

export interface OpenSidePanelWithChatRequest {
  type: 'OPEN_SIDE_PANEL_WITH_CHAT';
  query: string;
  answer: string;
}

export interface AISearchRequest {
  type: 'AI_SEARCH_REQUEST';
  query: string;
  config: ExtensionConfig;
}

export type RuntimeMessage = 
  | AICompletionRequest 
  | AITalkRequest 
  | ConfigUpdateRequest 
  | ShowToolbarRequest 
  | OpenSidePanelRequest 
  | AISearchRequest
  | OpenSidePanelWithChatRequest;


// For chrome.tabs.sendMessage
export interface CompletionRequest {
  type: 'COMPLETION_REQUEST';
  requestId: number;
}

export interface CompletionResponse {
  type: 'COMPLETION_RESPONSE';
  requestId: number;
  completion: string;
}

export interface CompletionError {
  type: 'COMPLETION_ERROR';
  requestId: number;
  error: string;
}

export interface AITalkStreamResponse {
  type: 'AI_TALK_STREAM_RESPONSE';
  requestId: number;
  chunk: string;
  done: boolean;
}

export interface AISearchStreamResponse {
  type: 'AI_SEARCH_STREAM_RESPONSE';
  chunk: string;
  done: boolean;
  error?: string;
}

export type TabMessage = CompletionRequest | CompletionResponse | CompletionError | AITalkStreamResponse | AISearchStreamResponse;
