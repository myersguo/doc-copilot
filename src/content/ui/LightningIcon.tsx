import React from 'react';
import { ScreenPosition } from '../../types';

interface Props {
  position: ScreenPosition;
  onClick: () => void;
  isLoading?: boolean;
}

const LightningIcon: React.FC<Props> = ({ position, onClick, isLoading }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 999998,
  };

  return (
    <div 
      style={style} 
      className={`lightning-icon ${isLoading ? 'loading' : ''}`}
      onClick={onClick}
    >
      ⚡️
    </div>
  );
};

export default LightningIcon;
