import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ClassicStyleSwitcherProps {
  className?: string;
}

const ClassicStyleSwitcher: React.FC<ClassicStyleSwitcherProps> = ({ className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);

  const isShadcnVersion = location.pathname.includes('student_modern');
  const isClassicVersion = location.pathname.includes('/student_classic');

  // add debug information
  console.log('🎨 ClassicStyleSwitcher Debug:', {
    currentPath: location.pathname,
    isShadcnVersion,
    isClassicVersion,
    navigate: !!navigate
  });

  const switchToShadcn = () => {
    console.log('🔄 Clicked Modern button!');
    if (isAnimating) {
      console.log('❌ Animation in progress, ignoring click');
      return;
    }
    
    try {
      setIsAnimating(true);
      console.log('✅ Starting navigation to Modern Dashboard...');
      
      // directly navigate, test basic functionality
      if (location.pathname.includes('/new_group')) {
        const groupId = location.pathname.split('/').pop();
        if (groupId && groupId !== 'new_group') {
          console.log(`📱 Navigating to: /student_modern/new_group/${groupId}`);
          navigate(`/student_modern/new_group/${groupId}`);
        } else {
          console.log('📱 Navigating to: /student_modern/new_group');
          navigate('/student_modern/new_group');
        }
      } else {
        console.log('📱 Navigating to: /student_modern');
        navigate('/student_modern');
      }
      
      // delay reset state
      setTimeout(() => {
        setIsAnimating(false);
        console.log('✅ Navigation complete');
      }, 500);
      
    } catch (error) {
      console.error('❌ Error in switchToShadcn:', error);
      setIsAnimating(false);
    }
  };

  const switchToClassic = () => {
    console.log('🔄 Clicked Classic button!');
    if (isAnimating) {
      console.log('❌ Animation in progress, ignoring click');
      return;
    }
    
    try {
      setIsAnimating(true);
      console.log('✅ Starting navigation to Classic Dashboard...');
      
      // directly navigate, test basic functionality
      if (location.pathname.includes('/new_group')) {
        const groupId = location.pathname.split('/').pop();
        if (groupId && groupId !== 'new_group') {
          console.log(`📊 Navigating to: /student_classic/new_group/${groupId}`);
          navigate(`/student_classic/new_group/${groupId}`);
        } else {
          console.log('📊 Navigating to: /student_classic/new_group');
          navigate('/student_classic/new_group');
        }
      } else {
        console.log('📊 Navigating to: /student_classic');
        navigate('/student_classic');
      }
      
      // delay reset state
      setTimeout(() => {
        setIsAnimating(false);
        console.log('✅ Navigation complete');
      }, 500);
      
    } catch (error) {
      console.error('❌ Error in switchToClassic:', error);
      setIsAnimating(false);
    }
  };

  return (
    <div className={`classic-style-switcher ${className}`}>
      <div className="switcher-header">
        <span className="switcher-icon">🎨</span>
        <span className="switcher-title">Switch Style</span>
      </div>
      
      {/* simple button switch */}
      <div className="button-container">
        <button
          onClick={switchToClassic}
          disabled={isAnimating}
          className={`style-btn classic-btn ${isClassicVersion ? 'active' : ''} ${
            isAnimating ? 'disabled' : ''
          }`}
          style={{ cursor: isAnimating ? 'not-allowed' : 'pointer' }}
        >
          📊 Classic
        </button>
        
        <button
          onClick={switchToShadcn}
          disabled={isAnimating}
          className={`style-btn modern-btn ${isShadcnVersion ? 'active' : ''} ${
            isAnimating ? 'disabled' : ''
          }`}
          style={{ cursor: isAnimating ? 'not-allowed' : 'pointer' }}
        >
          ✨ Modern
        </button>
      </div>
      
      {/* current style indicator */}
      <div className="current-style">
        <span className="indicator-label">Current:</span>
        <span className={`indicator-value ${isShadcnVersion ? 'modern' : 'classic'}`}>
          {isShadcnVersion ? 'Modern' : 'Classic'}
        </span>
      </div>
      
      {/* debug information */}
      <div style={{ fontSize: '10px', color: '#999', marginTop: '10px', textAlign: 'center' }}>
        Debug: {location.pathname}
      </div>
      
      {/* test button */}
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <button 
          onClick={() => console.log('🧪 Test button clicked!')}
          style={{ 
            padding: '5px 10px', 
            fontSize: '10px', 
            background: '#ff6b6b', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🧪 Test Click
        </button>
      </div>
    </div>
  );
};

export default ClassicStyleSwitcher;
