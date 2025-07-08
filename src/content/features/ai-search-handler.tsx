// src/content/features/ai-search-handler.ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExtensionConfig } from '../../types';
import AISearchPanel from '../ui/AISearchPanel';

/**
 * Extracts the search query from the URL of Google or Bing.
 * @returns The search query string, or null if not found.
 */
function getSearchQuery(): string | null {
  const url = new URL(window.location.href);
  const host = url.hostname;

  if (host.includes('google') || host.includes('bing')) {
    return url.searchParams.get('q');
  }

  return null;
}

/**
 * Injects the AI Search Panel into the DOM.
 */
function injectAISearchPanel(query: string, initialTrigger: boolean) {
    const host = window.location.hostname;
    let parentElement: HTMLElement | null = null;
  
    // Prevent double injection
    if (document.getElementById('ai-search-panel-root')) {
      return;
    }
  
    if (host.includes('www.google.')) {
      parentElement = document.getElementById('rhs');
      if (!parentElement) {
        parentElement = document.querySelector('#rcnt');
      }
    } else if (host.includes('www.bing.')) {
      parentElement = document.getElementById('b_context');
    }
  
    if (parentElement) {
      const container = document.createElement('div');
      container.id = 'ai-search-panel-root';
      
      if (host.includes('www.google.') && parentElement.id === 'rhs') {
          parentElement.prepend(container);
      } else {
          parentElement.appendChild(container);
      }
      
      const searchRoot = ReactDOM.createRoot(container);
      searchRoot.render(
        <React.StrictMode>
          <AISearchPanel query={query} initialTrigger={initialTrigger} />
        </React.StrictMode>
      );
    }
  }


/**
 * Initializes the AI search handler.
 */
export function initializeAISearchHandler() {
  // Wait for the page to be fully loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    run();
  } else {
    window.addEventListener('DOMContentLoaded', run);
  }

  function run() {
    chrome.storage.sync.get(null, (data) => {
        const config = data as ExtensionConfig;
        const query = getSearchQuery();
    
        if (!query || !config.aiSearchConfig || !config.aiSearchConfig.enabled) {
          return;
        }
    
        const { searchMode } = config.aiSearchConfig;
        let shouldTrigger = false;
    
        switch (searchMode) {
          case 'always':
            shouldTrigger = true;
            break;
          case 'questionMark':
            shouldTrigger = query.trim().endsWith('?');
            break;
          case 'manual':
            shouldTrigger = false;
            break;
        }
        
        injectAISearchPanel(query, shouldTrigger);
      });
  }
}
