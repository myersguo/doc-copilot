import { ExtensionConfig, AITalkTool, ScreenPosition } from '../../types';
import { renderTextSelectionToolbar } from '../index';

let config: ExtensionConfig | null = null;
let currentSelection: string = '';
let selectionRange: Range | null = null;
let aiTalkToolEnabled = true; // 新增全局开关，默认开启

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

function getSelectionPosition(): ScreenPosition {
  if (!selectionRange) {
    return { x: 0, y: 0 };
  }
  
  const rect = selectionRange.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 5
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
    // 点击在 toolbar 上，忽略
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
  
  const enabledTools = config.aiTalkTools.filter(tool => tool.enabled);
  if (enabledTools.length === 0) return;
  
  renderTextSelectionToolbar(enabledTools, position, handleToolClick, hideToolbar);
}

function hideToolbar() {
     currentSelection = '';       // 清除选择文本
  selectionRange = null;      // 清除选择范围
  renderTextSelectionToolbar([], { x: 0, y: 0 }, () => {}, () => {});
}

function handleToolClick(toolId: string) {
  if (!currentSelection) return;
  
  // 发送消息到背景脚本打开侧边面板
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
}
