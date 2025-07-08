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
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [requestCounter, setRequestCounter] = useState(0);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 初始加载配置和会话信息
    Promise.all([
      chrome.storage.sync.get(),
      chrome.storage.local.get(['aiTalkSession'])
    ]).then(([syncData, localData]) => {
      if (syncData.urls) {
        setConfig(syncData as ExtensionConfig);
      }
      if (localData.aiTalkSession) {
        setSession(localData.aiTalkSession);
      }
    });

    // 监听 aiTalkSession 变化
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.aiTalkSession) {
        const newValue = changes.aiTalkSession.newValue;
        setSession(newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    setConversation([]);
  }, [session?.selectedText]);

  useEffect(() => {
    if (config && session) {
      const foundTool = config.aiTalkTools?.find(t => t.id === session.toolId);
      if (foundTool) {
        setTool(foundTool);
        sendInitialRequest(foundTool);
      }
    }
  }, [config, session]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation]);

  const sendInitialRequest = async (selectedTool: AITalkTool) => {
    if (!session || !config) return;

    setIsLoading(true);
    const currentRequestId = requestCounter + 1;
    setRequestCounter(currentRequestId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_TALK_REQUEST',
        requestId: currentRequestId,
        config,
        selectedText: session.selectedText,
        prompt: selectedTool.prompt,
        conversationHistory: [],
      });

      if (response.success && response.requestId === currentRequestId) {
        const newMessage: ConversationMessage = {
          role: 'assistant',
          content: response.response,
          timestamp: Date.now(),
        };
        setConversation([newMessage]);
      }
    } catch (error) {
      console.error('Failed to send AI Talk request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendFollowUpMessage = async () => {
    if (!inputText.trim() || !config || !session) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: inputText,
      timestamp: Date.now(),
    };

    setConversation(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    const currentRequestId = requestCounter + 1;
    setRequestCounter(currentRequestId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_TALK_REQUEST',
        requestId: currentRequestId,
        config,
        selectedText: session.selectedText,
        prompt: `Continue the conversation about the following text: [SELECTED_TEXT]`,
        conversationHistory: [...conversation, userMessage],
      });

      if (response.success && response.requestId === currentRequestId) {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: response.response,
          timestamp: Date.now(),
        };
        setConversation(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Failed to send follow-up message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowUpMessage();
    }
  };

  if (!session || !tool || !config) {
    return (
      <div className="sidepanel-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
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
          {conversation.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">
                {message.role === 'assistant' ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="selected-text-area">
          <div className="selected-text-header">Referenced Text</div>
          <div className="selected-text-content">{session.selectedText}</div>
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
          onClick={sendFollowUpMessage}
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
