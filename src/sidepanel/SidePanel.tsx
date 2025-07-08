import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExtensionConfig, AITalkTool, ConversationMessage } from '../types';
import './index.css';

interface AITalkSession {
  toolId: string;
  selectedText: string;
  timestamp: number;
}

const SidePanel: React.FC = () => {
  const [session, setSession] = useState<AITalkSession | null>(null);
  const [tool, setTool] = useState<AITalkTool | null>(null);
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [requestCounter, setRequestCounter] = useState(0);
  const [showSelectedText, setShowSelectedText] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const streamListenerRef = useRef<((msg: any) => void) | null>(null);

  useEffect(() => {
    chrome.storage.sync.get().then((syncData) => {
      setConfig(syncData as ExtensionConfig);
      setIsStreaming(!!syncData.stream);
    });

    chrome.storage.local.get(['aiTalkSession']).then((localData) => {
      if (localData.aiTalkSession) setSession(localData.aiTalkSession);
    });

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && changes.aiTalkSession) {
        setSession(changes.aiTalkSession.newValue);
      }
      if (area === 'sync' && changes.stream) {
        setIsStreaming(changes.stream.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    // 在切换选中文本时，停止当前生成和流式监听
    setIsLoading(false);
    if (streamListenerRef.current) {
      chrome.runtime.onMessage.removeListener(streamListenerRef.current);
      streamListenerRef.current = null;
    }
    setConversation([]);
  }, [session?.selectedText]);

  useEffect(() => {
    if (!config || !session) return;
    const foundTool = config.aiTalkTools?.find((t) => t.id === session.toolId);
    if (foundTool) {
      setTool(foundTool);
      sendMessage([], foundTool.prompt);
    }
  }, [config, session]);

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
    if (!config || !session) return;

    const requestId = requestCounter + 1;
    setRequestCounter(requestId);
    setIsLoading(true);

    const message = {
      type: 'AI_TALK_REQUEST',
      requestId,
      config: { ...config, stream: isStreaming },
      selectedText: session.selectedText,
      prompt,
      conversationHistory: history,
    };

    if (isStreaming) {
      setConversation(history);
      handleStreamingResponse(requestId, history);
      chrome.runtime.sendMessage(message);
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage(message);
      if (res.success && res.requestId === requestId) {
        setConversation((prev) => [
          ...prev,
          { role: 'assistant', content: res.response, timestamp: Date.now() },
        ]);
      }
    } catch (err) {
      console.error('AI_TALK_REQUEST failed', err);
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
    sendMessage(updatedHistory, `Continue the conversation about the following text: [SELECTED_TEXT]`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp();
    }
  };

  if (!session || !tool || !config) {
    return (
      <div className="sidepanel-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading AI Talk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel-container">
      <div className="sidepanel-header">
        <h3>
          <span className="tool-icon">{tool.icon}</span>
          {tool.name}
        </h3>
      </div>

      <div className="sidepanel-content">
        <div className="conversation-area" ref={conversationRef}>
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.role}`}
              style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}
            >
              <span className="icon" aria-label={msg.role === 'assistant' ? 'AI' : 'User'}>
                {msg.role === 'assistant' ? '🤖' : '🧑'}
              </span>
              <div className="message-content-wrapper">
                <div className="message-content">
                  {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
                <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
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

        <div className="selected-text-area">
          <div
            className="selected-text-header"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setShowSelectedText((prev) => !prev)}
          >
            Referenced Text
            <span style={{ marginLeft: 8, fontSize: 12 }}>
              {showSelectedText ? '▲' : '▼'}
            </span>
          </div>
          {showSelectedText && (
            <div className="selected-text-content">{session.selectedText}</div>
          )}
        </div>
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
