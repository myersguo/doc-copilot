// src/content/features/completion-handler.ts
import { getCursorContext, getCursorScreenPosition, insertTextAtCursor, isInCodeBlock, isGoogleDocs } from './dom-utils';
import { ExtensionConfig, CursorContext, ConfigUpdateRequest, RuntimeMessage } from '../../types';
import { renderCompletionUI } from '../index';

let config: ExtensionConfig | null = null;
let timer: NodeJS.Timeout | null = null;
let lastContext: string = '';
let requestCounter = 0;
let isShowingCompletion = false;

// Load config initially
chrome.storage.sync.get(null, (data) => {
    if (data.urls) {
        config = data as ExtensionConfig;
    }
});

// Listen for config updates from the options page
chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'CONFIG_UPDATED') {
        config = message.config;
        console.log('Configuration updated:', config);
        hideCompletion();
    }
});

function hideCompletion() {
    if (!isShowingCompletion) return;
    isShowingCompletion = false;
    renderCompletionUI(null, null, () => {}, () => {});
}

function acceptCompletion(completion: string) {
    if (!isShowingCompletion) return;
    insertTextAtCursor(completion);
    hideCompletion();
}

async function requestCompletion(context: CursorContext) {
    if (!config || !config.apiKey) return;

    const requestId = ++requestCounter;
    console.log('Requesting completion for context:', context.fullContext);

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'AI_COMPLETION_REQUEST',
            requestId,
            config,
            context: context.fullContext,
        });

        if (response.success && response.requestId === requestCounter && response.completion) {
            const position = getCursorScreenPosition();
            isShowingCompletion = true;
            renderCompletionUI(
                response.completion,
                position,
                () => acceptCompletion(response.completion!),
                hideCompletion
            );
        } else if (response.error) {
            console.error('AI completion error:', response.error);
        }
    } catch (error) {
        console.error('Failed to send completion request:', error);
    }
}

function shouldTriggerCompletion(context: CursorContext): boolean {
    const beforeText = context.before.trim();
    if (beforeText.length < 3) return false;

    // More lenient trigger conditions
    const endsWithPunctuationOrWord = /[.,!?;:，。！？；：、a-zA-Z\u4e00-\u9fa5)]$/.test(beforeText);
    const endsWithSpace = /\s$/.test(context.before);
    
    return endsWithPunctuationOrWord || (endsWithSpace && beforeText.length > 5);
}

export function handleInput(event: Event) {
    if (!config || !isUrlMatched(window.location.href, config.urls)) return;
    
    // Ensure the event target is editable
    const target = event.target as HTMLElement;
    if (!isEditableElement(target)) return;
    
    if (timer) clearTimeout(timer);
    if (isShowingCompletion) hideCompletion();

    const context = getCursorContext();
    if (!context || context.fullContext === lastContext) return;
    
    lastContext = context.fullContext;

    if (!shouldTriggerCompletion(context)) return;

    timer = setTimeout(() => {
        const currentContext = getCursorContext();
        if (currentContext && currentContext.fullContext === lastContext) {
            requestCompletion(currentContext);
        }
    }, config!.waitTime * 1000);
}

function handleKeyDown(e: KeyboardEvent) {
    if (isShowingCompletion) {
        // The actual accept/cancel logic is passed to the React component
        // This is a fallback/global listener
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            hideCompletion();
        } else if (['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            hideCompletion();
        }
    }
}

function isUrlMatched(url: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(url);
    });
}

function isEditableElement(target: HTMLElement): boolean {
    if (target.isContentEditable) return true;
    
    if (isGoogleDocs()) {
        return target.closest('.docs-texteventtarget-iframe') !== null ||
               target.classList.contains('docs-texteventtarget-iframe');
    }
    
    return false;
}

export function initializeEventListeners() {
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('click', () => hideCompletion(), true);
    document.addEventListener('scroll', () => hideCompletion(), true);
}
