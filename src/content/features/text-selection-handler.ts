import { ExtensionConfig, ScreenPosition } from '../../types';
import { renderTextSelectionToolbar } from '../index';

let config: ExtensionConfig | null = null;
let currentSelection: string = '';
let selectionRange: Range | null = null;
let hideToolbarTimer: number | null = null;

// Load config from storage
chrome.storage.sync.get(null, (data) => {
  if (data.urls) {
    config = data as ExtensionConfig;
  }
});

// Listen for config updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CONFIG_UPDATED') {
    config = message.config;
  }
});

// Listen for storage changes to keep config up to date
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    let updated = false;
    for (const key in changes) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        (config as any)[key] = changes[key].newValue;
        updated = true;
      }
    }
    if (updated) {
      // If the change affects the toolbar, you might want to re-render it
      handleTextSelection();
    }
  }
});

function getSelectionPosition(): ScreenPosition {
  if (!selectionRange) {
    return { x: 0, y: 0 };
  }
  const container = selectionRange.startContainer;
  let rect;

  if (
    container.nodeType === Node.ELEMENT_NODE &&
    ['TEXTAREA', 'INPUT'].includes((container as HTMLElement).tagName)
  ) {
    rect = (container as HTMLElement).getBoundingClientRect();
  } else {
    rect = selectionRange.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      const activeElement = document.activeElement;
      if (activeElement && ['TEXTAREA', 'INPUT'].includes(activeElement.tagName)) {
        rect = activeElement.getBoundingClientRect();
      }
    }
  }

  return {
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 5,
  };
}

function handleTextSelection(e?: MouseEvent) {
  if (!config || !config.aiToolsEnabled || !isUrlMatched(window.location.href, config.urls)) {
    hideToolbar();
    return;
  }

  const target = e?.target as HTMLElement | undefined;
  if (target && target.closest('.text-selection-toolbar')) {
    if (hideToolbarTimer) {
      clearTimeout(hideToolbarTimer);
      hideToolbarTimer = null;
    }
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    hideToolbar();
    return;
  }

  const selectedText = selection.toString().trim();
  if (selectedText.length === 0) {
    hideToolbar();
    return;
  }

  currentSelection = selectedText;
  selectionRange = selection.getRangeAt(0);
  const position = getSelectionPosition();
  showToolbar(position);
}

function showToolbar(position: ScreenPosition) {
  if (!config?.aiTalkTools) return;

  if (hideToolbarTimer) {
    clearTimeout(hideToolbarTimer);
    hideToolbarTimer = null;
  }

  const enabledTools = config.aiTalkTools.filter((tool) => tool.enabled);
  if (enabledTools.length === 0) return;

  renderTextSelectionToolbar(
    enabledTools,
    position,
    handleToolClick,
    hideToolbar,
    handleDisableDomain,
    handleDisableGlobally
  );

  hideToolbarTimer = window.setTimeout(() => {
    hideToolbar();
  }, 10000);
}

function hideToolbar() {
  if (hideToolbarTimer) {
    clearTimeout(hideToolbarTimer);
    hideToolbarTimer = null;
  }
  currentSelection = '';
  selectionRange = null;
  renderTextSelectionToolbar([], { x: 0, y: 0 }, () => { }, () => { }, () => { }, () => { });
}

function handleToolClick(toolId: string) {
  if (!currentSelection) return;

  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    toolId,
    selectedText: currentSelection,
  });

  hideToolbar();
}

function handleDisableDomain() {
  if (!config) return;
  const currentUrl = window.location.href;
  const newUrls = config.urls.filter(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return !regex.test(currentUrl);
  });

  const newConfig = { ...config, urls: newUrls };
  chrome.storage.sync.set(newConfig, () => {
    config = newConfig;
    hideToolbar();
  });
}

function handleDisableGlobally() {
  if (!config) return;
  const newConfig = { ...config, aiToolsEnabled: false };
  chrome.storage.sync.set(newConfig, () => {
    config = newConfig;
    hideToolbar();
  });
}

function isUrlMatched(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  });
}

export function initializeTextSelectionHandler() {
  document.addEventListener('mouseup', (e) => {
    setTimeout(() => handleTextSelection(e), 100);
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.text-selection-toolbar')) {
      hideToolbar();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      setTimeout(() => handleTextSelection(), 100);
    }
  });

  document.addEventListener('selectionchange', () => {
    setTimeout(() => handleTextSelection(), 100);
  });
}
