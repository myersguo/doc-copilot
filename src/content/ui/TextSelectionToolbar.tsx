import React, { useState, useRef, useEffect } from 'react';
import { AITalkTool, ScreenPosition } from '../../types';
import './index.css';

interface Props {
  tools: AITalkTool[];
  position: ScreenPosition;
  onToolClick: (toolId: string) => void;
  onHide: () => void;
  onDisableDomain: () => void;
  onDisableGlobally: () => void;
}

const TextSelectionToolbar: React.FC<Props> = ({
  tools,
  position,
  onToolClick,
  onHide,
  onDisableDomain,
  onDisableGlobally,
}) => {
  const [isMenuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  if (tools.length === 0) return null;

  const handleToolClick = (toolId: string) => {
    onToolClick(toolId);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuVisible(!isMenuVisible);
  };

  const handleDisableDomain = () => {
    onDisableDomain();
    setMenuVisible(false);
    onHide();
  };

  const handleDisableGlobally = () => {
    onDisableGlobally();
    setMenuVisible(false);
    onHide();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${Math.min(position.x, window.innerWidth - 200)}px`,
    top: `${position.y}px`,
  };

  return (
    <div 
      style={style} 
      className="text-selection-toolbar" 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
      <div className="toolbar-divider" />
      <div className="toolbar-menu-container" ref={menuRef}>
        <button className="toolbar-button" onClick={toggleMenu} title="More options">
          <span className="toolbar-icon">⋮</span>
        </button>
        {isMenuVisible && (
          <div className="toolbar-dropdown-menu">
            <button onClick={handleDisableDomain}>
              <span className="icon">🚫</span>
              <span>Disable for this domain</span>
            </button>
            <button onClick={handleDisableGlobally}>
              <span className="icon">🌍</span>
              <span>Disable globally</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextSelectionToolbar;
