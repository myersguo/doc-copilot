import { CursorContext, ScreenPosition } from '../../types';

export function isInCodeBlock(element: Node | null): boolean {
    if (!element) return false;
    let current = element.nodeType === Node.ELEMENT_NODE ? (element as Element) : element.parentElement;
    while (current && current !== document.body) {
        const className = current.className || '';
        const tagName = current.tagName?.toLowerCase() || '';
        if (
            className.includes('code') || 
            ['code', 'pre'].includes(tagName)
        ) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}

export function getCursorContext(): CursorContext | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const { startContainer, startOffset } = range;
    
    // Find the nearest block-level or editable container
    let container = startContainer.parentElement;
    while(container && container.isContentEditable === false) {
        container = container.parentElement;
        if(container === document.body) return null;
    }
    if(!container) return null;

    const fullText = container.textContent || '';
    
    // Create a temporary range to calculate the offset from the container's start
    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(startContainer, startOffset);
    const cursorOffset = preRange.toString().length;
    
    const beforeCursor = fullText.substring(0, cursorOffset);
    const afterCursor = fullText.substring(cursorOffset);

    return {
        before: beforeCursor.slice(-500), // context window
        after: afterCursor.slice(0, 250),
        fullContext: `${beforeCursor.slice(-500)}<CURSOR>${afterCursor.slice(0, 250)}`,
    };
}

export function getCursorScreenPosition(): ScreenPosition {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return { x: window.scrollX + 100, y: window.scrollY + 100 };
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && range.startContainer.getBoundingClientRect) {
      return range.startContainer.getBoundingClientRect();
    }
    return { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY };
}

export function insertTextAtCursor(text: string): boolean {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents(); // Clear any selected text

  const textNode = document.createTextNode(text);
  range.insertNode(textNode);

  // Move cursor to the end of the inserted text
  selection.collapse(textNode, textNode.length);

  // Dispatch an 'input' event to notify the editor (e.g., Lark) of the change
  const target = range.commonAncestorContainer.parentElement;
  if (target) {
    target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }
  return true;
}
