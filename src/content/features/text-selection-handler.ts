import { ExtensionConfig, AITalkTool, ScreenPosition } from '../../types';
import { renderTextSelectionToolbar } from '../index';

let config: ExtensionConfig | null = null;
let currentSelection: string = '';
let selectionRange: Range | null = null;
let aiTalkToolEnabled = true; // 新增全局开关，默认开启
let hideToolbarTimer: number | null = null; // 用于存储计时器ID

// 加载配置
chrome.storage.sync.get(null, (data) => {
  if (data.urls) {
    config = data as ExtensionConfig;
  }
});

// 监听配置更新
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CONFIG_UPDATED') {
    config = message.config;
  }
});

// 监听开关变化（假设存储在 chrome.storage.sync['aiTalkToolEnabled']）
chrome.storage.sync.get(['aiTalkToolEnabled'], (data) => {
  if (typeof data.aiTalkToolEnabled === 'boolean') {
    aiTalkToolEnabled = data.aiTalkToolEnabled;
  }
});
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AITALKTOOL_SWITCH_UPDATED') {
    aiTalkToolEnabled = message.enabled;
  }
});

// 监听 stream 状态变化
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AITALKTOOL_STREAM_UPDATED') {
    if (config) config.stream = message.stream;
    else config = { stream: message.stream } as ExtensionConfig;
    // 可根据需要在此处触发 UI 更新或其他副作用
  }
});

// 监听 storage 变化，实时同步 config
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.stream) {
      if (!config) config = {} as ExtensionConfig;
      config.stream = changes.stream.newValue;
    }
    // 可同步其他配置项
    if (changes.urls) {
      if (!config) config = {} as ExtensionConfig;
      config.urls = changes.urls.newValue;
    }
    if (changes.apiUrl) {
      if (!config) config = {} as ExtensionConfig;
      config.apiUrl = changes.apiUrl.newValue;
    }
    if (changes.apiKey) {
      if (!config) config = {} as ExtensionConfig;
      config.apiKey = changes.apiKey.newValue;
    }
    if (changes.model) {
      if (!config) config = {} as ExtensionConfig;
      config.model = changes.model.newValue;
    }
    if (changes.waitTime) {
      if (!config) config = {} as ExtensionConfig;
      config.waitTime = changes.waitTime.newValue;
    }
    if (changes.prompt) {
      if (!config) config = {} as ExtensionConfig;
      config.prompt = changes.prompt.newValue;
    }
    if (changes.aiTalkTools) {
      if (!config) config = {} as ExtensionConfig;
      config.aiTalkTools = changes.aiTalkTools.newValue;
    }
  }
});

function getSelectionPosition(): ScreenPosition {
  if (!selectionRange) {
    return { x: 0, y: 0 };
  }

  const container = selectionRange.startContainer;
  let rect;

  // When selecting text in a textarea or input, the range's bounding rectangle is not reliable.
  // Instead, we check if the selection container is one of these elements and use its bounding rectangle.
  if (
    container.nodeType === Node.ELEMENT_NODE &&
    ['TEXTAREA', 'INPUT'].includes((container as HTMLElement).tagName)
  ) {
    rect = (container as HTMLElement).getBoundingClientRect();
  } else {
    // For all other elements, the range's bounding rectangle is accurate.
    rect = selectionRange.getBoundingClientRect();
    // If the rect is still 0, it might be a complex case (e.g. contenteditable div).
    // As a fallback, we can check the active element.
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
 if (!config || !isUrlMatched(window.location.href, config.urls)) return;
  if (!aiTalkToolEnabled) {
    hideToolbar();
    return;
  }

  const target = e?.target as HTMLElement | undefined;
  
  if (target && target.closest('.text-selection-toolbar')) {
    // 点击在 toolbar 上，清除隐藏的计时器
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
  
  // 清除之前的计时器
  if (hideToolbarTimer) {
    clearTimeout(hideToolbarTimer);
    hideToolbarTimer = null;
  }

  const enabledTools = config.aiTalkTools.filter(tool => tool.enabled);
  if (enabledTools.length === 0) return;
  
  renderTextSelectionToolbar(enabledTools, position, handleToolClick, hideToolbar);

  // 设置10秒后自动隐藏
  hideToolbarTimer = window.setTimeout(() => {
    hideToolbar();
  }, 3000);
}

function hideToolbar() {
  // 清除计时器
  if (hideToolbarTimer) {
    clearTimeout(hideToolbarTimer);
    hideToolbarTimer = null;
  }
  currentSelection = '';       // 清除选择文本
  selectionRange = null;      // 清除选择范围
  renderTextSelectionToolbar([], { x: 0, y: 0 }, () => {}, () => {});
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

function isUrlMatched(url: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
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

  // 支持 command + A 选中时也能触发文本选择逻辑
  document.addEventListener('keydown', (e) => {
    // macOS: e.metaKey 代表 command 键
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      setTimeout(() => handleTextSelection(), 100);
    }
  });

  document.addEventListener('selectionchange', () => {
    setTimeout(() => handleTextSelection(), 100);
  });
}
