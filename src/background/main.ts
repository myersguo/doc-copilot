import {
  AICompletionRequest,
  AICompletionResponse,
  AISearchRequest,
  AITalkRequest,
  AITalkResponse,
  OpenSidePanelRequest,
  OpenSidePanelWithChatRequest,
} from '../types';

// Tracks which tabs have an active side panel chat for AI Search
const activeSidePanelSearches: { [tabId: number]: boolean } = {};

// Listens for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AI_COMPLETION_REQUEST') {
    handleCompletionRequest(request, sendResponse);
    return true; // Keep the message channel open for async response
  }
  if (request.type === 'AI_TALK_REQUEST') {
    handleAITalkRequest(request, sendResponse);
    return true;
  }
  if (request.type === 'AI_SEARCH_REQUEST') {
    handleAISearchRequest(request, sender);
    return true; // Keep channel open for streaming
  }
  if (request.type === 'OPEN_SIDE_PANEL') {
    handleOpenSidePanel(request, sender);
    return false;
  }
  if (request.type === 'OPEN_SIDE_PANEL_WITH_CHAT') {
    handleOpenSidePanelWithChat(request, sender);
    return false;
  }
});

async function handleOpenSidePanelWithChat(
  message: OpenSidePanelWithChatRequest,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  if (sender.tab?.id) {
    const tabId = sender.tab.id;
    activeSidePanelSearches[tabId] = true; // Mark this tab as having an active side panel search

    await chrome.sidePanel.open({ tabId });
    await chrome.storage.local.set({
      aiSearchChatSession: {
        query: message.query,
        answer: message.answer,
        timestamp: Date.now(),
      },
    });
  }
}

async function handleAISearchRequest(
  message: AISearchRequest,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const { query } = message;
  const tabId = sender.tab?.id;

  if (!tabId) {
    console.error('Cannot handle AI Search request without a valid tab ID.');
    return;
  }
  
  // Reset the side panel state for this tab when a new search starts
  delete activeSidePanelSearches[tabId];

  try {
    const config = (await chrome.storage.sync.get(null)) as any;
    if (!config.apiKey) {
      throw new Error('API Key is not configured.');
    }

    const searchPrompt = `You are an AI search assistant. Provide a comprehensive, well-structured, and accurate answer for the following user query. Use Markdown for formatting (e.g., headings, lists, bold text). Query: "${query}"`;

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    const broadcast = (msg: any) => {
      // Send to the content script panel
      chrome.tabs.sendMessage(tabId, msg);
      // If side panel is open for this search, send to it as well
      if (activeSidePanelSearches[tabId]) {
        chrome.runtime.sendMessage(msg);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        broadcast({ type: 'AI_SEARCH_STREAM_RESPONSE', done: true });
        delete activeSidePanelSearches[tabId]; // Clean up
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        
        const data = trimmed.replace(/^data:\s*/, '');
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            broadcast({
              type: 'AI_SEARCH_STREAM_RESPONSE',
              chunk: delta,
              done: false,
            });
          }
        } catch (e) {
          console.warn('[AI_SEARCH_STREAM] JSON parse error:', e, data);
        }
      }
    }
  } catch (error) {
    console.error('AI Search Request Failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const finalMessage = {
      type: 'AI_SEARCH_STREAM_RESPONSE',
      done: true,
      error: errorMessage,
    };
    // Send error to both content script and potentially side panel
    chrome.tabs.sendMessage(tabId, finalMessage);
    if (activeSidePanelSearches[tabId]) {
      chrome.runtime.sendMessage(finalMessage);
    }
  } finally {
    delete activeSidePanelSearches[tabId]; // Ensure cleanup on exit
  }
}


async function handleAITalkRequest(
  message: AITalkRequest,
  sendResponse: (response: AITalkResponse) => void
): Promise<void> {
  const { requestId, config, selectedText, prompt, conversationHistory = [] } = message;

  try {
    if (!config.apiKey) {
      throw new Error('API Key is not configured.');
    }

    // 构建对话历史
    const messages = [
      { role: 'system', content: prompt.replace('[SELECTED_TEXT]', selectedText) },
      ...conversationHistory,
    ];

    // 判断是否为流式请求
    const isStream = !!config.stream;

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: isStream,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    if (isStream && response.body) {
      // 流式处理
      const reader = response.body.getReader();
      let fullContent = '';
      const decoder = new TextDecoder('utf-8');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // 解析每一行 JSON
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.replace(/^data:\s*/, '');
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            // 兼容 deepseek-v3 响应格式
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              chrome.runtime.sendMessage({
                type: 'AI_TALK_STREAM',
                requestId,
                content: fullContent,
                delta,
                done: false,
              });
            }
          } catch (e) {
            console.warn('[AI_TALK_STREAM] parse error:', e, data);
          }
        }
      }
      // 结束
      chrome.runtime.sendMessage({
        type: 'AI_TALK_STREAM',
        requestId,
        content: fullContent,
        done: true,
      });
      sendResponse({
        success: true,
        requestId,
        response: fullContent,
      });
      return;
    }

    // 非流式
    const data = await response.json();
    if (data.choices?.[0]?.message?.content) {
      sendResponse({
        success: true,
        requestId: requestId,
        response: data.choices[0].message.content,
      });
    } else {
      throw new Error('API response format is invalid: Missing choices data.');
    }
  } catch (error) {
    console.error('AI Talk Request Failed:', error);
    sendResponse({
      success: false,
      requestId: requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleOpenSidePanel(
  message: OpenSidePanelRequest,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  if (sender.tab?.id) {
        const tabId = sender.tab.id;
        await chrome.sidePanel.open({ tabId });

    // 存储选中文本和工具ID到storage，供侧边面板使用
      await chrome.storage.local.set({
      aiTalkSession: {
        toolId: message.toolId,
        selectedText: message.selectedText,
        timestamp: Date.now(),
      },
    });
  }
}

/**
 * Handles the AI completion request from the content script.
 * @param message The request message.
 * @param sendResponse The function to call to send the response.
 */
async function handleCompletionRequest(
  message: AICompletionRequest,
  sendResponse: (response: AICompletionResponse) => void
): Promise<void> {
  const { requestId, config, context } = message;

  try {
    if (!config.apiKey) {
      throw new Error('API Key is not configured.');
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: config.prompt },
          { role: 'user', content: context },
        ],
        max_tokens: 150,
        temperature: 0.3,
        stop: ['\n\n', '<CURSOR>'],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      const completion = cleanCompletion(data.choices[0].message.content, context);
      sendResponse({
        success: true,
        requestId: requestId,
        completion: completion,
      });
    } else {
      throw new Error('API response format is invalid: Missing choices data.');
    }
  }
 catch (error) {
    console.error('AI Completion Request Failed:', error);
    sendResponse({
      success: false,
      requestId: requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Cleans the completion text to avoid repeating the user's context.
 * @param completion The raw text from the AI.
 * @param context The context sent to the AI.
 * @returns Cleaned completion text.
 */
function cleanCompletion(completion: string, context: string): string {
  if (!completion) return '';

  const beforeCursor = context.split('<CURSOR>')[0];
  let clean = completion.trim();
  
  // Remove potential quote wrapping
  clean = clean.replace(/^[\"']|[\"']$/g, '');

  // If completion starts with the context, remove it
  const beforeCursorTrimmed = beforeCursor.trim().toLowerCase();
  if (clean.toLowerCase().startsWith(beforeCursorTrimmed)) {
    clean = clean.substring(beforeCursorTrimmed.length).trimStart();
  }

  // Check and remove repeated last few words
  const words = beforeCursor.trim().split(/\s+/);
  for (let i = Math.min(words.length, 5); i > 0; i--) {
    const lastWords = words.slice(-i).join(' ');
    if (clean.toLowerCase().startsWith(lastWords.toLowerCase())) {
      clean = clean.substring(lastWords.length).trimStart();
      break;
    }
  }

  // Remove leading punctuation that might be redundant
  clean = clean.replace(/^[,，、。.]/, '');

  return clean;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('doc copilot has been installed.');
});
