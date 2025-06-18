// src/content/features/completion-handler.ts
import { getCursorContext, getCursorScreenPosition, insertTextAtCursor, isInCodeBlock, isGoogleDocs } from './dom-utils';
import { ExtensionConfig, CursorContext, ConfigUpdateRequest, RuntimeMessage } from '../../types';
import { renderCompletionUI } from '../index';

let config: ExtensionConfig | null = null;
let timer: number | null = null;
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
    console.log('[DOC-COPILOT] handleInput triggered:', {
        eventType: event.type,
        target: event.target,
        url: window.location.href,
        isGoogleDocs: isGoogleDocs()
    });
    
    if (!config || !isUrlMatched(window.location.href, config.urls)) {
        console.log('[DOC-COPILOT] URL not matched or no config:', {
            config: !!config,
            url: window.location.href,
            patterns: config?.urls
        });
        return;
    }
    
    const target = event.target as HTMLElement;
    const isEditable = isEditableElement(target);
    console.log('[DOC-COPILOT] Element editability check:', {
        target: target.tagName,
        className: target.className,
        isContentEditable: target.isContentEditable,
        isEditable: isEditable,
        isGoogleDocs: isGoogleDocs()
    });
    
    if (!isEditable) return;
    
    if (timer) clearTimeout(timer);
    if (isShowingCompletion) hideCompletion();

    const context = getCursorContext();
    console.log('[DOC-COPILOT] Cursor context:', {
        hasContext: !!context,
        contextLength: context?.fullContext?.length,
        isSameAsLast: context?.fullContext === lastContext
    });
    
    if (!context || context.fullContext === lastContext) return;
    
    lastContext = context.fullContext;

    const shouldTrigger = shouldTriggerCompletion(context);
    console.log('[DOC-COPILOT] Trigger completion check:', {
        shouldTrigger,
        beforeLength: context.before.length,
        waitTime: config.waitTime
    });

    if (!shouldTrigger) return;

    timer = setTimeout(() => {
        const currentContext = getCursorContext();
        if (currentContext && currentContext.fullContext === lastContext) {
            console.log('[DOC-COPILOT] Requesting completion after timeout');
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
    console.log('[DOC-COPILOT] isEditableElement check:', {
        tagName: target.tagName,
        className: target.className,
        isContentEditable: target.isContentEditable,
        isGoogleDocs: isGoogleDocs()
    });
    
    if (target.isContentEditable) {
        console.log('[DOC-COPILOT] Element is contentEditable');
        return true;
    }
    
    if (isGoogleDocs()) {
        const hasIframeClass = target.classList.contains('docs-texteventtarget-iframe');
        const closestIframe = target.closest('.docs-texteventtarget-iframe');
        const hasKixContent = target.closest('.kix-page-content-wrap');
        
        console.log('[DOC-COPILOT] Google Docs element check:', {
            hasIframeClass,
            hasClosestIframe: !!closestIframe,
            hasKixContent: !!hasKixContent
        });
        
        return hasIframeClass || !!closestIframe || !!hasKixContent;
    }
    
    console.log('[DOC-COPILOT] Element is not editable');
    return false;
}

export function initializeEventListeners() {
    console.log('[DOC-COPILOT] Initializing event listeners:', {
        url: window.location.href,
        isGoogleDocs: isGoogleDocs()
    });
    
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('click', () => hideCompletion(), true);
    document.addEventListener('scroll', () => hideCompletion(), true);
    
    if (isGoogleDocs()) {
        console.log('[DOC-COPILOT] Adding Google Docs specific event listeners');
        document.addEventListener('keyup', handleInput, true);
        document.addEventListener('compositionend', handleInput, true);
        document.addEventListener('textInput', handleInput, true);
        
        setTimeout(() => {
            const iframe = document.querySelector('.docs-texteventtarget-iframe') as HTMLIFrameElement;
            if (iframe) {
                console.log('[DOC-COPILOT] Found Google Docs iframe, attempting to add listeners');
                try {
                    iframe.addEventListener('input', handleInput, true);
                    iframe.addEventListener('keyup', handleInput, true);
                } catch (error) {
                    console.log('[DOC-COPILOT] Could not add iframe listeners (expected):', error);
                }
            }
        }, 1000);
    }
}
