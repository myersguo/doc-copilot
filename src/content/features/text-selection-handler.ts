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
    console.log('changes', changes);
    console.log('areaName', areaName);
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

  // 支持 command + A 选中时也能触发文本选择逻辑
  document.addEventListener('keydown', (e) => {
    // macOS: e.metaKey 代表 command 键
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      setTimeout(() => handleTextSelection(), 100);
    }
  });
}
