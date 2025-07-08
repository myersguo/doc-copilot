import React from 'react';
import { AITalkTool, ScreenPosition } from '../../types';
import './index.css';

interface Props {
  tools: AITalkTool[];
  position: ScreenPosition;
  onToolClick: (toolId: string) => void;
  onHide: () => void;
}

const TextSelectionToolbar: React.FC<Props> = ({ tools, position, onToolClick, onHide }) => {
  if (tools.length === 0) return null;

  const handleToolClick = (toolId: string) => {
    onToolClick(toolId);
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${Math.min(position.x, window.innerWidth - 200)}px`,
    top: `${position.y}px`,
  };

  return (
    <div style={style} className="text-selection-toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className="toolbar-button"
          onClick={() => handleToolClick(tool.id)}
          title={tool.name}
        >
          <span className="toolbar-icon">{tool.icon}</span>
          <span className="toolbar-text">{tool.name}</span>
        </button>
      ))}
    </div>
  );
};

export default TextSelectionToolbar;
