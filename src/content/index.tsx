import React from 'react';
import ReactDOM from 'react-dom/client';
import CompletionPopup from './ui/CompletionPopup';
import TextSelectionToolbar from './ui/TextSelectionToolbar';
import { initializeEventListeners } from './features/completion-handler';
import { initializeTextSelectionHandler } from './features/text-selection-handler';
import { initializeAISearchHandler } from './features/ai-search-handler.tsx';
import { AITalkTool, ScreenPosition } from '../types';

const rootEl = document.createElement('div');
rootEl.id = 'shichuang-ai-completer-root';
document.body.appendChild(rootEl);
const reactRoot = ReactDOM.createRoot(rootEl);

// 原有的 renderCompletionUI 函数保持不变...
export function renderCompletionUI(
    completion: string | null,
    position: { x: number; y: number } | null,
    onAccept: () => void,
    onCancel: () => void
) {
    if (completion && position) {
        reactRoot.render(
            <React.StrictMode>
                <CompletionPopup
                    text={completion}
                    position={position}
                    onAccept={onAccept}
                    onCancel={onCancel}
                />
            </React.StrictMode>
        );
    } else {
        reactRoot.render(null);
    }
}

export function renderTextSelectionToolbar(
    tools: AITalkTool[],
    position: ScreenPosition,
    onToolClick: (toolId: string) => void,
    onHide: () => void
) {
    if (tools.length > 0) {
        reactRoot.render(
            <React.StrictMode>
                <TextSelectionToolbar
                    tools={tools}
                    position={position}
                    onToolClick={onToolClick}
                    onHide={onHide}
                />
            </React.StrictMode>
        );
    } else {
        reactRoot.render(null);
    }
}

initializeEventListeners();
initializeTextSelectionHandler();
initializeAISearchHandler();
