// src/types/index.ts

export interface ExtensionConfig {
  urls: string[];
  apiUrl: string;
  apiKey: string;
  model: string;
  waitTime: number;
  prompt: string;
  imagePrompt: string;
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

export interface AIImageRequest {
  type: 'AI_IMAGE_REQUEST';
  requestId: number;
  config: ExtensionConfig;
  paragraphText: string;
}

export interface AIImageResponse {
  success: boolean;
  requestId: number;
  imageDescription?: string;
  error?: string;
}

export interface ConfigUpdateRequest {
  type: 'CONFIG_UPDATED';
  config: ExtensionConfig;
}

export type RuntimeMessage = AICompletionRequest | ConfigUpdateRequest | AIImageRequest;
