import React from 'react';
import Sidebar from './Sidebar';
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { DraggableResizableCard } from './DraggableResizableCard';
import './DraggableGrid.css';

interface AdminReportsAnalyticsProps {
  userRole: 'admin';
  onLogout: () => void;
  username: string;
}

interface CardLayout {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

const AdminReportsAnalytics: React.FC<AdminReportsAnalyticsProps> = ({ userRole, onLogout, username }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);

  // load report history from localStorage
  const [history, setHistory] = React.useState<any[]>([]);
  const [selectedTs, setSelectedTs] = React.useState<string>('');
  const [utilSort, setUtilSort] = React.useState<'full' | 'empty' | 'name'>('full');
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteSelection, setDeleteSelection] = React.useState<Record<string, boolean>>({});
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  // const [skillHoverIdx, setSkillHoverIdx] = React.useState<number | null>(null);
  const [hoverTagsIdx, setHoverTagsIdx] = React.useState<number | null>(null);
  const [hoverGroupIdx, setHoverGroupIdx] = React.useState<number | null>(null);
  const [hiddenTagsIdx, setHiddenTagsIdx] = React.useState<Set<number>>(new Set());
  const [hiddenGroupIdx, setHiddenGroupIdx] = React.useState<Set<number>>(new Set());
  const [radarHorizontalOffset, setRadarHorizontalOffset] = React.useState<number>(0);
  const [radarScale, setRadarScale] = React.useState<number>(1);
  const [groupRadarHorizontalOffset, setGroupRadarHorizontalOffset] = React.useState<number>(0);
  const [groupRadarScale, setGroupRadarScale] = React.useState<number>(1);
  const [expandedGroupId, setExpandedGroupId] = React.useState<number | null>(null);
  const [expandedRiskGroupId, setExpandedRiskGroupId] = React.useState<number | null>(null);
  const [expandedUnallocatedGroupId, setExpandedUnallocatedGroupId] = React.useState<number | null>(null);
  const [resultSortBy, setResultSortBy] = React.useState<'comprehensive' | 'score' | 'preference' | 'descSim' | 'skillMatch'>('comprehensive');
  const [visibleCards, setVisibleCards] = React.useState<Record<string, boolean>>({
    overview: true,
    scoreDistribution: true,
    descriptionMatching: true,
    skillMatching: true,
    projectRiskFlags: true,
    skillCoverage: true,
    projectTagsRadar: true,
    groupRiskFlags: true,
    groupSkillsRadar: true,
    unallocated: true,
  });
  const [showLayoutPanel, setShowLayoutPanel] = React.useState(false);
  const [layoutAction, setLayoutAction] = React.useState<'load' | 'save' | null>(null);
  const [selectedLayoutSlot, setSelectedLayoutSlot] = React.useState<number | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = React.useState(false);
  const [cardZIndexes, setCardZIndexes] = React.useState<Record<string, number>>({});
  const [maxZIndex, setMaxZIndex] = React.useState(1);

  // Card layouts state
  const [cardLayouts, setCardLayouts] = React.useState<Record<string, CardLayout>>({
    overview: { id: 'overview', position: { x: 20, y: 80 }, size: { width: 300, height: 280 } },
    scoreDistribution: { id: 'scoreDistribution', position: { x: 340, y: 80 }, size: { width: 400, height: 280 } },
    descriptionMatching: { id: 'descriptionMatching', position: { x: 760, y: 80 }, size: { width: 400, height: 280 } },
    skillMatching: { id: 'skillMatching', position: { x: 1180, y: 80 }, size: { width: 400, height: 280 } },
    projectRiskFlags: { id: 'projectRiskFlags', position: { x: 20, y: 380 }, size: { width: 600, height: 400 } },
    skillCoverage: { id: 'skillCoverage', position: { x: 640, y: 380 }, size: { width: 600, height: 400 } },
    projectTagsRadar: { id: 'projectTagsRadar', position: { x: 20, y: 800 }, size: { width: 600, height: 420 } },
    groupRiskFlags: { id: 'groupRiskFlags', position: { x: 640, y: 800 }, size: { width: 600, height: 420 } },
    groupSkillsRadar: { id: 'groupSkillsRadar', position: { x: 1260, y: 800 }, size: { width: 600, height: 420 } },
    unallocated: { id: 'unallocated', position: { x: 20, y: 1240 }, size: { width: 1200, height: 300 } },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('allocationReports');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        setHistory(list);
        // default to latest
        if (list.length > 0) {
          setSelectedTs(list[list.length - 1].timestamp);
        }
      }
    } catch (_) {}
  }, []);

  const current = React.useMemo(() => {
    return history.find((e) => e.timestamp === selectedTs) || null;
  }, [history, selectedTs]);
  const report = current?.report || null;
  const sortedUtil = React.useMemo(() => {
    const list = (report?.analytics?.capacityUtilization || []).slice();
    if (!list || list.length === 0) return [];
    if (utilSort === 'full') {
      // sort by fill ratio desc
      return list.sort((a: any, b: any) => (b.used / Math.max(1, b.capacity)) - (a.used / Math.max(1, a.capacity)));
    }
    if (utilSort === 'empty') {
      // sort by remaining desc
      return list.sort((a: any, b: any) => (b.remaining || 0) - (a.remaining || 0));
    }
    return list.sort((a: any, b: any) => String(a.projectName).localeCompare(String(b.projectName)));
  }, [report, utilSort]);

  // Sorted results for Allocated Result Summary
  const sortedResults = React.useMemo(() => {
    const list = (report?.results || []).slice();
    if (!list || list.length === 0) return [];
    
    if (resultSortBy === 'score') {
      // Sort by score descending (higher scores first), null/undefined at the end
      return list.sort((a: any, b: any) => {
        const scoreA = a.score ?? -Infinity;
        const scoreB = b.score ?? -Infinity;
        return scoreB - scoreA;
      });
    }
    
    if (resultSortBy === 'preference') {
      // Sort by preference ascending (lower preference number = higher priority), null/undefined at the end
      return list.sort((a: any, b: any) => {
        const prefA = a.preferenceRank ?? Infinity;
        const prefB = b.preferenceRank ?? Infinity;
        return prefA - prefB;
      });
    }
    
    if (resultSortBy === 'descSim') {
      // Sort by description similarity descending (higher similarity first), null/undefined at the end
      return list.sort((a: any, b: any) => {
        const descSimA = a.descSim ?? -Infinity;
        const descSimB = b.descSim ?? -Infinity;
        return descSimB - descSimA;
      });
    }
    
    if (resultSortBy === 'skillMatch') {
      // Sort by skill matching descending (higher match first), null/undefined at the end
      return list.sort((a: any, b: any) => {
        const skillA = a.skillMatch ?? -Infinity;
        const skillB = b.skillMatch ?? -Infinity;
        return skillB - skillA;
      });
    }
    
    // Comprehensive sort (default): combination of preference, score, descSim, and skillMatch
    // Priority: 1) Lower preference rank, 2) Higher score, 3) Higher descSim, 4) Higher skillMatch
    return list.sort((a: any, b: any) => {
      const prefA = a.preferenceRank ?? Infinity;
      const prefB = b.preferenceRank ?? Infinity;
      
      // First compare by preference
      if (prefA !== prefB) {
        return prefA - prefB;
      }
      
      // If preference is the same, compare by score (higher is better)
      const scoreA = a.score ?? -Infinity;
      const scoreB = b.score ?? -Infinity;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      
      // If score is also the same, compare by descSim (higher is better)
      const descSimA = a.descSim ?? -Infinity;
      const descSimB = b.descSim ?? -Infinity;
      
      if (descSimA !== descSimB) {
        return descSimB - descSimA;
      }
      
      // Finally compare by skillMatch (higher is better)
      const skillA = a.skillMatch ?? -Infinity;
      const skillB = b.skillMatch ?? -Infinity;
      return skillB - skillA;
    });
  }, [report?.results, resultSortBy]);

  // Update localStorage when sort order changes
  React.useEffect(() => {
    if (!report || !sortedResults || sortedResults.length === 0) return;
    
    try {
      const raw = localStorage.getItem('allocationReports');
      const allReports = raw ? JSON.parse(raw) : [];
      
      // Find current report and update its results
      const updatedReports = allReports.map((r: any) => {
        if (r.timestamp === selectedTs) {
          return {
            ...r,
            report: {
              ...r.report,
              results: sortedResults
            }
          };
        }
        return r;
      });
      
      localStorage.setItem('allocationReports', JSON.stringify(updatedReports));
      
      // Also update the history state to reflect changes
      setHistory(updatedReports);
    } catch (err) {
      console.error('Failed to update localStorage:', err);
    }
  }, [sortedResults, selectedTs, report]);

  React.useEffect(() => {
    const handleSidebarStateChange = () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const isCompact = sidebar.classList.contains('compact');
        const showLabels = sidebar.classList.contains('show-labels');
        setSidebarCompact(isCompact);
        setSidebarShowLabels(showLabels);
      }
    };

    const observer = new MutationObserver(handleSidebarStateChange);
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    return () => observer.disconnect();
  }, []);

  // Load saved layouts from localStorage
  React.useEffect(() => {
    try {
      const savedLayouts = localStorage.getItem('adminReportsLayouts');
      if (savedLayouts) {
        setCardLayouts(JSON.parse(savedLayouts));
      }
    } catch (_) {}
  }, []);

  // Save layouts to localStorage when they change
  React.useEffect(() => {
    localStorage.setItem('adminReportsLayouts', JSON.stringify(cardLayouts));
  }, [cardLayouts]);

  const handleDragStart = (event: any) => {
    const id = event.active.id as string;
    // 将拖动的卡片置顶
    setMaxZIndex((prev) => {
      const newZIndex = prev + 1;
      setCardZIndexes((zIndexes) => ({
        ...zIndexes,
        [id]: newZIndex,
      }));
      return newZIndex;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const id = active.id as string;
    
    if (delta) {
      setCardLayouts(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          position: {
            x: prev[id].position.x + delta.x,
            y: prev[id].position.y + delta.y,
          },
        },
      }));
    }
  };

  const handleSizeChange = (id: string, size: { width: number; height: number }) => {
    setCardLayouts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        size,
      },
    }));
  };

  const resetLayouts = () => {
    const defaultLayouts: Record<string, CardLayout> = {
      overview: { id: 'overview', position: { x: 20, y: 80 }, size: { width: 300, height: 280 } },
      scoreDistribution: { id: 'scoreDistribution', position: { x: 340, y: 80 }, size: { width: 400, height: 280 } },
      descriptionMatching: { id: 'descriptionMatching', position: { x: 760, y: 80 }, size: { width: 400, height: 280 } },
      skillMatching: { id: 'skillMatching', position: { x: 1180, y: 80 }, size: { width: 400, height: 280 } },
      projectRiskFlags: { id: 'projectRiskFlags', position: { x: 20, y: 380 }, size: { width: 600, height: 400 } },
      skillCoverage: { id: 'skillCoverage', position: { x: 640, y: 380 }, size: { width: 600, height: 400 } },
      projectTagsRadar: { id: 'projectTagsRadar', position: { x: 20, y: 800 }, size: { width: 600, height: 420 } },
      groupRiskFlags: { id: 'groupRiskFlags', position: { x: 640, y: 800 }, size: { width: 600, height: 420 } },
      groupSkillsRadar: { id: 'groupSkillsRadar', position: { x: 1260, y: 800 }, size: { width: 600, height: 420 } },
      unallocated: { id: 'unallocated', position: { x: 20, y: 1240 }, size: { width: 1200, height: 300 } },
    };
    setCardLayouts(defaultLayouts);
    localStorage.setItem('adminReportsLayouts', JSON.stringify(defaultLayouts));
  };

  const autoOrganizeLayouts = () => {
    // 获取可见卡片列表
    const visibleCardsList = Object.keys(cardLayouts).filter(id => visibleCards[id]);
    
    // 按高度排序（小组件在上，大组件在下）
    const sortedCards = visibleCardsList
      .map(cardId => ({
        ...cardLayouts[cardId],
        id: cardId
      }))
      .sort((a, b) => a.size.height - b.size.height);

    // 自动布局参数
    const containerWidth = 1800; // 假设容器宽度
    const startY = 80; // 起始Y位置
    const gap = 12; // 卡片间距
    const padding = 20; // 边距

    let currentX = padding;
    let currentY = startY;
    let rowHeight = 0;
    const newLayouts: Record<string, CardLayout> = { ...cardLayouts };

    sortedCards.forEach((card) => {
      // 如果当前行放不下，换行
      if (currentX + card.size.width > containerWidth && currentX > padding) {
        currentX = padding;
        currentY += rowHeight + gap;
        rowHeight = 0;
      }

      // 放置卡片
      newLayouts[card.id] = {
        ...card,
        position: { x: currentX, y: currentY }
      };

      // 更新位置和行高
      currentX += card.size.width + gap;
      rowHeight = Math.max(rowHeight, card.size.height);
    });

    setCardLayouts(newLayouts);
    localStorage.setItem('adminReportsLayouts', JSON.stringify(newLayouts));
  };

  // 获取保存的布局列表
  const getSavedLayouts = () => {
    try {
      const saved = localStorage.getItem('adminReportsSavedLayouts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  // 保存当前布局到指定槽位
  const saveLayoutToSlot = (slot: number) => {
    const savedLayouts = getSavedLayouts();
    savedLayouts[slot] = {
      timestamp: new Date().toISOString(),
      layouts: cardLayouts,
      visibleCards: visibleCards,
      radarSettings: {
        projectTags: {
          horizontalOffset: radarHorizontalOffset,
          scale: radarScale,
        },
        groupSkills: {
          horizontalOffset: groupRadarHorizontalOffset,
          scale: groupRadarScale,
        },
      },
    };
    localStorage.setItem('adminReportsSavedLayouts', JSON.stringify(savedLayouts));
    setShowLayoutPanel(false);
    setLayoutAction(null);
    setSelectedLayoutSlot(null);
    setShowOverwriteConfirm(false);
  };

  // 加载指定槽位的布局
  const loadLayoutFromSlot = (slot: number) => {
    const savedLayouts = getSavedLayouts();
    const layout = savedLayouts[slot];
    if (layout) {
      setCardLayouts(layout.layouts);
      setVisibleCards(layout.visibleCards);
      // 加载 radar 设置
      if (layout.radarSettings) {
        if (layout.radarSettings.projectTags) {
          setRadarHorizontalOffset(layout.radarSettings.projectTags.horizontalOffset || 0);
          setRadarScale(layout.radarSettings.projectTags.scale || 1);
        }
        if (layout.radarSettings.groupSkills) {
          setGroupRadarHorizontalOffset(layout.radarSettings.groupSkills.horizontalOffset || 0);
          setGroupRadarScale(layout.radarSettings.groupSkills.scale || 1);
        }
      }
      localStorage.setItem('adminReportsLayouts', JSON.stringify(layout.layouts));
      setShowLayoutPanel(false);
      setLayoutAction(null);
      setSelectedLayoutSlot(null);
    }
  };

  // 删除指定槽位的布局
  const deleteLayoutSlot = (slot: number) => {
    const savedLayouts = getSavedLayouts();
    delete savedLayouts[slot];
    localStorage.setItem('adminReportsSavedLayouts', JSON.stringify(savedLayouts));
    setShowLayoutPanel(false);
    setLayoutAction(null);
    setSelectedLayoutSlot(null);
  };

  // 点击外部关闭导出菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-export-menu]')) {
          setShowExportMenu(false);
        }
      }
    };
    
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // 导出功能 - CSV
  const exportToCSV = () => {
    if (!report) return;
    
    // 从 localStorage 获取完整的原始 JSON 数据
    const raw = localStorage.getItem('allocationReports');
    if (!raw) {
      alert('No report data found in localStorage');
      return;
    }
    const allReports = JSON.parse(raw);
    const currentReport = allReports.find((r: any) => r.timestamp === selectedTs);
    if (!currentReport) {
      alert('Current report not found in localStorage');
      return;
    }
    
    const reportData = currentReport.report;
    
    const csvData: string[] = [];
    
    // 添加标题
    csvData.push('Reports & Analytics Export');
    csvData.push(`Generated: ${reportData.generatedAt || currentReport.timestamp}`);
    csvData.push('');
    
    // 1. Overview
    csvData.push('=== Overview ===');
    csvData.push('Metric,Value');
    csvData.push(`Total Allocated Results,${reportData.resultsCount || 0}`);
    csvData.push(`Total Unallocated Groups,${reportData.unallocatedCount || 0}`);
    csvData.push('');
    csvData.push('=== Allocation Engine Settings ===,');
    csvData.push(`Skill Weight,${reportData.analytics?.settings?.weights?.skillWeight ?? 'N/A'}`);
    csvData.push(`Score Weight,${reportData.analytics?.settings?.weights?.scoreWeight ?? 'N/A'}`);
    csvData.push(`Description Weight,${reportData.analytics?.settings?.weights?.descriptionWeight ?? 'N/A'}`);
    csvData.push(`Min Group Size,${reportData.analytics?.settings?.minGroupSize ?? 'N/A'}`);
    csvData.push(`Max Group Size,${reportData.analytics?.settings?.maxGroupSize ?? 'N/A'}`);
    csvData.push('');
    csvData.push('=== Statistics ===,');
    csvData.push(`Average Score,${reportData.analytics?.score?.average?.toFixed(2) ?? 'N/A'}`);
    csvData.push(`Average DescSim,${reportData.analytics?.descriptionSimilarity?.average?.toFixed(2) ?? 'N/A'}`);
    csvData.push(`Average Skill Match,${reportData.analytics?.skillMatching?.average?.toFixed(2) ?? 'N/A'}`);
    csvData.push('');
    
    // 2. Allocated Results - 每种排序
    if (report.results && report.results.length > 0) {
      const sortTypes: Array<{type: 'comprehensive' | 'score' | 'preference' | 'descSim' | 'skillMatch', name: string}> = [
        { type: 'comprehensive', name: 'Comprehensive' },
        { type: 'score', name: 'Score' },
        { type: 'preference', name: 'Preference' },
        { type: 'descSim', name: 'DescSim' },
        { type: 'skillMatch', name: 'Skill' }
      ];
      
      sortTypes.forEach(({ type: sortType, name }) => {
        csvData.push(`=== Allocated Results (${name}) ===`);
        csvData.push('Group Name,Project Name,Score,DescSim,Skill Match (%),Pref Rank,Member Name,Student ID,UniKey,Enroll Course');
        
        const sorted = [...report.results].sort((a: any, b: any) => {
          if (sortType === 'score') {
            return (b.score ?? -Infinity) - (a.score ?? -Infinity);
          } else if (sortType === 'preference') {
            return (a.preferenceRank ?? Infinity) - (b.preferenceRank ?? Infinity);
          } else if (sortType === 'descSim') {
            return (b.descSim ?? -Infinity) - (a.descSim ?? -Infinity);
          } else if (sortType === 'skillMatch') {
            return (b.skillMatch ?? -Infinity) - (a.skillMatch ?? -Infinity);
          } else {
            const prefA = a.preferenceRank ?? Infinity;
            const prefB = b.preferenceRank ?? Infinity;
            if (prefA !== prefB) return prefA - prefB;
            const scoreA = a.score ?? -Infinity;
            const scoreB = b.score ?? -Infinity;
            if (scoreA !== scoreB) return scoreB - scoreA;
            const descSimA = a.descSim ?? -Infinity;
            const descSimB = b.descSim ?? -Infinity;
            if (descSimA !== descSimB) return descSimB - descSimA;
            const skillA = a.skillMatch ?? -Infinity;
            const skillB = b.skillMatch ?? -Infinity;
            return skillB - skillA;
          }
        });
        
        sorted.forEach((r: any) => {
          const members = r.members || [];
          if (members.length === 0) {
            csvData.push(`"${r.groupName}","${r.projectName}",${r.score?.toFixed(1) || 'N/A'},${r.descSim?.toFixed(2) || 'N/A'},${r.skillMatch?.toFixed(1) || 'N/A'},${r.preferenceRank || 'N/A'},,,,`);
          } else {
            members.forEach((m: any, idx: number) => {
              const groupName = idx === 0 ? `"${r.groupName}"` : '';
              const projectName = idx === 0 ? `"${r.projectName}"` : '';
              const score = idx === 0 ? (r.score?.toFixed(1) || 'N/A') : '';
              const descSim = idx === 0 ? (r.descSim?.toFixed(2) || 'N/A') : '';
              const skillMatch = idx === 0 ? (r.skillMatch?.toFixed(1) || 'N/A') : '';
              const prefRank = idx === 0 ? (r.preferenceRank || 'N/A') : '';
              csvData.push(`${groupName},${projectName},${score},${descSim},${skillMatch},${prefRank},"${m.studentName || ''}","${m.studentId || ''}","${m.uniKey || ''}","${m.unitOfStudy || ''}"`);
            });
          }
        });
        csvData.push('');
      });
    }
    
    // 3. Matching
    if (report.analytics) {
      csvData.push('=== Matching ===');
      csvData.push('Metric,Average,Histogram Data');
      
      if (report.analytics.scoreMatching) {
        const hist = report.analytics.scoreMatching.histogram?.map((h: any) => `${h.label}: ${h.count}`).join('; ') || '';
        csvData.push(`Score Matching,${report.analytics.scoreMatching.average?.toFixed(2) || 'N/A'},"${hist}"`);
      }
      
      if (report.analytics.descriptionMatching) {
        const hist = report.analytics.descriptionMatching.histogram?.map((h: any) => `${h.label}: ${h.count}`).join('; ') || '';
        csvData.push(`Description Matching,${report.analytics.descriptionMatching.average?.toFixed(2) || 'N/A'},"${hist}"`);
      }
      
      if (report.analytics.skillMatching) {
        const hist = report.analytics.skillMatching.histogram?.map((h: any) => `${h.label}: ${h.count}`).join('; ') || '';
        csvData.push(`Skill Matching,${report.analytics.skillMatching.average?.toFixed(2) || 'N/A'},"${hist}"`);
      }
      csvData.push('');
    }
    
    // 4. Project Utilization
    if (report.analytics?.projectUtilization) {
      const fullFirstSorted = [...sortedUtil].sort((a: any, b: any) => {
        const ratioA = a.used / Math.max(1, a.capacity);
        const ratioB = b.used / Math.max(1, b.capacity);
        return ratioB - ratioA;
      });
      
      csvData.push('=== Project Utilization ===');
      csvData.push('Project Name,Capacity,Used,Remaining,Fill Ratio (%)');
      fullFirstSorted.forEach((p: any) => {
        const ratio = Math.min(100, Math.round((p.used / Math.max(1, p.capacity)) * 100));
        csvData.push(`"${p.projectName}",${p.capacity},${p.used},${p.remaining || 0},${ratio}`);
      });
      csvData.push('');
    }
    
    // 5. Project Tags Radar
    if (report.analytics?.radars?.projectTags) {
      csvData.push('=== Project Tags Radar ===');
      csvData.push('Skill/Tag,Count');
      report.analytics.radars.projectTags.forEach((item: any) => {
        csvData.push(`"${item.label}",${item.count}`);
      });
      csvData.push('');
    }
    
    // 6. Group Skills Radar
    if (report.analytics?.radars?.groupSkills) {
      csvData.push('=== Group Skills Radar ===');
      csvData.push('Skill,Count');
      report.analytics.radars.groupSkills.forEach((item: any) => {
        csvData.push(`"${item.label}",${item.count}`);
      });
      csvData.push('');
    }
    
    // 7. Group Risk Flags
    csvData.push('=== Group Risk Flags ===');
    csvData.push('Group Name,Member Name,Student ID,UniKey,Enroll Course,Risk Type');
    
    if (report.analytics?.riskFlags?.undersizedGroups) {
      report.analytics.riskFlags.undersizedGroups.forEach((g: any) => {
        const members = g.members || [];
        if (members.length === 0) {
          csvData.push(`"${g.groupName}",,,,,"Undersized"`);
        } else {
          members.forEach((m: any, idx: number) => {
            const groupName = idx === 0 ? `"${g.groupName}"` : '';
            const riskType = idx === 0 ? 'Undersized' : '';
            csvData.push(`${groupName},"${m.studentName || ''}","${m.studentId || ''}","${m.uniKey || ''}","${m.unitOfStudy || ''}",${riskType}`);
          });
        }
      });
    }
    
    if (report.analytics?.riskFlags?.manualAllocations) {
      report.analytics.riskFlags.manualAllocations.forEach((g: any) => {
        const members = g.members || [];
        if (members.length === 0) {
          csvData.push(`"${g.groupName}",,,,,"Manual Allocation"`);
        } else {
          members.forEach((m: any, idx: number) => {
            const groupName = idx === 0 ? `"${g.groupName}"` : '';
            const riskType = idx === 0 ? 'Manual Allocation' : '';
            csvData.push(`${groupName},"${m.studentName || ''}","${m.studentId || ''}","${m.uniKey || ''}","${m.unitOfStudy || ''}",${riskType}`);
          });
        }
      });
    }
    csvData.push('');
    
    // 8. Unallocated Groups
    if (report.unallocatedGroups) {
      csvData.push('=== Unallocated Groups ===');
      csvData.push('Group Name,Member Name,Student ID,UniKey,Enroll Course');
      
      report.unallocatedGroups.forEach((g: any) => {
        const members = g.members || [];
        if (members.length === 0) {
          csvData.push(`"${g.groupName}",,,,`);
        } else {
          members.forEach((m: any, idx: number) => {
            const groupName = idx === 0 ? `"${g.groupName}"` : '';
            csvData.push(`${groupName},"${m.studentName || ''}","${m.studentId || ''}","${m.uniKey || ''}","${m.unitOfStudy || ''}"`);
          });
        }
      });
      csvData.push('');
    }
    
    // 下载CSV
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setShowExportMenu(false);
  };

  const exportToXLSX = async () => {
    try {
      const XLSX = await import('xlsx');
      const { getExportData } = await import('../api/allocationApi');
      if (!report) return;
      
      // 从 localStorage 获取完整的原始 JSON 数据
      const raw = localStorage.getItem('allocationReports');
      if (!raw) {
        alert('No report data found in localStorage');
        return;
      }
      const allReports = JSON.parse(raw);
      const currentReport = allReports.find((r: any) => r.timestamp === selectedTs);
      if (!currentReport) {
        alert('Current report not found in localStorage');
        return;
      }
      
      // 获取导出所需的额外数据
      const exportDataResponse = await getExportData();
      if (!exportDataResponse.success) {
        alert('Failed to fetch export data');
        return;
      }
      const exportData = exportDataResponse.data;
      
      const reportData = currentReport.report;
      
      const wb = XLSX.utils.book_new();
      
      // 1. Overview Sheet - 使用原始JSON中的所有数据
      const overviewData = [
        ['Metric', 'Value'],
        ['Generated At', reportData.generatedAt || currentReport.timestamp],
        ['Total Allocated Results', reportData.resultsCount || 0],
        ['Total Unallocated Groups', reportData.unallocatedCount || 0],
        [''],
        ['=== Allocation Engine Settings ===', ''],
        ['Skill Weight', reportData.analytics?.settings?.weights?.skillWeight ?? 'N/A'],
        ['Score Weight', reportData.analytics?.settings?.weights?.scoreWeight ?? 'N/A'],
        ['Description Weight', reportData.analytics?.settings?.weights?.descriptionWeight ?? 'N/A'],
        ['Min Group Size', reportData.analytics?.settings?.minGroupSize ?? 'N/A'],
        ['Max Group Size', reportData.analytics?.settings?.maxGroupSize ?? 'N/A'],
        [''],
        ['=== Comprehensive Score Statistics ===', ''],
        ['Average Comprehensive Score', reportData.analytics?.score?.average?.toFixed(2) ?? 'N/A'],
        [''],
        ['=== Description Similarity Statistics ===', ''],
        ['Average DescSim', reportData.analytics?.descriptionSimilarity?.average?.toFixed(2) ?? 'N/A'],
        [''],
        ['=== Skill Matching Statistics ===', ''],
        ['Average Skill Match', reportData.analytics?.skillMatching?.average?.toFixed(2) ?? 'N/A']
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');
      
      // 2. Allocated Results - 合并为一个表，包含所有排序列
      const allocatedResultsData = [['Group Name', 'Project Name', 'Project ID', 'Comprehensive Score', 'Description Similarity', 'Skill Match (%)', 'Pref Rank', 'Member Name', 'Student ID', 'UniKey', 'Enroll Course', 'Sort: Comprehensive', 'Sort: Score', 'Sort: Preference', 'Sort: DescSim', 'Sort: Skill']];
      
      if (reportData.results && reportData.results.length > 0) {
        // 计算5种排序的排名
        const getSortRanks = (results: any[]) => {
          const sortTypes = ['comprehensive', 'score', 'preference', 'descSim', 'skillMatch'];
          const ranks: Record<string, Record<number, number>> = {};
          
          sortTypes.forEach((sortType) => {
            const sorted = [...results].sort((a: any, b: any) => {
              if (sortType === 'score') {
                return (b.score ?? -Infinity) - (a.score ?? -Infinity);
              } else if (sortType === 'preference') {
                return (a.preferenceRank ?? Infinity) - (b.preferenceRank ?? Infinity);
              } else if (sortType === 'descSim') {
                return (b.descSim ?? -Infinity) - (a.descSim ?? -Infinity);
              } else if (sortType === 'skillMatch') {
                return (b.skillMatch ?? -Infinity) - (a.skillMatch ?? -Infinity);
              } else {
                const prefA = a.preferenceRank ?? Infinity;
                const prefB = b.preferenceRank ?? Infinity;
                if (prefA !== prefB) return prefA - prefB;
                const scoreA = a.score ?? -Infinity;
                const scoreB = b.score ?? -Infinity;
                if (scoreA !== scoreB) return scoreB - scoreA;
                const descSimA = a.descSim ?? -Infinity;
                const descSimB = b.descSim ?? -Infinity;
                if (descSimA !== descSimB) return descSimB - descSimA;
                const skillA = a.skillMatch ?? -Infinity;
                const skillB = b.skillMatch ?? -Infinity;
                return skillB - skillA;
              }
            });
            
            ranks[sortType] = {};
            sorted.forEach((r: any, idx: number) => {
              ranks[sortType][r.groupId] = idx + 1;
            });
          });
          
          return ranks;
        };
        
        const sortRanks = getSortRanks(reportData.results);
        
        reportData.results.forEach((r: any) => {
          const members = r.members || [];
          if (members.length === 0) {
            allocatedResultsData.push([
              r.groupName,
              r.projectName,
              r.projectId,
              r.score?.toFixed(1) || 'N/A',
              r.descSim?.toFixed(2) || 'N/A',
              r.skillMatch?.toFixed(1) || 'N/A',
              r.preferenceRank || 'N/A',
              '', '', '', '',
              sortRanks.comprehensive[r.groupId],
              sortRanks.score[r.groupId],
              sortRanks.preference[r.groupId],
              sortRanks.descSim[r.groupId],
              sortRanks.skillMatch[r.groupId]
            ]);
          } else {
            members.forEach((m: any, idx: number) => {
              allocatedResultsData.push([
                idx === 0 ? r.groupName : '',
                idx === 0 ? r.projectName : '',
                idx === 0 ? r.projectId : '',
                idx === 0 ? (r.score?.toFixed(1) || 'N/A') : '',
                idx === 0 ? (r.descSim?.toFixed(2) || 'N/A') : '',
                idx === 0 ? (r.skillMatch?.toFixed(1) || 'N/A') : '',
                idx === 0 ? (r.preferenceRank || 'N/A') : '',
                m.studentName || '',
                m.studentId || '',
                m.uniKey || '',
                m.unitOfStudy || '',
                idx === 0 ? sortRanks.comprehensive[r.groupId] : '',
                idx === 0 ? sortRanks.score[r.groupId] : '',
                idx === 0 ? sortRanks.preference[r.groupId] : '',
                idx === 0 ? sortRanks.descSim[r.groupId] : '',
                idx === 0 ? sortRanks.skillMatch[r.groupId] : ''
              ]);
            });
          }
        });
      }
      
      const wsAllocatedResults = XLSX.utils.aoa_to_sheet(allocatedResultsData);
      XLSX.utils.book_append_sheet(wb, wsAllocatedResults, 'Allocated Results');
      
      // 3. Comprehensive Score - 使用exportData补充HD, D, CR, PS数据
      const scoreMatchData = [['Group ID', 'Group Name', 'Project ID', 'Project Name', 'Score', 'HD', 'D', 'CR', 'PS']];
      if (reportData.results) {
        reportData.results.forEach((r: any) => {
          const groupData = exportData.groups[r.groupId];
          scoreMatchData.push([
            r.groupId,
            r.groupName,
            r.projectId,
            r.projectName,
            r.score?.toFixed(2) ?? 'N/A',
            groupData?.numStudentsHD ?? 'N/A',
            groupData?.numStudentsD ?? 'N/A',
            groupData?.numStudentsCR ?? 'N/A',
            groupData?.numStudentsP ?? 'N/A'
          ]);
        });
      }
      scoreMatchData.push([]);
      scoreMatchData.push(['Statistics', '', '', '', '']);
      scoreMatchData.push(['Average Score', reportData.analytics?.score?.average?.toFixed(2) ?? 'N/A', '', '', '']);
      scoreMatchData.push([]);
      scoreMatchData.push(['Histogram', '', '', '', '']);
      scoreMatchData.push(['Range', 'Count', '', '', '']);
      if (reportData.analytics?.score?.histogram) {
        reportData.analytics.score.histogram.forEach((h: any) => {
          scoreMatchData.push([h.label || h.bucket, h.count, '', '', '']);
        });
      }
      const wsScoreMatch = XLSX.utils.aoa_to_sheet(scoreMatchData);
      XLSX.utils.book_append_sheet(wb, wsScoreMatch, 'Comprehensive Score');
      
      // 4. Matching Description - 使用exportData补充Project和Group Description
      const descMatchData = [['Group ID', 'Group Name', 'Project ID', 'Project Name', 'DescSim', 'Group Description', 'Project Description', 'Expected Outcomes', 'Required Skills']];
      if (reportData.results) {
        reportData.results.forEach((r: any) => {
          const projectData = exportData.projects[r.projectId];
          const groupData = exportData.groups[r.groupId];
          descMatchData.push([
            r.groupId,
            r.groupName,
            r.projectId,
            r.projectName,
            r.descSim?.toFixed(4) ?? 'N/A',
            groupData?.groupDescription || 'N/A',
            projectData?.projectDescription || 'N/A',
            projectData?.expectedOutcomes || 'N/A',
            projectData?.requiredSkills || 'N/A'
          ]);
        });
      }
      descMatchData.push([]);
      descMatchData.push(['Statistics', '']);
      descMatchData.push(['Average DescSim', reportData.analytics?.descriptionSimilarity?.average?.toFixed(4) ?? 'N/A']);
      descMatchData.push([]);
      descMatchData.push(['Histogram', '']);
      descMatchData.push(['Range', 'Count']);
      if (reportData.analytics?.descriptionSimilarity?.histogram) {
        reportData.analytics.descriptionSimilarity.histogram.forEach((h: any) => {
          descMatchData.push([h.label || h.bucket, h.count]);
        });
      }
      const wsDescMatch = XLSX.utils.aoa_to_sheet(descMatchData);
      XLSX.utils.book_append_sheet(wb, wsDescMatch, 'Matching Description');
      
      // 5. Matching Skill - 使用exportData补充group_skills和project.tags
      const skillMatchData = [['Group ID', 'Group Name', 'Project ID', 'Project Name', 'Skill Match (%)', 'Group Skills', 'Project Tags']];
      if (reportData.results) {
        reportData.results.forEach((r: any) => {
          const groupSkills = (exportData.groupSkills[r.groupId] || []).join(', ');
          const projectTags = (exportData.projects[r.projectId]?.tags || []).join(', ');
          skillMatchData.push([
            r.groupId,
            r.groupName,
            r.projectId,
            r.projectName,
            r.skillMatch?.toFixed(2) ?? 'N/A',
            groupSkills || 'N/A',
            projectTags || 'N/A'
          ]);
        });
      }
      skillMatchData.push([]);
      skillMatchData.push(['Statistics', '']);
      skillMatchData.push(['Average Skill Match', reportData.analytics?.skillMatching?.average?.toFixed(2) ?? 'N/A']);
      skillMatchData.push([]);
      skillMatchData.push(['Histogram', '']);
      skillMatchData.push(['Range', 'Count']);
      if (reportData.analytics?.skillMatching?.histogram) {
        reportData.analytics.skillMatching.histogram.forEach((h: any) => {
          skillMatchData.push([h.label || h.bucket, h.count]);
        });
      }
      const wsSkillMatch = XLSX.utils.aoa_to_sheet(skillMatchData);
      XLSX.utils.book_append_sheet(wb, wsSkillMatch, 'Skill Matching');
      
      // 6. Project Utilization - Enrolled Groups 作为多行显示
      const utilizationData = [['Project ID', 'Project Name', 'Capacity', 'Used', 'Remaining', 'Fill Ratio (%)', 'Enrolled Group ID', 'Enrolled Group Name']];
      if (reportData.analytics?.capacityUtilization) {
        const fullFirstSorted = [...reportData.analytics.capacityUtilization].sort((a: any, b: any) => {
          const ratioA = a.used / Math.max(1, a.capacity);
          const ratioB = b.used / Math.max(1, b.capacity);
          return ratioB - ratioA;
        });
        
        fullFirstSorted.forEach((p: any) => {
          const enrolledGroups = exportData.enrolledGroupsByProject[p.projectId] || [];
          
          if (enrolledGroups.length === 0) {
            utilizationData.push([
              p.projectId,
              p.projectName,
              p.capacity,
              p.used,
              p.remaining || 0,
              Math.min(100, Math.round((p.used / Math.max(1, p.capacity)) * 100)),
              'N/A',
              'N/A'
            ]);
          } else {
            enrolledGroups.forEach((grp: any, idx: number) => {
              utilizationData.push([
                idx === 0 ? p.projectId : '',
                idx === 0 ? p.projectName : '',
                idx === 0 ? p.capacity : '',
                idx === 0 ? p.used : '',
                idx === 0 ? (p.remaining || 0) : '',
                idx === 0 ? Math.min(100, Math.round((p.used / Math.max(1, p.capacity)) * 100)) : '',
                grp.groupId,
                grp.groupName
              ]);
            });
          }
        });
      }
      const wsUtilization = XLSX.utils.aoa_to_sheet(utilizationData);
      XLSX.utils.book_append_sheet(wb, wsUtilization, 'Project Utilization');
      
      // 7. Project Tags Radar - 使用exportData展开每个project，可以重复
      const projectTagsData = [['Tag/Skill', 'Project ID', 'Project Name']];
      for (const [tag, projects] of Object.entries(exportData.tagToProjects)) {
        projects.forEach((proj: any) => {
          projectTagsData.push([tag, proj.projectId, proj.projectName]);
        });
      }
      const wsProjectTags = XLSX.utils.aoa_to_sheet(projectTagsData);
      XLSX.utils.book_append_sheet(wb, wsProjectTags, 'Project Tags Radar');
      
      // 8. Group Skills Radar - 使用exportData展开每个group，可以重复
      const groupSkillsData = [['Skill', 'Group ID', 'Group Name']];
      for (const [skill, groups] of Object.entries(exportData.skillToGroups)) {
        groups.forEach((grp: any) => {
          groupSkillsData.push([skill, grp.groupId, grp.groupName]);
        });
      }
      const wsGroupSkills = XLSX.utils.aoa_to_sheet(groupSkillsData);
      XLSX.utils.book_append_sheet(wb, wsGroupSkills, 'Group Skills Radar');
      
      // 9. Group Risk Flags - 使用原始数据并获取成员信息
      const riskData = [['Group ID', 'Group Name', 'Member Name', 'Student ID', 'UniKey', 'Enroll Course', 'Risk Type']];
      
      // Undersized Groups
      if (reportData.analytics?.riskFlags?.undersizedGroups) {
        for (const g of reportData.analytics.riskFlags.undersizedGroups) {
          const members = reportData.groupMembers?.[g.groupId] || [];
          if (members.length === 0) {
            riskData.push([g.groupId, g.groupName, '', '', '', '', 'Undersized']);
          } else {
            members.forEach((m: any, idx: number) => {
              riskData.push([
                idx === 0 ? g.groupId : '',
                idx === 0 ? g.groupName : '',
                m.studentName || '',
                m.studentId || '',
                m.uniKey || '',
                m.unitOfStudy || '',
                idx === 0 ? 'Undersized' : ''
              ]);
            });
          }
        }
      }
      
      // Manual Allocations
      if (reportData.analytics?.riskFlags?.manualAllocations) {
        for (const g of reportData.analytics.riskFlags.manualAllocations) {
          const members = reportData.groupMembers?.[g.groupId] || [];
          if (members.length === 0) {
            riskData.push([g.groupId, g.groupName, '', '', '', '', 'Manual Allocation']);
          } else {
            members.forEach((m: any, idx: number) => {
              riskData.push([
                idx === 0 ? g.groupId : '',
                idx === 0 ? g.groupName : '',
                m.studentName || '',
                m.studentId || '',
                m.uniKey || '',
                m.unitOfStudy || '',
                idx === 0 ? 'Manual Allocation' : ''
              ]);
            });
          }
        }
      }
      
      const wsRisk = XLSX.utils.aoa_to_sheet(riskData);
      XLSX.utils.book_append_sheet(wb, wsRisk, 'Group Risk Flags');
      
      // 10. Unallocated Groups - 使用原始数据并获取成员信息
      const unallocData = [['Group ID', 'Group Name', 'Member Name', 'Student ID', 'UniKey', 'Enroll Course']];
      
      if (reportData.unallocated) {
        for (const g of reportData.unallocated) {
          const members = reportData.groupMembers?.[g.GroupID] || [];
          if (members.length === 0) {
            unallocData.push([g.GroupID, g.GroupName, '', '', '', '']);
          } else {
            members.forEach((m: any, idx: number) => {
              unallocData.push([
                idx === 0 ? g.GroupID : '',
                idx === 0 ? g.GroupName : '',
                m.studentName || '',
                m.studentId || '',
                m.uniKey || '',
                m.unitOfStudy || ''
              ]);
            });
          }
        }
      }
      
      const wsUnalloc = XLSX.utils.aoa_to_sheet(unallocData);
      XLSX.utils.book_append_sheet(wb, wsUnalloc, 'Unallocated Groups');
      
      // 下载
      XLSX.writeFile(wb, `report_${new Date().toISOString().slice(0,10)}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Failed to export XLSX:', error);
      alert('XLSX export failed: ' + (error as Error).message);
    }
  };

  return (
    <div className="app">
      <Sidebar onLogout={onLogout} userRole={userRole} username={username} />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        <div className="content-header" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <h1 style={{ margin: 0, textAlign: 'center' }}>Reports & Analytics</h1>
          </div>
          <div className="header-right" style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            {/* Reset layout button */}
            <Button variant="outline" onClick={resetLayouts} title="Reset card positions">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
            </Button>
            {/* red square trash button */}
            <button
              onClick={() => {
                // init selection map
                const init: Record<string, boolean> = {};
                for (const h of history) init[h.timestamp] = false;
                setDeleteSelection(init);
                setShowDeleteModal(true);
              }}
              title="Delete reports"
              style={{ width: 28, height: 28, minWidth: 28, border: '1px solid #ef4444', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {/* trash icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
            {/* Export button */}
            <div style={{ position: 'relative' }} data-export-menu>
              <Button 
                variant="outline" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!report}
                title="Export to file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export to
              </Button>
              {showExportMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  minWidth: 120,
                  zIndex: 50
                }}>
                  <button
                    onClick={exportToCSV}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      borderBottom: '1px solid #f3f4f6'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    CSV
                  </button>
                  <button
                    onClick={exportToXLSX}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    XLSX
                  </button>
                </div>
              )}
            </div>
            <Select value={selectedTs} onValueChange={(v) => setSelectedTs(v)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select a report time" />
              </SelectTrigger>
              <SelectContent>
                {history.length === 0 ? (
                  <SelectItem value="no-data" disabled>No reports</SelectItem>
                ) : (
                  history.map((h) => (
                    <SelectItem key={h.timestamp} value={h.timestamp}>
                      {new Date(h.timestamp).toLocaleString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={() => {
              try {
                const raw = localStorage.getItem('allocationReports');
                const list = raw ? JSON.parse(raw) : [];
                setHistory(Array.isArray(list) ? list : []);
                if (Array.isArray(list) && list.length > 0) setSelectedTs(list[list.length - 1].timestamp);
              } catch (_) {}
            }}>Refresh</Button>
          </div>
        </div>

        {/* Backdrop for layout panel */}
        {showLayoutPanel && (
          <div
            onClick={() => {
              setShowLayoutPanel(false);
              setLayoutAction(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
          />
        )}

        {/* Card Control Bar */}
        {report && (
          <div style={{
            padding: '12px 16px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            position: 'relative',
          }}>
            {/* Auto Organize Button */}
            <Button 
              variant="default" 
              onClick={autoOrganizeLayouts}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Auto Organize
            </Button>

            {/* Layout Manager */}
            <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setLayoutAction('load');
                  setShowLayoutPanel(!showLayoutPanel);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Load Layout
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setLayoutAction('save');
                  setShowLayoutPanel(!showLayoutPanel);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Layout
              </Button>

              {/* Layout Panel */}
              {showLayoutPanel && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 8,
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: 12,
                    minWidth: 320,
                    zIndex: 1000,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#111827' }}>
                    {layoutAction === 'load' ? 'Load Layout' : 'Save Layout'}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[1, 2, 3, 4, 5].map(slot => {
                      const savedLayouts = getSavedLayouts();
                      const layout = savedLayouts[slot];
                      return (
                        <div
                          key={slot}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 10,
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            cursor: layout || layoutAction === 'save' ? 'pointer' : 'not-allowed',
                            background: layout ? '#fff' : '#f9fafb',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (layout || layoutAction === 'save') {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.background = '#f0f9ff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.background = layout ? '#fff' : '#f9fafb';
                          }}
                          onClick={() => {
                            if (layoutAction === 'save') {
                              if (layout) {
                                setSelectedLayoutSlot(slot);
                                setShowOverwriteConfirm(true);
                              } else {
                                saveLayoutToSlot(slot);
                              }
                            } else if (layout) {
                              loadLayoutFromSlot(slot);
                            }
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                              Slot {slot}
                            </div>
                            {layout && (
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                {new Date(layout.timestamp).toLocaleString()}
                              </div>
                            )}
                            {!layout && (
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                Empty
                              </div>
                            )}
                          </div>
                          {layout && layoutAction === 'load' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLayoutSlot(slot);
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #fca5a5',
                                background: '#fef2f2',
                                borderRadius: 4,
                                cursor: 'pointer',
                                color: '#dc2626',
                                fontSize: 14,
                              }}
                              title="Delete"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 24, background: '#d1d5db' }} />

            {/* Card Toggle Buttons */}
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'scoreDistribution', label: 'Score Match' },
              { id: 'descriptionMatching', label: 'Desc Match' },
              { id: 'skillMatching', label: 'Skill Match' },
              { id: 'projectRiskFlags', label: 'Project Risk' },
              { id: 'skillCoverage', label: 'Results' },
              { id: 'projectTagsRadar', label: 'Tags Radar' },
              { id: 'groupRiskFlags', label: 'Group Risk' },
              { id: 'groupSkillsRadar', label: 'Skills Radar' },
              { id: 'unallocated', label: 'Unallocated' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setVisibleCards(prev => ({ ...prev, [id]: !prev[id] }))}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: visibleCards[id] ? '1px solid #3b82f6' : '1px solid #d1d5db',
                  background: visibleCards[id] ? '#dbeafe' : '#fff',
                  color: visibleCards[id] ? '#1e40af' : '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: visibleCards[id] ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!visibleCards[id]) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.color = '#3b82f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!visibleCards[id]) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="content-body draggable-grid-container" style={{ position: 'relative', minHeight: '1300px' }}>
          {!report ? (
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
              <div style={{ textAlign: 'center', color: '#6b7280' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>No report available</h3>
                <p style={{ margin: 0 }}>Please run the allocation first, then click "Get Report" to generate a visual analytics report.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview */}
              {visibleCards.overview && (
                <DraggableResizableCard
                  id="overview"
                  defaultPosition={cardLayouts.overview.position}
                  defaultSize={cardLayouts.overview.size}
                  onSizeChange={handleSizeChange}
                  minWidth={250}
                  minHeight={200}
                  zIndex={cardZIndexes.overview || 1}
                >
                <CardHeader style={{ paddingBottom: 8 }}>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Timestamp</div>
                      <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{new Date(current.timestamp).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Allocated</div>
                        <div style={{ fontWeight: 700 }}>{report.resultsCount ?? (report.results?.length || 0)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Unallocated</div>
                        <div style={{ fontWeight: 700 }}>{report.unallocatedCount ?? (report.unallocated?.length || 0)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Total Groups</div>
                        <div style={{ fontWeight: 700 }}>{report.totalGroups ?? ((report.resultsCount || 0) + (report.unallocatedCount || 0))}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Allocation Rate</div>
                        <div style={{ fontWeight: 700 }}>
                          {(() => {
                            const alloc = report.resultsCount ?? (report.results?.length || 0);
                            const unalloc = report.unallocatedCount ?? (report.unallocated?.length || 0);
                            const total = report.totalGroups ?? (alloc + unalloc);
                            if (!total) return '0%';
                            return `${((alloc / total) * 100).toFixed(1)}%`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Allocation settings snapshot */}
                  <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Allocation Engine Settings</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                      <div>Skill Weight: <strong>{report.analytics?.settings?.weights?.skillWeight ?? 'N/A'}</strong></div>
                      <div>Score Weight: <strong>{report.analytics?.settings?.weights?.scoreWeight ?? 'N/A'}</strong></div>
                      <div>Description Weight: <strong>{report.analytics?.settings?.weights?.descriptionWeight ?? 'N/A'}</strong></div>
                      <div>Min Group Size: <strong>{report.analytics?.settings?.minGroupSize ?? 'N/A'}</strong></div>
                      <div>Max Group Size: <strong>{report.analytics?.settings?.maxGroupSize ?? 'N/A'}</strong></div>
                    </div>
                  </div>
                </CardContent>
              </DraggableResizableCard>
              )}

              {/* Score Distribution */}
              {visibleCards.scoreDistribution && (
                <DraggableResizableCard
                  id="scoreDistribution"
                  defaultPosition={cardLayouts.scoreDistribution.position}
                  defaultSize={cardLayouts.scoreDistribution.size}
                onSizeChange={handleSizeChange}
                minWidth={300}
                minHeight={200}
                zIndex={cardZIndexes.scoreDistribution || 1}
              >
                <CardHeader style={{ paddingBottom: 8 }}>
                  <CardTitle>Comprehensive Matching Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Avg: {report.analytics?.score?.average ?? 'N/A'}</div>
                  {(() => {
                    const hist = report.analytics?.score?.histogram || [];
                    const avg = typeof report.analytics?.score?.average === 'number' ? Math.max(0, Math.min(100, report.analytics.score.average)) : null;
                    // Top 5 rows: per-bin share = count / total
                    const total = hist.reduce((acc: number, h: any) => acc + (Number(h.count) || 0), 0) || 1;
                    const rows = hist.map((b: any) => {
                      const cnt = Number(b.count) || 0;
                      const pct = Math.max(0, Math.min(100, (cnt / total) * 100));
                      const label = b.label || b.bucket;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 84, fontSize: 12, color: '#6b7280' }}>{label}</div>
                          <div style={{ height: 8, background: '#e5e7eb', flex: 1, borderRadius: 6 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#34d399', borderRadius: 6 }} />
                          </div>
                          <div style={{ width: 28, textAlign: 'right', fontSize: 12 }}>{b.count}</div>
                        </div>
                      );
                    });
                    // Sixth row: 0–100 bar filled by avg%
                    rows.push(
                      <div key="avg-0-100" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ width: 84, fontSize: 12, color: '#6b7280' }}>0–100%</div>
                        <div style={{ position: 'relative', height: 8, background: '#e5e7eb', flex: 1, borderRadius: 6 }}>
                          <div style={{ height: '100%', width: `${avg != null ? avg : 0}%`, background: '#34d399', borderRadius: 6 }} />
                          {avg != null ? (
                            <div title={`Avg ${avg.toFixed(1)}`} style={{ position: 'absolute', top: -2, bottom: -2, left: `${avg}%`, width: 2, background: '#111827' }} />
                          ) : null}
                        </div>
                        <div style={{ width: 28, textAlign: 'right', fontSize: 12 }}>{avg != null ? `${avg.toFixed(0)}%` : ''}</div>
                      </div>
                    );
                    return rows;
                  })()}
                </CardContent>
              </DraggableResizableCard>
              )}

              {/* Matching Description */}
              {visibleCards.descriptionMatching && (
                <DraggableResizableCard
                  id="descriptionMatching"
                  defaultPosition={cardLayouts.descriptionMatching.position}
                  defaultSize={cardLayouts.descriptionMatching.size}
                onSizeChange={handleSizeChange}
                minWidth={300}
                minHeight={200}
                zIndex={cardZIndexes.descriptionMatching || 1}
              >
                <CardHeader style={{ paddingBottom: 8 }}>
                  <CardTitle>Matching Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Avg: {report.analytics?.descriptionSimilarity?.average?.toFixed(1) ?? 'N/A'}</div>
                  {(() => {
                    const hist = report.analytics?.descriptionSimilarity?.histogram || [];
                    const avg = typeof report.analytics?.descriptionSimilarity?.average === 'number' ? Math.max(0, Math.min(100, report.analytics.descriptionSimilarity.average)) : null;
                    const total = hist.reduce((acc: number, h: any) => acc + (Number(h.count) || 0), 0) || 1;
                    const rows = hist.map((b: any) => {
                      const cnt = Number(b.count) || 0;
                      const pct = Math.max(0, Math.min(100, (cnt / total) * 100));
                      const label = b.label || b.bucket;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 84, fontSize: 12, color: '#6b7280' }}>{label}</div>
                          <div style={{ height: 8, background: '#e5e7eb', flex: 1, borderRadius: 6 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#60a5fa', borderRadius: 6 }} />
                          </div>
                          <div style={{ width: 28, textAlign: 'right', fontSize: 12 }}>{b.count}</div>
                        </div>
                      );
                    });
                    rows.push(
                      <div key="avg-0-100" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ width: 84, fontSize: 12, color: '#6b7280' }}>0–100%</div>
                        <div style={{ position: 'relative', height: 8, background: '#e5e7eb', flex: 1, borderRadius: 6 }}>
                          {avg !== null ? (
                            <>
                              <div style={{ height: '100%', width: `${avg}%`, background: '#60a5fa', borderRadius: 6 }} />
                              <div title={`Avg ${avg.toFixed(1)}`} style={{ position: 'absolute', top: -2, bottom: -2, left: `${avg}%`, width: 2, background: '#111827' }} />
                            </>
                          ) : null}
                        </div>
                        <div style={{ width: 28, textAlign: 'right', fontSize: 12 }}>{avg != null ? `${avg.toFixed(0)}%` : ''}</div>
                      </div>
                    );
                    return rows;
                  })()}
                </CardContent>
              </DraggableResizableCard>
              )}

              {/* Matching Skill */}
              {visibleCards.skillMatching && (
                <DraggableResizableCard
                  id="skillMatching"
                  defaultPosition={cardLayouts.skillMatching.position}
                  defaultSize={cardLayouts.skillMatching.size}
                onSizeChange={handleSizeChange}
                minWidth={300}
                minHeight={200}
                zIndex={cardZIndexes.skillMatching || 1}
              >
                <CardHeader style={{ paddingBottom: 8 }}>
                  <CardTitle>Matching Skill</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Avg: {report.analytics?.skillMatching?.average?.toFixed(1) ?? 'N/A'}%</div>
                  {(() => {
                    const hist = report.analytics?.skillMatching?.histogram || [];
                    const avg = typeof report.analytics?.skillMatching?.average === 'number' ? Math.max(0, Math.min(100, report.analytics.skillMatching.average)) : null;
                    const total = hist.reduce((acc: number, h: any) => acc + (Number(h.count) || 0), 0) || 1;
                    const rows = hist.map((b: any) => {
                      const cnt = Number(b.count) || 0;
                      const pct = Math.max(0, Math.min(100, (cnt / total) * 100));
                      const label = b.label || b.bucket;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 84, fontSize: 12, color: '#6b7280' }}>{label}%</div>
                          <div style={{ height: 8, background: '#e5e7eb', flex: 1, borderRadius: 6 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: 6 }} />
                          </div>
                          <div style={{ width: 28, textAlign: 'right', fontSize: 12 }}>{b.count}</div>
                        </div>
                      );
                    });
                    rows.push(
                      <div key="avg-0-100" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ width: 84, fontSize: 12, color: '#6b7280' }}>0–100%</div>
                        <div style={{ position: 'relative', height: 8, background: '#e5e7eb', flex: 1, borderRadius: 6 }}>
                          {avg !== null ? (
                            <>
                              <div style={{ height: '100%', width: `${avg}%`, background: '#f59e0b', borderRadius: 6 }} />
                              <div title={`Avg ${avg.toFixed(1)}`} style={{ position: 'absolute', top: -2, bottom: -2, left: `${avg}%`, width: 2, background: '#111827' }} />
                            </>
                          ) : null}
                        </div>
                        <div style={{ width: 28, textAlign: 'right', fontSize: 12 }}>{avg != null ? `${avg.toFixed(0)}%` : ''}</div>
                      </div>
                    );
                    return rows;
                  })()}
                </CardContent>
              </DraggableResizableCard>
              )}

              {/* Project Risk Flags */}
              {visibleCards.projectRiskFlags && (
                <DraggableResizableCard
                  id="projectRiskFlags"
                  defaultPosition={cardLayouts.projectRiskFlags.position}
                  defaultSize={cardLayouts.projectRiskFlags.size}
                onSizeChange={handleSizeChange}
                minWidth={400}
                minHeight={300}
                zIndex={cardZIndexes.projectRiskFlags || 1}
              >
                <CardHeader style={{ paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CardTitle>Project Risk Flags</CardTitle>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Sort</span>
                    <Select value={utilSort} onValueChange={(v) => setUtilSort(v as any)}>
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full first</SelectItem>
                        <SelectItem value="empty">Empty first</SelectItem>
                        <SelectItem value="name">By name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Responsive grid of compact cards to improve density */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {sortedUtil.map((p: any) => {
                      const ratio = Math.min(1, (p.used / Math.max(1, p.capacity)));
                      const percent = Math.round(ratio * 100);
                      return (
                        <div key={p.projectId} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateRows: 'auto auto', rowGap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', whiteSpace: 'normal', wordBreak: 'break-word' }}>{p.projectName}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{p.used}/{p.capacity}</div>
                          </div>
                          <div>
                            <div style={{ height: 8, background: '#eee', borderRadius: 999 }}>
                              <div style={{ height: '100%', width: `${percent}%`, background: percent >= 100 ? '#ef4444' : '#60a5fa', borderRadius: 999 }} />
                            </div>
                            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                              <span>{percent}%</span>
                              <span>rem {Math.max(0, p.remaining || 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </DraggableResizableCard>
              )}

              {/* Allocated Result Summary */}
              {visibleCards.skillCoverage && (
                <DraggableResizableCard
                  id="skillCoverage"
                  defaultPosition={cardLayouts.skillCoverage.position}
                  defaultSize={cardLayouts.skillCoverage.size}
                onSizeChange={handleSizeChange}
                minWidth={500}
                minHeight={300}
                zIndex={cardZIndexes.skillCoverage || 1}
              >
                <CardHeader style={{ paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CardTitle>Allocated Result Summary</CardTitle>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Sort</span>
                    <Select value={resultSortBy} onValueChange={(v) => setResultSortBy(v as any)}>
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                        <SelectItem value="score">By Score</SelectItem>
                        <SelectItem value="preference">By Preference</SelectItem>
                        <SelectItem value="descSim">By DescSim</SelectItem>
                        <SelectItem value="skillMatch">By Skill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {sortedResults.map((result: any) => {
                      const groupMembers = result.members || [];
                      const memberCount = groupMembers.length;
                      const isExpanded = expandedGroupId === result.groupId;
                      
                      return (
                        <div
                          key={`${result.groupId}-${result.projectId}`}
                          onClick={() => {
                            // 只在未展开时才能点击展开，展开后点击卡片不收起
                            if (!isExpanded) {
                              setExpandedGroupId(result.groupId);
                            }
                          }}
                          style={{
                            border: isExpanded ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                            borderRadius: 8,
                            padding: 10,
                            cursor: isExpanded ? 'default' : 'pointer',
                            transition: 'all 0.3s ease',
                            background: '#fff',
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.boxShadow = 'none';
                            }
                          }}
                        >
                          {/* Header with minimize button */}
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{result.groupName}</span>
                            {isExpanded && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedGroupId(null);
                                }}
                                style={{
                                  width: 20,
                                  height: 20,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #cbd5e1',
                                  background: '#f1f5f9',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: '#64748b',
                                  padding: 0,
                                }}
                                title="Minimize"
                              >
                                −
                              </button>
                            )}
                            {!isExpanded && groupMembers.length > 0 && (
                              <span style={{ fontSize: 18, color: '#6b7280' }}>+</span>
                            )}
                        </div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                            → {result.projectName}
                        </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
                              <span>
                                Score: <span style={{ fontWeight: 600, color: '#059669' }}>{result.score?.toFixed(1) || 'N/A'}</span>
                              </span>
                              <span>
                                DescSim: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{result.descSim?.toFixed(2) || 'N/A'}</span>
                              </span>
                              <span>
                                Skill: <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{result.skillMatch?.toFixed(1) || 'N/A'}%</span>
                              </span>
                              {result.preferenceRank && (
                                <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                                  Pref #{result.preferenceRank}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isExpanded && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                              👥 {memberCount} {memberCount === 1 ? 'member' : 'members'}
                            </div>
                          )}

                          {/* Expanded View - Members List (simplified) */}
                          {isExpanded && groupMembers.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#6b7280' }}>
                                Members ({memberCount}):
                              </div>
                              <div style={{ display: 'grid', gap: 3 }}>
                                {groupMembers.map((member: any, idx: number) => (
                                  <div
                                    key={`${member.studentId}-${idx}`}
                                    style={{
                                      fontSize: 11,
                                      color: '#374151',
                                      padding: '4px 6px',
                                      background: '#f9fafb',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <span style={{ fontWeight: 500, minWidth: 0, flex: '0 0 auto' }}>
                                      {idx + 1}. {member.studentName || 'Unknown'}
                                    </span>
                                    {member.uniKey && (
                                      <span style={{ fontSize: 10, color: '#6b7280', flex: '0 0 auto' }}>
                                        ({member.uniKey})
                                      </span>
                                    )}
                                    <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                                      {member.studentId || ''}
                                    </span>
                      </div>
                    ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </DraggableResizableCard>
              )}

            {/* Skills Radar: Project Tags (polygon) */}
            {visibleCards.projectTagsRadar && (
              <DraggableResizableCard
                id="projectTagsRadar"
                defaultPosition={cardLayouts.projectTagsRadar.position}
                defaultSize={cardLayouts.projectTagsRadar.size}
              onSizeChange={handleSizeChange}
              minWidth={400}
              minHeight={350}
              zIndex={cardZIndexes.projectTagsRadar || 1}
            >
              <CardHeader style={{ paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CardTitle>Project Tags Radar</CardTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 80 }}>H-Offset:</label>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={radarHorizontalOffset} 
                      onChange={(e) => setRadarHorizontalOffset(Number(e.target.value))}
                      style={{ flex: 1, maxWidth: 120 }}
                    />
                    <span style={{ fontSize: 11, color: '#6b7280', minWidth: 35 }}>{radarHorizontalOffset}px</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 80 }}>Scale:</label>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.1"
                      value={radarScale} 
                      onChange={(e) => setRadarScale(Number(e.target.value))}
                      style={{ flex: 1, maxWidth: 120 }}
                    />
                    <span style={{ fontSize: 11, color: '#6b7280', minWidth: 35 }}>{radarScale.toFixed(1)}x</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent style={{ height: 'calc(100% - 110px)', overflow: 'visible' }}>
                {(() => {
                  const entries = (report.analytics?.radars?.projectTags || []) as {label:string;count:number}[];
                  if (entries.length === 0) return <div style={{ color: '#6b7280', fontSize: 13 }}>No skill data available.</div>;
                  const topN = Math.min(10, entries.length);
                  const data = entries.slice(0, topN).map(e => [e.label, e.count] as [string, number]);
                  const max = Math.max(1, ...data.map(([, v]) => Number(v) || 0));
                  // Use viewBox coordinates for responsive scaling
                  const size = 500;
                  const cx = size / 2;
                  const cy = size / 2;
                  const radius = size / 2 - 100; // Fixed radius
                  const angleStep = (Math.PI * 2) / data.length;
                  
                  // 辅助函数：根据角度确定文字锚点
                  const getTextAnchor = (ang: number): 'start' | 'middle' | 'end' => {
                    const cosAng = Math.cos(ang);
                    if (cosAng < -0.2) return 'end'; // 左侧
                    if (cosAng > 0.2) return 'start'; // 右侧
                    return 'middle'; // 中间
                  };
                  
                  // 辅助函数：文本换行
                  const wrapText = (text: string, maxLen: number = 12): string[] => {
                    if (text.length <= maxLen) return [text];
                    const words = text.split(/[\s-]/);
                    const lines: string[] = [];
                    let currentLine = '';
                    
                    words.forEach(word => {
                      if ((currentLine + word).length <= maxLen) {
                        currentLine += (currentLine ? ' ' : '') + word;
                      } else {
                        if (currentLine) lines.push(currentLine);
                        currentLine = word;
                      }
                    });
                    if (currentLine) lines.push(currentLine);
                    return lines.length > 0 ? lines : [text.slice(0, maxLen)];
                  };
                  
                  return (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', height: '100%', overflow: 'visible' }}>
                      <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, overflow: 'visible' }}>
                        <svg viewBox="0 0 500 500" style={{ width: '100%', height: '100%', maxWidth: '500px', maxHeight: '500px', overflow: 'visible' }}>
                        <g transform={`translate(${radarHorizontalOffset}, 0) scale(${radarScale})`} style={{ transformOrigin: 'center' }}>
                        {/* rings */}
                        {[0.25,0.5,0.75,1].map((k) => (
                          <circle key={`ring-${k}`} cx={cx} cy={cy} r={radius*k} fill="none" stroke="#f3f4f6" strokeWidth={1} />
                        ))}
                        {/* axes */}
                        {data.map(([,], i) => {
                          const ang = -Math.PI/2 + i*angleStep;
                          const x = cx + radius * Math.cos(ang);
                          const y = cy + radius * Math.sin(ang);
                          return <line key={`ax-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        })}
                        {/* polygon connecting points */}
                        {(() => {
                          const points: {x:number;y:number}[] = [];
                          data.forEach(([, val], i) => {
                            if (hiddenTagsIdx.has(i)) return; // skip hidden
                            const base = (Number(val) || 0) / max;
                            const r = Math.min(1, Math.max(0.06, base)) * radius;
                            const ang = -Math.PI/2 + i*angleStep;
                            const x = cx + r * Math.cos(ang);
                            const y = cy + r * Math.sin(ang);
                            points.push({ x, y });
                          });
                          const poly = points.map(p => `${p.x},${p.y}`).join(' ');
                          return (
                            <g>
                              <polygon points={poly} fill="#34d39933" stroke="#10b981" strokeWidth={2} />
                              {points.map((p, i) => (
                                <circle
                                  key={`pt-${i}`}
                                  cx={p.x}
                                  cy={p.y}
                                  r={3}
                                  fill={'#059669'}
                                  stroke={hoverTagsIdx === i ? '#111827' : 'none'}
                                  strokeWidth={hoverTagsIdx === i ? 2 : 0}
                                  style={{ transition: 'stroke-width 120ms ease' }}
                                  onMouseEnter={() => setHoverTagsIdx(i)}
                                  onMouseLeave={() => setHoverTagsIdx(null)}
                                />
                              ))}
                            </g>
                          );
                        })()}
                        {/* labels */}
                        {data.map(([skill], i) => {
                          const ang = -Math.PI/2 + i*angleStep;
                          const labelRadius = radius + 30;
                          const lx = cx + labelRadius * Math.cos(ang);
                          const ly = cy + labelRadius * Math.sin(ang);
                          const anchor = getTextAnchor(ang);
                          const lines = wrapText(skill, 15);
                          
                          return (
                            <text 
                              key={`lbl-${i}`} 
                              x={lx} 
                              y={ly - (lines.length - 1) * 5} 
                              fontSize={14} 
                              textAnchor={anchor} 
                              dominantBaseline="middle" 
                              fill="#374151"
                            >
                              {lines.map((line, idx) => (
                                <tspan key={idx} x={lx} dy={idx === 0 ? 0 : 10}>
                                  {line}
                                </tspan>
                              ))}
                            </text>
                          );
                        })}
                        </g>
                      </svg>
                      </div>
                      <div style={{ flex: '1 1 auto', display: 'grid', rowGap: 4, fontSize: 12, minWidth: 200, overflowY: 'auto', paddingRight: 8, paddingLeft: 65 }}>
                        {data.map(([skill, val], i) => {
                          const isHidden = hiddenTagsIdx.has(i);
                          return (
                            <div
                              key={`legend-${skill}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: isHidden ? 0.5 : 1 }}
                              onMouseEnter={() => setHoverTagsIdx(i)}
                              onMouseLeave={() => setHoverTagsIdx(null)}
                              onClick={() => setHiddenTagsIdx(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                            >
                              <span style={{ width: 10, height: 10, background: hoverTagsIdx===i? '#10b981':'#34d399', display: 'inline-block', borderRadius: 2 }} />
                              <span style={{ flex: 1, minWidth: 140 }}>{skill}</span>
                              <span style={{ color: '#6b7280', textAlign: 'right', width: 40, flexShrink: 0 }}>{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </DraggableResizableCard>
            )}

            {/* Group Risk Flags */}
            {visibleCards.groupRiskFlags && (
              <DraggableResizableCard
                id="groupRiskFlags"
                defaultPosition={cardLayouts.groupRiskFlags.position}
                defaultSize={cardLayouts.groupRiskFlags.size}
              onSizeChange={handleSizeChange}
              minWidth={400}
              minHeight={300}
              zIndex={cardZIndexes.groupRiskFlags || 1}
            >
              <CardHeader style={{ paddingBottom: 8 }}>
                <CardTitle>Group Risk Flags</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const undersized = report.analytics?.riskFlags?.undersizedGroups || [];
                  const manual = report.analytics?.riskFlags?.manualAllocations || [];
                  const renderGroupCard = (g: any, type: 'undersized' | 'manual') => {
                    const isExpanded = expandedRiskGroupId === g.groupId;
                    const groupMembers = report.groupMembers?.[g.groupId] || [];
                    const memberCount = groupMembers.length;
                    
                    return (
                      <div
                        key={`${type}-${g.groupId}`}
                        onClick={() => {
                          if (!isExpanded) {
                            setExpandedRiskGroupId(g.groupId);
                          }
                        }}
                        style={{
                          border: isExpanded ? '2px solid #ef4444' : '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 10,
                          background: '#fff',
                          cursor: isExpanded ? 'default' : 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) {
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span>{g.groupName}</span>
                          {isExpanded && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRiskGroupId(null);
                              }}
                              style={{
                                width: 20,
                                height: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #cbd5e1',
                                background: '#f1f5f9',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 14,
                                color: '#64748b',
                                padding: 0,
                              }}
                              title="Minimize"
                            >
                              −
                            </button>
                          )}
                          {!isExpanded && groupMembers.length > 0 && (
                            <span style={{ fontSize: 16, color: '#6b7280' }}>+</span>
                          )}
                        </div>
                        {!isExpanded && (
                          <>
                            {type === 'undersized' && (
                              <div style={{ fontSize: 12, color: '#6b7280' }}>Size: <span style={{ fontWeight: 600, color: '#b91c1c' }}>{g.size}</span></div>
                            )}
                            {type === 'manual' && (
                              <div style={{ fontSize: 12, color: '#6b7280' }}>Type: <span style={{ fontWeight: 600 }}>Manual</span></div>
                            )}
                            <div style={{ fontSize: 12, marginTop: 4 }}>Project: <span style={{ color: '#374151' }}>{g.projectName}</span></div>
                          </>
                        )}

                        {/* Expanded View - Members List */}
                        {isExpanded && groupMembers.length > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#6b7280' }}>
                              Members ({memberCount}):
                            </div>
                            <div style={{ display: 'grid', gap: 3 }}>
                              {groupMembers.map((member: any, idx: number) => (
                                <div
                                  key={`${member.studentId}-${idx}`}
                                  style={{
                                    fontSize: 11,
                                    color: '#374151',
                                    padding: '4px 6px',
                                    background: '#f9fafb',
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <span style={{ fontWeight: 500, minWidth: 0, flex: '0 0 auto' }}>
                                    {idx + 1}. {member.studentName || 'Unknown'}
                                  </span>
                                  {member.uniKey && (
                                    <span style={{ fontSize: 10, color: '#6b7280', flex: '0 0 auto' }}>
                                      ({member.uniKey})
                                    </span>
                                  )}
                                  <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                                    {member.studentId || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Undersized Groups</div>
                        {undersized.length === 0 ? (
                          <div style={{ color: '#6b7280', fontSize: 13 }}>No undersized groups found.</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                            {undersized.map((g: any) => renderGroupCard(g, 'undersized'))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Manual Allocations</div>
                        {manual.length === 0 ? (
                          <div style={{ color: '#6b7280', fontSize: 13 }}>No manual allocations found.</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                            {manual.map((m: any) => renderGroupCard(m, 'manual'))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </DraggableResizableCard>
            )}

            {/* Skills Radar: Group Skills (polygon) */}
            {visibleCards.groupSkillsRadar && (
              <DraggableResizableCard
                id="groupSkillsRadar"
                defaultPosition={cardLayouts.groupSkillsRadar.position}
                defaultSize={cardLayouts.groupSkillsRadar.size}
              onSizeChange={handleSizeChange}
              minWidth={400}
              minHeight={350}
              zIndex={cardZIndexes.groupSkillsRadar || 1}
            >
              <CardHeader style={{ paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CardTitle>Group Skills Radar</CardTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 80 }}>H-Offset:</label>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={groupRadarHorizontalOffset} 
                      onChange={(e) => setGroupRadarHorizontalOffset(Number(e.target.value))}
                      style={{ flex: 1, maxWidth: 120 }}
                    />
                    <span style={{ fontSize: 11, color: '#6b7280', minWidth: 35 }}>{groupRadarHorizontalOffset}px</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 80 }}>Scale:</label>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.1"
                      value={groupRadarScale} 
                      onChange={(e) => setGroupRadarScale(Number(e.target.value))}
                      style={{ flex: 1, maxWidth: 120 }}
                    />
                    <span style={{ fontSize: 11, color: '#6b7280', minWidth: 35 }}>{groupRadarScale.toFixed(1)}x</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent style={{ height: 'calc(100% - 110px)', overflow: 'visible' }}>
                {(() => {
                  const entries = (report.analytics?.radars?.groupSkills || []) as {label:string;count:number}[];
                  if (entries.length === 0) return <div style={{ color: '#6b7280', fontSize: 13 }}>No group skill data available.</div>;
                  const topN = Math.min(10, entries.length);
                  const data = entries.slice(0, topN).map(e => [e.label, e.count] as [string, number]);
                  const max = Math.max(1, ...data.map(([, v]) => Number(v) || 0));
                  // Use viewBox coordinates for responsive scaling
                  const size = 500;
                  const cx = size / 2;
                  const cy = size / 2;
                  const radius = size / 2 - 100; // Fixed radius
                  const angleStep = (Math.PI * 2) / data.length;
                  
                  // 辅助函数：根据角度确定文字锚点
                  const getTextAnchor = (ang: number): 'start' | 'middle' | 'end' => {
                    const cosAng = Math.cos(ang);
                    if (cosAng < -0.2) return 'end'; // 左侧
                    if (cosAng > 0.2) return 'start'; // 右侧
                    return 'middle'; // 中间
                  };
                  
                  // 辅助函数：文本换行
                  const wrapText = (text: string, maxLen: number = 12): string[] => {
                    if (text.length <= maxLen) return [text];
                    const words = text.split(/[\s-]/);
                    const lines: string[] = [];
                    let currentLine = '';
                    
                    words.forEach(word => {
                      if ((currentLine + word).length <= maxLen) {
                        currentLine += (currentLine ? ' ' : '') + word;
                      } else {
                        if (currentLine) lines.push(currentLine);
                        currentLine = word;
                      }
                    });
                    if (currentLine) lines.push(currentLine);
                    return lines.length > 0 ? lines : [text.slice(0, maxLen)];
                  };
                  
                  return (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', height: '100%', overflow: 'visible' }}>
                      <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, overflow: 'visible' }}>
                        <svg viewBox="0 0 500 500" style={{ width: '100%', height: '100%', maxWidth: '500px', maxHeight: '500px', overflow: 'visible' }}>
                        <g transform={`translate(${groupRadarHorizontalOffset}, 0) scale(${groupRadarScale})`} style={{ transformOrigin: 'center' }}>
                        {[0.25,0.5,0.75,1].map((k) => (
                          <circle key={`ring-${k}`} cx={cx} cy={cy} r={radius*k} fill="none" stroke="#f3f4f6" strokeWidth={1} />
                        ))}
                        {data.map(([,], i) => {
                          const ang = -Math.PI/2 + i*angleStep;
                          const x = cx + radius * Math.cos(ang);
                          const y = cy + radius * Math.sin(ang);
                          return <line key={`ax-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        })}
                        {(() => {
                          const points: {x:number;y:number}[] = [];
                          data.forEach(([, val], i) => {
                            if (hiddenGroupIdx.has(i)) return;
                            const base = (Number(val) || 0) / max;
                            const r = Math.min(1, Math.max(0.06, base)) * radius;
                            const ang = -Math.PI/2 + i*angleStep;
                            const x = cx + r * Math.cos(ang);
                            const y = cy + r * Math.sin(ang);
                            points.push({ x, y });
                          });
                          const poly = points.map(p => `${p.x},${p.y}`).join(' ');
                          return (
                            <g>
                              <polygon points={poly} fill="#34d39933" stroke="#10b981" strokeWidth={2} />
                              {points.map((p, i) => (
                                <circle
                                  key={`pt-${i}`}
                                  cx={p.x}
                                  cy={p.y}
                                  r={3}
                                  fill={'#059669'}
                                  stroke={hoverGroupIdx === i ? '#111827' : 'none'}
                                  strokeWidth={hoverGroupIdx === i ? 2 : 0}
                                  style={{ transition: 'stroke-width 120ms ease' }}
                                  onMouseEnter={() => setHoverGroupIdx(i)}
                                  onMouseLeave={() => setHoverGroupIdx(null)}
                                />
                              ))}
                            </g>
                          );
                        })()}
                        {data.map(([skill], i) => {
                          const ang = -Math.PI/2 + i*angleStep;
                          const labelRadius = radius + 30;
                          const lx = cx + labelRadius * Math.cos(ang);
                          const ly = cy + labelRadius * Math.sin(ang);
                          const anchor = getTextAnchor(ang);
                          const lines = wrapText(skill, 15);
                          
                          return (
                            <text 
                              key={`lbl-${i}`} 
                              x={lx} 
                              y={ly - (lines.length - 1) * 5} 
                              fontSize={14} 
                              textAnchor={anchor} 
                              dominantBaseline="middle" 
                              fill="#374151"
                            >
                              {lines.map((line, idx) => (
                                <tspan key={idx} x={lx} dy={idx === 0 ? 0 : 10}>
                                  {line}
                                </tspan>
                              ))}
                            </text>
                          );
                        })}
                        </g>
                      </svg>
                      </div>
                      <div style={{ flex: '1 1 auto', display: 'grid', rowGap: 4, fontSize: 12, minWidth: 200, overflowY: 'auto', paddingRight: 8, paddingLeft: 65 }}>
                        {data.map(([skill, val], i) => {
                          const isHidden = hiddenGroupIdx.has(i);
                          return (
                            <div
                              key={`legend-${skill}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: isHidden ? 0.5 : 1 }}
                              onMouseEnter={() => setHoverGroupIdx(i)}
                              onMouseLeave={() => setHoverGroupIdx(null)}
                              onClick={() => setHiddenGroupIdx(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                            >
                              <span style={{ width: 10, height: 10, background: hoverGroupIdx===i? '#10b981':'#34d399', display: 'inline-block', borderRadius: 2 }} />
                              <span style={{ flex: 1, minWidth: 140 }}>{skill}</span>
                              <span style={{ color: '#6b7280', textAlign: 'right', width: 40, flexShrink: 0 }}>{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </DraggableResizableCard>
            )}

              {/* Unallocated */}
              {visibleCards.unallocated && (
                <DraggableResizableCard
                  id="unallocated"
                  defaultPosition={cardLayouts.unallocated.position}
                  defaultSize={cardLayouts.unallocated.size}
                onSizeChange={handleSizeChange}
                minWidth={600}
                minHeight={200}
                zIndex={cardZIndexes.unallocated || 1}
              >
                <CardHeader style={{ paddingBottom: 8 }}>
                  <CardTitle>Unallocated Groups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {(report.unallocated || []).map((g: any) => {
                      const isExpanded = expandedUnallocatedGroupId === (g.GroupID || g.groupId);
                      const groupId = g.GroupID || g.groupId;
                      const groupName = g.GroupName || g.groupName;
                      const groupMembers = report.groupMembers?.[groupId] || [];
                      const memberCount = groupMembers.length;

                      return (
                        <div
                          key={groupId}
                          onClick={() => {
                            if (!isExpanded) {
                              setExpandedUnallocatedGroupId(groupId);
                            }
                          }}
                          style={{
                            border: isExpanded ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                            borderRadius: 8,
                            padding: 10,
                            cursor: isExpanded ? 'default' : 'pointer',
                            transition: 'all 0.3s ease',
                            background: '#fff',
                          }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.borderColor = '#f59e0b';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.boxShadow = 'none';
                            }
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span>{groupName}</span>
                            {isExpanded && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedUnallocatedGroupId(null);
                                }}
                                style={{
                                  width: 20,
                                  height: 20,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #cbd5e1',
                                  background: '#f1f5f9',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: '#64748b',
                                  padding: 0,
                                }}
                                title="Minimize"
                              >
                                −
                              </button>
                            )}
                            {!isExpanded && groupMembers.length > 0 && (
                              <span style={{ fontSize: 18, color: '#6b7280' }}>+</span>
                            )}
                          </div>
                          {!isExpanded && (
                            <Badge variant="secondary" style={{ fontSize: 10 }}>Unallocated</Badge>
                          )}

                          {/* Expanded View - Members List */}
                          {isExpanded && groupMembers.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#6b7280' }}>
                                Members ({memberCount}):
                              </div>
                              <div style={{ display: 'grid', gap: 3 }}>
                                {groupMembers.map((member: any, idx: number) => (
                                  <div
                                    key={`${member.studentId}-${idx}`}
                                    style={{
                                      fontSize: 11,
                                      color: '#374151',
                                      padding: '4px 6px',
                                      background: '#f9fafb',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <span style={{ fontWeight: 500, minWidth: 0, flex: '0 0 auto' }}>
                                      {idx + 1}. {member.studentName || 'Unknown'}
                                    </span>
                                    {member.uniKey && (
                                      <span style={{ fontSize: 10, color: '#6b7280', flex: '0 0 auto' }}>
                                        ({member.uniKey})
                                      </span>
                                    )}
                                    <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                                      {member.studentId || ''}
                                    </span>
                      </div>
                    ))}
                  </div>
            </div>
          )}
        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </DraggableResizableCard>
              )}
            </>
          )}
          </div>
        </DndContext>

      {/* Overwrite Confirmation Modal */}
      {showOverwriteConfirm && selectedLayoutSlot !== null && (
        <div
          onClick={() => {
            setShowOverwriteConfirm(false);
            setSelectedLayoutSlot(null);
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 90%)', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 24px 48px rgba(0,0,0,0.24)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: '#111827' }}>
              Overwrite Layout?
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Slot {selectedLayoutSlot} already has a saved layout. Do you want to overwrite it?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowOverwriteConfirm(false);
                  setSelectedLayoutSlot(null);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: '#374151',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedLayoutSlot !== null) {
                    saveLayoutToSlot(selectedLayoutSlot);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  border: 'none',
                  background: '#3b82f6',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 500,
                }}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', zIndex: 9999 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 96%)' }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Delete Reports</h3>
                <button className="chip-action" onClick={() => setShowDeleteModal(false)} title="Close">✖</button>
              </div>
              {history.length === 0 ? (
                <div style={{ fontSize: 14, color: '#6b7280' }}>No reports to delete.</div>
              ) : (
                <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  {history.map((h) => {
                    const isCurrent = h.timestamp === selectedTs;
                    return (
                      <label key={h.timestamp} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                          type="checkbox"
                          checked={!!deleteSelection[h.timestamp]}
                          onChange={(e) => setDeleteSelection(prev => ({ ...prev, [h.timestamp]: e.target.checked }))}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{new Date(h.timestamp).toLocaleString()}</div>
                          {isCurrent && <div style={{ fontSize: 12, color: '#2563eb' }}>Currently open</div>}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>items: {(h.report?.results?.length || h.allocationResults?.results?.length || 0)}</div>
                      </label>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem('allocationReports');
                      const list = raw ? JSON.parse(raw) : [];
                      const toDelete = new Set(Object.keys(deleteSelection).filter(k => deleteSelection[k]));
                      const next = Array.isArray(list) ? list.filter((e: any) => !toDelete.has(e.timestamp)) : [];
                      localStorage.setItem('allocationReports', JSON.stringify(next));
                      setHistory(next);
                      if (!next.find((e: any) => e.timestamp === selectedTs)) {
                        setSelectedTs(next.length ? next[next.length - 1].timestamp : '');
                      }
                    } catch (_) {}
                    setShowDeleteModal(false);
                  }}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminReportsAnalytics;
