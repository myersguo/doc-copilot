import React from 'react';
import ReactDOM from 'react-dom/client';
import CompletionPopup from './ui/CompletionPopup';
import {  initializeEventListeners } from './features/completion-handler';

function getTargetDocument(): Document {
    if (window.self !== window.top) {
        try {
            if (window.parent.document) {
                return window.parent.document;
            }
        } catch (e) {
            console.log('Cross-origin iframe detected, rendering popup in iframe');
        }
    }
    return document;
}

const targetDocument = getTargetDocument();
const rootEl = targetDocument.createElement('div');
rootEl.id = 'shichuang-ai-completer-root';
targetDocument.body.appendChild(rootEl);
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
