import React, { useState, useEffect } from 'react';
import { TabMessage } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';
import './AISearchPanel.css';

type PanelStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

interface AISearchPanelProps {
  query: string;
  initialTrigger: boolean;
}

const AISearchPanel: React.FC<AISearchPanelProps> = ({ query, initialTrigger }) => {
  const [status, setStatus] = useState<PanelStatus>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleMessage = (message: TabMessage) => {
    if (message.type === 'AI_SEARCH_STREAM_RESPONSE') {
      if (message.error) {
        setError(message.error);
        setStatus('error');
        return;
      }
      if (message.done) {
        setStatus('success');
      } else {
        setStatus('streaming');
        setContent(prev => prev + message.chunk);
      }
    }
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const triggerSearch = () => {
    setStatus('loading');
    setContent('');
    setError('');
    chrome.runtime.sendMessage({ type: 'AI_SEARCH_REQUEST', query });
  };

  useEffect(() => {
    if (initialTrigger) {
      triggerSearch();
    }
  }, [initialTrigger, query]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleContinueChat = () => {
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL_WITH_CHAT',
      query,
      answer: content,
    });
  };

  const renderBody = () => {
    switch (status) {
      case 'idle':
        return <button className="manual-trigger-btn" onClick={triggerSearch}>✨ AI Search</button>;
      case 'loading':
        return <p>Loading AI search results...</p>;
      case 'streaming':
      case 'success':
        return <MarkdownRenderer content={content} />;
      case 'error':
        return <p className="error-message">{error}</p>;
      default:
        return null;
    }
  };

  return (
    <div id="ai-search-panel-container">
      <div className="panel-header">
        <h3>AI Search</h3>
      </div>
      <div className="panel-body">
        {renderBody()}
      </div>
      {(status === 'success' || status === 'streaming') && (
        <div className="panel-footer">
          <button className="action-btn" onClick={handleCopy} disabled={isCopied}>
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
          <button className="action-btn" onClick={handleContinueChat}>Continue in Chat</button>
        </div>
      )}
    </div>
  );
};

export default AISearchPanel;
