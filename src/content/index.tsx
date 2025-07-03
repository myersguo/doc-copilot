import React from 'react';
import ReactDOM from 'react-dom/client';
import CompletionPopup from './ui/CompletionPopup';
import LightningIcon from './ui/LightningIcon';
import { initializeEventListeners } from './features/completion-handler';
import { initializeImageGeneration } from './features/image-handler';

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

// Function to render lightning icons
export function renderLightningIcons(
    iconData: Array<{
        position: { x: number; y: number };
        onClick: () => void;
        isLoading: boolean;
    }>
) {
    const iconsContainer = document.getElementById('lightning-icons-container') || (() => {
        const container = document.createElement('div');
        container.id = 'lightning-icons-container';
        document.body.appendChild(container);
        return container;
    })();
    
    const iconsRoot = ReactDOM.createRoot(iconsContainer);
    iconsRoot.render(
        <React.StrictMode>
            {iconData.map((data, index) => (
                <LightningIcon
                    key={index}
                    position={data.position}
                    onClick={data.onClick}
                    isLoading={data.isLoading}
                />
            ))}
        </React.StrictMode>
    );
}

initializeEventListeners();
initializeImageGeneration();
