import { getParagraphElements, getParagraphPosition, insertImageAfterParagraph } from './dom-utils';
import { ExtensionConfig, RuntimeMessage } from '../../types';
import { renderLightningIcons } from '../index';

let config: ExtensionConfig | null = null;
let requestCounter = 0;
let activeRequests = new Set<number>();

// Load config initially
chrome.storage.sync.get(null, (data) => {
    if (data.urls) {
        config = data as ExtensionConfig;
        initializeLightningIcons();
    }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'CONFIG_UPDATED') {
        config = message.config;
        initializeLightningIcons();
    }
});

function initializeLightningIcons() {
    if (!config || !isUrlMatched(window.location.href, config.urls)) return;
    
    const paragraphs = getParagraphElements();
    const iconData = paragraphs.map(paragraph => ({
        position: getParagraphPosition(paragraph),
        onClick: () => handleImageGeneration(paragraph),
        isLoading: false
    }));
    
    renderLightningIcons(iconData);
}

async function handleImageGeneration(paragraph: HTMLElement) {
    if (!config || !config.apiKey) return;
    
    const paragraphText = paragraph.textContent?.trim();
    if (!paragraphText || paragraphText.length < 10) return;
    
    const requestId = ++requestCounter;
    activeRequests.add(requestId);
    
    initializeLightningIcons();
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'AI_IMAGE_REQUEST',
            requestId,
            config,
            paragraphText,
        });
        
        if (response.success && response.requestId === requestId && response.imageDescription) {
            insertImageAfterParagraph(paragraph, response.imageDescription);
        } else if (response.error) {
            console.error('AI image generation error:', response.error);
        }
    } catch (error) {
        console.error('Failed to send image generation request:', error);
    } finally {
        activeRequests.delete(requestId);
        initializeLightningIcons();
    }
}

function isUrlMatched(url: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(url);
    });
}

export function initializeImageGeneration() {
    initializeLightningIcons();
    setInterval(initializeLightningIcons, 5000); // Refresh every 5 seconds
}
