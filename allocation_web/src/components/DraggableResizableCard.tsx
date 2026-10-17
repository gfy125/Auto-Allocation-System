import React, { useState, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from "@/components/ui/card";

interface DraggableResizableCardProps {
  id: string;
  children: React.ReactNode;
  title?: string;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  onPositionChange?: (id: string, position: { x: number; y: number }) => void;
  onSizeChange?: (id: string, size: { width: number; height: number }) => void;
  style?: React.CSSProperties;
  zIndex?: number;
}

export const DraggableResizableCard: React.FC<DraggableResizableCardProps> = ({
  id,
  children,
  defaultPosition = { x: 0, y: 0 },
  defaultSize = { width: 400, height: 300 },
  minWidth = 200,
  minHeight = 150,
  onPositionChange,
  onSizeChange,
  style = {},
  zIndex = 1,
}) => {
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled: isResizing,
  });

  const dragStyle = {
    transform: CSS.Translate.toString(transform),
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes('right')) {
        newWidth = Math.max(minWidth, startWidth + (e.clientX - startX));
      }
      if (direction.includes('left')) {
        newWidth = Math.max(minWidth, startWidth - (e.clientX - startX));
      }
      if (direction.includes('bottom')) {
        newHeight = Math.max(minHeight, startHeight + (e.clientY - startY));
      }
      if (direction.includes('top')) {
        newHeight = Math.max(minHeight, startHeight - (e.clientY - startY));
      }

      const newSize = { width: newWidth, height: newHeight };
      setSize(newSize);
      onSizeChange?.(id, newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [size, minWidth, minHeight, id, onSizeChange]);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dragStyle,
        position: 'absolute',
        left: defaultPosition.x,
        top: defaultPosition.y,
        width: size.width,
        height: size.height,
        zIndex: isDragging ? 1000 : zIndex,
        ...style,
      }}
      className="draggable-resizable-card"
    >
      <Card
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle bar at the top */}
        <div
          {...listeners}
          {...attributes}
          style={{
            width: '100%',
            height: '32px',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            flexShrink: 0,
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            userSelect: 'none',
            boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s ease',
          }}
          className="drag-handle-bar"
        >
          {/* Drag handle dots indicator */}
          <div style={{ display: 'flex', gap: '3px' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8' }} />
          </div>
        </div>
        
        {/* Content - scrollable area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {children}
        </div>

        {/* Resize handles */}
        {/* Right */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'right')}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            cursor: 'ew-resize',
            backgroundColor: 'transparent',
          }}
          className="resize-handle resize-handle-right"
        />
        
        {/* Bottom */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'bottom')}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '8px',
            cursor: 'ns-resize',
            backgroundColor: 'transparent',
          }}
          className="resize-handle resize-handle-bottom"
        />
        
        {/* Bottom Right Corner */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '16px',
            height: '16px',
            cursor: 'nwse-resize',
            backgroundColor: 'transparent',
          }}
          className="resize-handle resize-handle-corner"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              opacity: 0.4,
            }}
          >
            <path
              d="M 12 12 L 4 12 L 12 4 Z"
              fill="#666"
            />
          </svg>
        </div>
      </Card>
    </div>
  );
};
