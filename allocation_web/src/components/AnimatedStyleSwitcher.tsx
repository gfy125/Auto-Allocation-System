import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Palette, Monitor, Smartphone } from "lucide-react";

interface AnimatedStyleSwitcherProps {
  className?: string;
  variant?: 'default' | 'compact';
}

const AnimatedStyleSwitcher: React.FC<AnimatedStyleSwitcherProps> = ({ 
  className = "", 
  variant = 'default' 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);

  const isShadcnVersion = location.pathname.includes('student_modern');
  const isClassicVersion = location.pathname.includes('/student_classic');
  
  // test mode
  const [testMode, setTestMode] = useState(false);
  
  // testing
  // console.log('=== ANIMATION DEBUG ===');
  // console.log('Current path:', location.pathname);
  // console.log('isShadcnVersion:', isShadcnVersion);
  // console.log('isClassicVersion:', isClassicVersion);
  // console.log('testMode:', testMode);
  // console.log('Transform value:', (isShadcnVersion && !testMode) ? 'translateX(48px)' : 'translateX(0px)');
  // console.log('======================');
  

  const switchToShadcn = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    // trigger sliding background animation to the left (Classic position)
    setTestMode(true);
    
    // wait for sliding animation to complete before redirecting
    setTimeout(() => {
      // add fade in effect
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.3s ease-out';
      
      setTimeout(() => {
        if (location.pathname.includes('/new_group')) {
          const groupId = location.pathname.split('/').pop();
          if (groupId && groupId !== 'new_group') {
            navigate(`/student_classic/new_group/${groupId}`);
          } else {
            navigate('/student_classic/new_group');
          }
        } else {
          navigate('/student_classic');
        }
        
        // add fade out effect
        setTimeout(() => {
          document.body.style.opacity = '1';
          document.body.style.transition = 'opacity 0.3s ease-in';
          setIsAnimating(false);
        }, 100);
      }, 300);
    }, 300); // wait for sliding animation to complete
  };

  const switchToClassic = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    // trigger sliding background animation to the left (Classic position)
    setTestMode(true);
    
    // wait for sliding animation to complete before redirecting
    setTimeout(() => {
      // add fade in effect
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.3s ease-out';
      
      setTimeout(() => {
        if (location.pathname.includes('/new_group')) {
          const groupId = location.pathname.split('/').pop();
          if (groupId && groupId !== 'new_group') {
            navigate(`/student_classic/new_group/${groupId}`);
          } else {
            navigate('/student_classic/new_group');
          }
        } else {
          navigate('/student_classic');
        }
        
        // add fade out effect
        setTimeout(() => {
          document.body.style.opacity = '1';
          document.body.style.transition = 'opacity 0.3s ease-in';
          setIsAnimating(false);
        }, 100);
      }, 300);
    }, 300); // wait for sliding animation to complete
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <Palette className="h-3 w-3" />
          <span>Style:</span>
        </div>
        
        <Button
          variant={isClassicVersion ? "default" : "outline"}
          size="sm"
          onClick={switchToClassic}
          className="h-8 px-3 text-xs"
          disabled={isAnimating}
        >
          <Monitor className="h-3 w-3 mr-1" />
          Classic
        </Button>
        
        <Button
          variant={isShadcnVersion ? "default" : "outline"}
          size="sm"
          onClick={switchToShadcn}
          className="h-8 px-3 text-xs"
          disabled={isAnimating}
        >
          <Smartphone className="h-3 w-3 mr-1" />
          Modern
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      <div className="text-xs text-gray-500 flex items-center space-x-1">
        <Palette className="h-3 w-3" />
        <span>Switch Style</span>
      </div>
      
      {/* Animated Toggle Switch */}
      <div className="relative">
        <div className="flex items-center justify-between bg-gray-200 rounded-full p-1 w-20 h-10">
          {/* Sliding Background */}
          <div 
            className={`absolute top-1 bottom-1 w-8 h-8 bg-white rounded-full shadow-md ${
              isShadcnVersion 
                ? 'translate-x-12' 
                : 'translate-x-0'
            } ${isAnimating ? 'scale-95' : 'scale-100'}`}
            style={{
              transition: 'transform 0.3s ease-in-out',
              transform: (isShadcnVersion && !testMode) ? 'translateX(48px)' : 'translateX(0px)'
            }}
          />
          
          {/* Classic Button */}
          <button
            onClick={switchToClassic}
            disabled={isAnimating}
            className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isClassicVersion 
                ? 'text-blue-600' 
                : 'text-gray-500'
            } ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          
          {/* Modern Button */}
          <button
            onClick={switchToShadcn}
            disabled={isAnimating}
            className={`relative z-10 w-30 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isShadcnVersion 
                ? 'text-blue-600' 
                : 'text-gray-500'
            } ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Labels */}
      <div className="flex justify-between w-20 text-xs">
        <span className={`transition-colors duration-200 ${
          isClassicVersion ? 'text-blue-600 font-medium' : 'text-gray-500'
        }`}>
          Classic
        </span>
        <span className={`transition-colors duration-200 ${
          isShadcnVersion ? 'text-blue-600 font-medium' : 'text-gray-500'
        }`}>
          Modern
        </span>
      </div>
      
      {/* Current Style Indicator */}
      <div className="text-xs text-gray-400">
        Current: {isShadcnVersion ? 'Modern' : 'Classic'}
      </div>
      
      {/* Test Button for Animation */}
      {/* <button
        onClick={() => setTestMode(!testMode)}
        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
      >
        {testMode ? 'Show Modern' : 'Show Classic'} (Test Animation)
      </button> */}
    </div>
  );
};

export default AnimatedStyleSwitcher;
