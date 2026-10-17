import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { BarChart3, FileText, Info } from "lucide-react";
import AnimatedStyleSwitcher from './AnimatedStyleSwitcher';

interface ShadcnSidebarProps {}

const ShadcnSidebar: React.FC<ShadcnSidebarProps> = () => {
  const [sidebarCompact, setSidebarCompact] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  // sidebar menu items
  const menuItems = [
    { id: 'info', label: 'Information', icon: Info, type: 'expand-panel', content: 'System Information and Help' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, type: 'navigate', route: '/student_modern' },
    { id: 'projects', label: 'Projects', icon: FileText, type: 'navigate', route: '/student_modern/projects_shadcn' }
  ];

  const handleItemClick = (itemId: string) => {
    const item = menuItems.find(menuItem => menuItem.id === itemId);
    if (item?.type === 'navigate' && item.route) {
      window.location.href = item.route;
    } else if (item?.type === 'expand-panel') {
      setExpandedPanel(expandedPanel === itemId ? null : itemId);
    }
  };

  const renderExpandedPanel = (itemId: string) => {
    switch (itemId) {
      case 'info':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-700">Student</p>
                <p className="text-xs text-gray-500">Student User</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="pt-2 border-t border-gray-200">
              <AnimatedStyleSwitcher />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
      sidebarCompact ? 'w-16' : 'w-64'
    }`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-center">
          <img 
            src="/logo_uni_tran.png" 
            alt="University Logo" 
            className={`transition-all duration-300 ${
              sidebarCompact ? 'h-8 w-8' : 'h-10 w-10'
            }`}
          />
        </div>
      </div>

      <nav className="p-2">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <div key={item.id} className="mb-2">
              {item.type === 'expand-panel' ? (
                <div>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start ${
                      sidebarCompact ? 'px-2' : 'px-4'
                    }`}
                    onClick={() => setExpandedPanel(expandedPanel === item.id ? null : item.id)}
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {!sidebarCompact && item.label}
                    {!sidebarCompact && (
                      <span className={`ml-auto transition-transform duration-200 ${
                        expandedPanel === item.id ? 'rotate-180' : ''
                      }`}>
                        ▼
                      </span>
                    )}
                  </Button>
                  
                  {/* Expandable Panels */}
                  {expandedPanel === item.id && !sidebarCompact && (
                    <div className="mt-2 ml-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {renderExpandedPanel(item.id)}
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${
                    sidebarCompact ? 'px-2' : 'px-4'
                  }`}
                  onClick={() => handleItemClick(item.id)}
                >
                  <IconComponent className="h-4 w-4 mr-2" />
                  {!sidebarCompact && item.label}
                </Button>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Toggle */}
      <div className="mt-auto p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCompact(!sidebarCompact)}
          className="w-full"
        >
          {sidebarCompact ? '→' : '←'}
        </Button>
      </div>
    </div>
  );
};

export default ShadcnSidebar;
