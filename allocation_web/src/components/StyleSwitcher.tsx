import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Palette, Monitor, Smartphone } from "lucide-react";

interface StyleSwitcherProps {
  className?: string;
}

const StyleSwitcher: React.FC<StyleSwitcherProps> = ({ className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isShadcnVersion = location.pathname.includes('student_modern');
  const isClassicVersion = location.pathname.includes('/student_classic');

  const switchToShadcn = () => {
    if (location.pathname.includes('/new_group')) {
      // if in group form page, switch to shadcn version
      const groupId = location.pathname.split('/').pop();
      if (groupId && groupId !== 'new_group') {
        navigate(`/student_modern/new_group/${groupId}`);
      } else {
        navigate('/student_modern/new_group');
      }
    } else {
      // if in main page, switch to modern version
      navigate('/student_modern');
    }
  };

  const switchToClassic = () => {
    if (location.pathname.includes('/new_group')) {
      // if in group form page, switch to classic version
      const groupId = location.pathname.split('/').pop();
      if (groupId && groupId !== 'new_group') {
        navigate(`/student_classic/new_group/${groupId}`);
      } else {
        navigate('/student_classic/new_group');
      }
    } else {
      // if in main page, switch to classic version
      navigate('/student_classic');
    }
  };

  return (
    <div className={`style-switcher ${className}`}>
      {/* shadcn/ui styles */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <Palette className="h-3 w-3" />
          <span>Style:</span>
        </div>
        
        <Button
          variant={isClassicVersion ? "default" : "outline"}
          size="sm"
          onClick={switchToClassic}
          className="h-8 px-3 text-xs"
        >
          <Monitor className="h-3 w-3 mr-1" />
          Classic
        </Button>
        
        <Button
          variant={isShadcnVersion ? "default" : "outline"}
          size="sm"
          onClick={switchToShadcn}
          className="h-8 px-3 text-xs"
        >
          <Smartphone className="h-3 w-3 mr-1" />
          Modern
        </Button>
      </div>
      
      {/* original styles */}
      <div className="style-buttons">
        <button
          className={`style-button ${isClassicVersion ? 'active' : ''}`}
          onClick={switchToClassic}
        >
          Classic
        </button>
        <button
          className={`style-button ${isShadcnVersion ? 'active' : ''}`}
          onClick={switchToShadcn}
        >
          Modern
        </button>
      </div>
    </div>
  );
};

export default StyleSwitcher;
