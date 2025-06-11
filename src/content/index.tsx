import React from 'react';
import ReactDOM from 'react-dom/client';
import CompletionPopup from './ui/CompletionPopup';
import {  initializeEventListeners } from './features/completion-handler';

const rootEl = document.createElement('div');
rootEl.id = 'shichuang-ai-completer-root';
document.body.appendChild(rootEl);
const reactRoot = ReactDOM.createRoot(rootEl);

// Function to render the UI
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

initializeEventListeners();
