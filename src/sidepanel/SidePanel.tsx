import React, { useState, useEffect, useRef } from 'react';
import { ExtensionConfig, AITalkTool, ConversationMessage } from '../types';
import MarkdownRenderer from '../content/ui/MarkdownRenderer';
import './index.css';

interface AITalkSession {
  toolId: string;
  selectedText: string;
  timestamp: number;
}

interface AISearchChatSession {
  query: string;
  answer: string;
  timestamp: number;
}

const SidePanel: React.FC = () => {
  const [session, setSession] = useState<AITalkSession | null>(null);
  const [chatTitle, setChatTitle] = useState<string>('AI Talk');
  const [referencedText, setReferencedText] = useState<string>('');
  const [tool, setTool] = useState<AITalkTool | null>(null);
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [requestCounter, setRequestCounter] = useState(0);
  const [showSelectedText, setShowSelectedText] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const streamListenerRef = useRef<((msg: any) => void) | null>(null);
  const lastProcessedSessionRef = useRef<string | null>(null); // 用于追踪最后处理的session

  const handleCopy = (text: string, messageId: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

  useEffect(() => {
    chrome.storage.sync.get().then((syncData) => {
      setConfig(syncData as ExtensionConfig);
      setIsStreaming(!!syncData.stream);
    });

    // Check for both session types on startup
    chrome.storage.local.get(['aiTalkSession', 'aiSearchChatSession']).then((localData) => {
      if (localData.aiSearchChatSession) {
        handleSearchChatSession(localData.aiSearchChatSession);
        chrome.storage.local.remove('aiSearchChatSession');
      } else if (localData.aiTalkSession) {
        handleTalkSession(localData.aiTalkSession);
      }
    });

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local') {
        if (changes.aiSearchChatSession) {
          handleSearchChatSession(changes.aiSearchChatSession.newValue);
          chrome.storage.local.remove('aiSearchChatSession');
        } else if (changes.aiTalkSession) {
          handleTalkSession(changes.aiTalkSession.newValue);
        }
      }
      if (area === 'sync' && changes.stream) {
        setIsStreaming(changes.stream.newValue);
      }
    };
    
    const handleRuntimeMessage = (message: any) => {
      if (message.type === 'AI_SEARCH_STREAM_RESPONSE' && !tool) {
        if (message.chunk) {
          setConversation(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              const updatedMessage = { ...last, content: last.content + message.chunk };
              return [...prev.slice(0, -1), updatedMessage];
            }
            return prev;
          });
        }
        if (message.done) {
          setIsLoading(false);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  const handleTalkSession = (talkSession: AITalkSession) => {
    // 创建唯一标识符来判断是否是新的session
    const sessionKey = `${talkSession.toolId}-${talkSession.selectedText}-${talkSession.timestamp}`;
    
    // 如果是相同的session，则不重新处理
    if (lastProcessedSessionRef.current === sessionKey) {
      return;
    }
    
    lastProcessedSessionRef.current = sessionKey;
    setSession(talkSession);
    setReferencedText(talkSession.selectedText);
    
    // 清理之前的状态
    setConversation([]);
    setIsLoading(false);
    if (streamListenerRef.current) {
      chrome.runtime.onMessage.removeListener(streamListenerRef.current);
      streamListenerRef.current = null;
    }
  };

  const handleSearchChatSession = (searchSession: AISearchChatSession) => {
    const sessionKey = `search-${searchSession.query}-${searchSession.timestamp}`;
    
    if (lastProcessedSessionRef.current === sessionKey) {
      return;
    }
    
    lastProcessedSessionRef.current = sessionKey;
    setSession(null);
    setTool(null);
    setChatTitle('AI Search');
    setReferencedText(searchSession.query);
    setConversation([
      { role: 'user', content: searchSession.query, timestamp: searchSession.timestamp },
      { role: 'assistant', content: searchSession.answer, timestamp: searchSession.timestamp + 1 },
    ]);
  };

  // 当session或config变化时，自动发送初始请求
  useEffect(() => {
    if (!config || !session) return;
    
    const foundTool = config.aiTalkTools?.find((t) => t.id === session.toolId);
    if (foundTool) {
      setTool(foundTool);
      setChatTitle(foundTool.name);
      
      // 自动发送初始请求
      sendMessage([], foundTool.prompt);
    }
  }, [config, session]); // 当config或session变化时触发

  const handleStreamingResponse = (requestId: number, conversationHistory: ConversationMessage[]) => {
    let fullContent = '';

    const handleStream = (msg: any) => {
      if (msg.type !== 'AI_TALK_STREAM' || msg.requestId !== requestId) return;

      fullContent = msg.content;
      setConversation((prev) => {
        const last = prev[prev.length - 1];
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
        };
        return last?.role === 'assistant'
          ? [...prev.slice(0, -1), assistantMessage]
          : [...prev, assistantMessage];
      });

      if (msg.done) {
        setIsLoading(false);
        chrome.runtime.onMessage.removeListener(handleStream);
        streamListenerRef.current = null;
      }
    };

    // 移除上一个流式监听器，防止并发
    if (streamListenerRef.current) {
      chrome.runtime.onMessage.removeListener(streamListenerRef.current);
    }
    chrome.runtime.onMessage.addListener(handleStream);
    streamListenerRef.current = handleStream;
    return handleStream;
  };

  const sendMessage = async (history: ConversationMessage[], prompt: string) => {
    if (!config) return;

    const requestId = requestCounter + 1;
    setRequestCounter(requestId);
    setIsLoading(true);

    const message = {
      type: 'AI_TALK_REQUEST',
      requestId,
      config: { ...config, stream: isStreaming },
      selectedText: referencedText,
      prompt,
      conversationHistory: history,
    };

    if (isStreaming) {
      setConversation(history);
      const streamHandler = handleStreamingResponse(requestId, history);
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError || (response && !response.success)) {
          const error = chrome.runtime.lastError?.message || response?.error || 'An unknown error occurred.';
          console.error('AI_TALK_REQUEST failed', error);
          
          chrome.runtime.onMessage.removeListener(streamHandler);
          if (streamListenerRef.current === streamHandler) {
            streamListenerRef.current = null;
          }

          setConversation((prev) => [
            ...prev,
            { role: 'assistant', content: `Error: ${error}`, timestamp: Date.now() },
          ]);
          setIsLoading(false);
        }
      });
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage(message);
      if (res.success && res.requestId === requestId) {
        setConversation((prev) => [
          ...prev,
          { role: 'assistant', content: res.response, timestamp: Date.now() },
        ]);
      } else if (!res.success) {
        throw new Error(res.error || 'Unknown error from background script');
      }
    } catch (err) {
      console.error('AI_TALK_REQUEST failed', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setConversation((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}`, timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendFollowUp = () => {
    if (!inputText.trim()) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedHistory = [...conversation, userMessage];
    setConversation(updatedHistory);
    setInputText('');

    let prompt;
    if (tool) {
      prompt = `Continue the conversation about the following text: [SELECTED_TEXT]`;
    } else {
      prompt = `Continue the conversation based on the previous context.`;
    }
    sendMessage(updatedHistory, prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp();
    }
  };

  if (!config) {
    return (
      <div className="sidepanel-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel-container">
      <div className="sidepanel-header">
        <h3>
          {tool && <span className="tool-icon">{tool.icon}</span>}
          {chatTitle}
        </h3>
      </div>

      <div className="sidepanel-content">
        <div className="conversation-area" ref={conversationRef}>
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.role}`}
            >
              <div className="message-content-wrapper">
                {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} className="message-content" /> : <div className="message-content">{msg.content}</div>}
                <div className="message-footer">
                  <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                  <div className="message-actions">
                    <button 
                      className={`copy-btn ${copiedMessageId === msg.timestamp ? 'copied' : ''}`}
                      onClick={() => handleCopy(msg.content, msg.timestamp)}
                      aria-label="Copy message"
                    >
                      {copiedMessageId === msg.timestamp ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && !isStreaming && (
            <div className="message assistant">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {referencedText && (
          <div className="selected-text-area">
            <div
              className="selected-text-header"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowSelectedText((prev) => !prev)}
            >
              {tool ? 'Referenced Text' : 'Original Query'}
              <span style={{ marginLeft: 8, fontSize: 12 }}>
                {showSelectedText ? '▲' : '▼'}
              </span>
            </div>
            {showSelectedText && (
              <div className="selected-text-content">{referencedText}</div>
            )}
          </div>
        )}
      </div>

      <div className="input-area">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Continue the conversation..."
          className="input-textarea"
          rows={3}
        />
        <button
          onClick={sendFollowUp}
          disabled={!inputText.trim() || isLoading}
          className="send-button"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default SidePanel;
