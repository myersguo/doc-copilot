import React, { useEffect, useRef } from 'react';
import { ScreenPosition } from '../../types';
import './index.css';


interface Props {
  text: string;
  position: ScreenPosition;
  onAccept: () => void;
  onCancel: () => void;
}

const CompletionPopup: React.FC<Props> = ({ text, position, onAccept, onCancel }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onAccept();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onAccept, onCancel]);
  
  // Prevent clicks inside the popup from closing it via the global click listener
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onAccept();
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${Math.min(position.x, window.innerWidth - 320)}px`,
    top: `${position.y + 10}px`, // position below the cursor line
  };

  return (
    <div ref={popupRef} style={style} className="completion-popup" onClick={handleClick}>
      <span className="completion-text">{text}</span>
      <div className="completion-hint">Tab to accept • Esc to cancel</div>
    </div>
  );
};

export default CompletionPopup;
