import React, { useState, useEffect } from 'react';
import { useDynamicFavicon } from '../hooks/useDynamicFavicon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Trash2, 
  CheckCircle, 
  Clock, 
  Users, 
  Target, 
  Award, 
  Code, 
  FileText,
  Save,
  AlertTriangle
} from "lucide-react";
import { tempStorage, enhancedTempStorage } from '../utils/tempStorage';
import type { TempGroupFormData } from '../utils/tempStorage';
import { deleteGroup } from '../utils/groupUtils';
import { createGroup, updateGroup, getGroupByName, deleteGroup as deleteGroupApi, type GroupApiData } from '../api/groupApi';


interface NewGroupFormShadcnProps {
  onBack: () => void;
  onGroupCreated?: (groupData: any) => void;
  existingGroup?: any;
}

const NewGroupFormShadcn: React.FC<NewGroupFormShadcnProps> = ({ onBack, onGroupCreated, existingGroup }) => {
  // use dynamic favicon hook
  useDynamicFavicon();
  
  const [formData, setFormData] = useState<TempGroupFormData>({
    startTime: '',
    finishTime: '',
    groupName: '',
    student1: '',
    student2: '',
    student3: '',
    student4: '',
    student5: '',
    student6: '',
    student7: '',
    preference1: '',
    preference2: '',
    preference3: '',
    preference4: '',
    preference5: '',
    wamHD: '0',
    wamD: '0',
    wamCR: '0',
    wamP: '0',
    dualEnrollment: 'no',
    skills: [],
    description: ''
  });

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  // modal state management
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [showDeleteErrorModal, setShowDeleteErrorModal] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  
  // validation state
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [fetchBanner, setFetchBanner] = useState<string>('');

  const availableSkills = [
    'Algorithms',
    'Database',
    'Graph',
    'Data Science/Analytics/Visualisation',
    'Machine Learning',
    'Deep Learning',
    'Image Processing/Segmentation',
    'Web Development',
    'Mobile APP',
    'Cloud Computing (AWS/AZURE/GCP)',
    'CNN/DNN/GAN/GNN',
    'VR/AR/Unity 3D/Unreal',
    'UI/UX',
    'Business Analysis/Risk Analysis',
    'Bioinformatics',
    'Software Development',
    'Artificial Intelligence',
    'Information Systems',
    'Security/Networks',
    'Computer vision',
    'Biological imaging',
    'Medical imaging',
    'industrial imaging',
    'NLP',
    'Robotics'
  ];

  const isEditMode = !!existingGroup?.id && !!existingGroup?.isEditRoute;

  // load data: edit -> backend by name first; else draft
  useEffect(() => {
    if (isEditMode && existingGroup && existingGroup.id) {
      // For draft groups, use localStorage data directly
      if (existingGroup.status === 'draft') {
        console.log('📝 Edit mode (draft): loading from localStorage');
        
        if (existingGroup.formData && Object.keys(existingGroup.formData).length > 0) {
          console.log('✅ Loaded draft data from existingGroup.formData');
          setFormData(prev => ({ ...prev, ...existingGroup.formData }));
          setSelectedSkills(Array.isArray(existingGroup.formData.skills) ? existingGroup.formData.skills : []);
        } else {
          console.log('⚠️ No draft data found, starting fresh');
        }
        return;
      }
      
      // For completed groups, try backend first
      (async () => {
        try {
          setFetchBanner('');
          // try backend
          const savedGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
          const card = savedGroups.find((g: any) => g.id === existingGroup.id);
          const name = card?.name || card?.formData?.groupName || formData.groupName;
          if (name) {
            const data: GroupApiData = await getGroupByName(name);
            const members = Array.isArray(data.members) ? data.members : [];
            const studentStrings: string[] = [];
            for (let i = 0; i < 7; i++) {
              const m = members[i];
              studentStrings[i] = m ? `${m.StudentName || ''}, ${m.StudentID || ''}, ${m.UniKey || ''}, ${m.UnitOfStudy || ''}` : '';
            }
            const prefs = Array.isArray(data.preferences) ? data.preferences : [];
            const mapped: Partial<TempGroupFormData> = {
              groupName: (data as any).GroupName || (data as any).groupName || name,
              student1: studentStrings[0] || '',
              student2: studentStrings[1] || '',
              student3: studentStrings[2] || '',
              student4: studentStrings[3] || '',
              student5: studentStrings[4] || '',
              student6: studentStrings[5] || '',
              student7: studentStrings[6] || '',
              preference1: prefs[0] || '',
              preference2: prefs[1] || '',
              preference3: prefs[2] || '',
              preference4: prefs[3] || '',
              preference5: prefs[4] || '',
              wamHD: String((data as any).NumStudentsHD ?? '0'),
              wamD: String((data as any).NumStudentsD ?? '0'),
              wamCR: String((data as any).NumStudentsCR ?? '0'),
              wamP: String((data as any).NumStudentsP ?? '0'),
              dualEnrollment: ((data as any).NumStudentsTwoUnitsEnrolled ?? 0) > 0 ? 'yes' : 'no',
              description: (data as any).GroupDescription || ''
            };
            setFormData(prev => ({ ...prev, ...mapped }));
            setSelectedSkills(Array.isArray(data.skills) ? data.skills : []);

            // sync latest backend snapshot into localStorage
            try {
              const savedRaw = localStorage.getItem('createdGroups');
              if (savedRaw) {
                const saved = JSON.parse(savedRaw);
                const mappedName = (data as any).GroupName || (data as any).groupName || name;
                const memberCount = members.length;
                const newFormData: any = {
                  ...mapped,
                  skills: Array.isArray(data.skills) ? data.skills : []
                };
                const updated = saved.map((g: any) => (
                  g.id === existingGroup.id
                    ? {
                        ...g,
                        name: mappedName,
                        members: memberCount,
                        status: 'completed',
                        allocated_project: (data as any).allocated_project || g.allocated_project,
                        formData: newFormData
                      }
                    : g
                ));
                localStorage.setItem('createdGroups', JSON.stringify(updated));
              }
            } catch (_) {}
          } else {
            throw new Error('Group name not found for backend fetch');
          }
        } catch (e) {
          // fallback to FS
          const fileData = enhancedTempStorage.loadGroupFromFile(existingGroup.id);
          if (fileData) {
            setFormData(prev => ({ ...prev, ...fileData }));
            setSelectedSkills(fileData.skills || []);
            setFetchBanner('Backend fetch failed. Showing local data snapshot. Will be overwritten by latest backend snapshot.');
          } else {
            setFetchBanner('Backend fetch failed and no local snapshot available.');
          }
        }
      })();
    } else {
      // new mode: do NOT load any existing data, start fresh
      console.log('🆕 New mode (Shadcn): starting with fresh form data');
      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, startTime: formattedTime }));
      console.log('Setting start time:', formattedTime);
    }
  }, [existingGroup, isEditMode]);

  // ensure start time is set
  useEffect(() => {
    if (!formData.startTime) {
      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, startTime: formattedTime }));
      console.log('Fallback start time setting:', formattedTime);
    }
  }, [formData.startTime]);

  // automatically save data to localStorage
  useEffect(() => {
    if (existingGroup?.id) {
      const dataToSave = { ...formData, skills: selectedSkills };
      try {
        // Save to createdGroups localStorage
        const savedGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
        const updatedGroups = savedGroups.map((g: any) => 
          g.id === existingGroup.id 
            ? { ...g, formData: dataToSave }
            : g
        );
        localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
        console.log('💾 Saved data to createdGroups');
      } catch (error) {
        console.error('❌ Failed to save data:', error);
      }
    }
  }, [formData, selectedSkills, existingGroup]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    console.log('📝 Input change:', name, value);
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      console.log('🔄 Form data updated:', newData);
      return newData;
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) 
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  // Validation function
  const validateForm = () => {
    console.log('🔍 validateForm called with formData:', formData);
    const errors: {[key: string]: string} = {};
    const validCourses = ['SOFT3888', 'COMP3888', 'COMP3988', 'ISYS3888', 'CSEC3888', 'COMP5615'];

    // 1. Group Name 
    const groupNamePattern = /^(SOFT3888|COMP3888|COMP3988|ISYS3888|CSEC3888|COMP5615)_(M|TU|W|TH|F)\d{2}_\d{2}$/;
    console.log('🔍 Checking groupName:', formData.groupName, 'Pattern test:', groupNamePattern.test(formData.groupName));
    if (!formData.groupName) {
      errors.groupName = 'Group Name is required';
      console.log('❌ Group Name is empty');
    } else if (!groupNamePattern.test(formData.groupName)) {
      errors.groupName = 'Group Name must follow format: CourseCode_DayTime_GroupNumber (e.g., SOFT3888_TU12_03,DayTime: M, TU, W, TH, F)';
      console.log('❌ Group Name format invalid:', formData.groupName);
    }

    // 2. Student validation - at least 3 students
    const students = [formData.student1, formData.student2, formData.student3, formData.student4, 
                     formData.student5, formData.student6, formData.student7].filter(s => s && s.trim());
    
    if (students.length < 3) {
      errors.student1 = 'At least 3 students are required';
    }

    // Validate each student's format
    const studentIds = new Set();
    const unikeys = new Set();
    
    students.forEach((student, index) => {
      const studentField = `student${index + 1}`;
      if (student && student.trim()) {
        const parts = student.split(',').map(p => p.trim());
        if (parts.length !== 4) {
          errors[studentField] = 'Format: Name, Student ID, Unikey, UoS Code';
        } else {
          const [, id, unikey, uosCode] = parts;
          
          // Validate if student ID is numeric
          if (!id || !/^\d+$/.test(id)) {
            errors[studentField] = 'Student ID must be numbers only';
          } else {
        // Check for duplicate student ID
        if (studentIds.has(id)) {
          errors[studentField] = 'Duplicate Student ID found';
        } else {
          studentIds.add(id);
        }
          }
          
          // Validate unikey format (4 letters + 4 digits)
          if (!unikey || !/^[a-zA-Z]{4}\d{4}$/.test(unikey)) {
            errors[studentField] = 'Unikey must be 4 letters + 4 digits (e.g., abcd1234)';
          } else {
            // Check for duplicate unikey
            if (unikeys.has(unikey.toLowerCase())) {
              errors[studentField] = 'Duplicate Unikey found';
            } else {
              unikeys.add(unikey.toLowerCase());
            }
          }
          
          // Validate UoS Code
          if (!uosCode || !validCourses.includes(uosCode.toUpperCase())) {
            errors[studentField] = `UoS Code must be one of: ${validCourses.join(', ')}`;
          }
        }
      }
    });

    // 3. Project Preference validation - must fill all 5 and cannot be duplicated
    const preferences = [formData.preference1, formData.preference2, formData.preference3, 
                        formData.preference4, formData.preference5];
    const projectNumbers = new Set();
    
    preferences.forEach((pref, index) => {
      const prefField = `preference${index + 1}`;
      
      // Check if empty (required)
      if (!pref || !pref.trim()) {
        errors[prefField] = `Preference ${index + 1} is required`;
      } else {
        // Validate format P + number, and normalize (P1 -> P01)
        const prefPattern = /^P(\d{1,2})$/i;
        const match = pref.trim().toUpperCase().match(prefPattern);
        if (!match) {
          errors[prefField] = 'Format must be P + number (e.g., P01 or P1)';
        } else {
          const num = parseInt(match[1]);
          if (num < 1 || num > 99) {
            errors[prefField] = 'Project number must be between 1 and 99';
          } else {
            // Check for duplicate project number (P1 and P01 are considered the same)
            if (projectNumbers.has(num)) {
              errors[prefField] = 'Duplicate project preference found';
            } else {
              projectNumbers.add(num);
            }
          }
        }
      }
    });

    // 4. WAM Statistics validation - total must match student count
    const wamHD = parseInt(formData.wamHD) || 0;
    const wamD = parseInt(formData.wamD) || 0;
    const wamCR = parseInt(formData.wamCR) || 0;
    const wamP = parseInt(formData.wamP) || 0;
    const totalWAM = wamHD + wamD + wamCR + wamP;
    
    console.log('🔍 WAM Check - HD:', wamHD, 'D:', wamD, 'CR:', wamCR, 'P:', wamP, 'Total:', totalWAM, 'Students:', students.length);
    
    if (totalWAM !== students.length) {
      errors.wamStats = 'Number must match with student information';
      console.log('❌ WAM total mismatch');
    }
    
    // 5. Skills validation - at least one must be selected
    if (!selectedSkills || selectedSkills.length === 0) {
      errors.skills = 'At least one skill must be selected';
      console.log('❌ No skills selected');
    }
    
    console.log('🔍 All errors found:', errors);
    return errors;
  };

  // Focus on error field
  const focusErrorFieldFunc = (fieldName: string) => {
    if (fieldName === 'wamStats') {
      // Scroll to WAM Statistics Card
      const wamCard = document.querySelector('.wam-statistics-card');
      if (wamCard) {
        wamCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Then focus on first WAM field
      const element = document.getElementById('wamHD');
      if (element) {
        setTimeout(() => element.focus(), 200);
      }
    } else if (fieldName === 'skills') {
      // Scroll to Skills Card
      const skillsCard = document.querySelector('.skills-card');
      if (skillsCard) {
        skillsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      const element = document.getElementById(fieldName);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ First perform form validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      
      // Find first error field in priority order
      const fieldPriority = [
        'groupName', 
        'student1', 'student2', 'student3', 'student4', 'student5', 'student6', 'student7',
        'preference1', 'preference2', 'preference3', 'preference4', 'preference5',
        'wamStats',
        'skills'
      ];
      
      const firstErrorField = fieldPriority.find(field => errors[field]) || Object.keys(errors)[0];
      console.log('🎯 First error field:', firstErrorField, 'Error:', errors[firstErrorField]);
      
      setTimeout(() => {
        focusErrorFieldFunc(firstErrorField);
      }, 100);
      
      return; // Prevent submission
    }
    
    // Clear previous validation errors
    setValidationErrors({});
    
    // record submission time as finish time
    const now = new Date();
    const finishTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const finalData = {
      ...formData,
      finishTime,
      skills: selectedSkills
    };
    console.log('Group form submitted:', finalData);
    
    // Unified handling: whether creating new or editing, send to backend via API
    setIsSubmitting(true);
    
    try {
      const result = isEditMode ? await updateGroup(formData.groupName, finalData) : await createGroup(finalData);
    
      // HTTP status code pattern: reaching here means success
      console.log('✅ Group created successfully:', result);
      
      const updatedData = {
        ...finalData,
        isComplete: true,
      };
      
      // Notify parent component, pass updated data
      if (onGroupCreated) {
        onGroupCreated(updatedData);
      }
      
      // ✅ Show success message
      tempStorage.clear();
      setIsErrorMessage(false);
      setSuccessMessage(isEditMode ? `✅ Group updated successfully!\nSaved at: ${result.savedAt || new Date().toLocaleString()}` : `✅ Group created successfully!\nSaved at: ${result.savedAt || new Date().toLocaleString()}`);
      setShowSuccessMessage(true);
      
      // ✅ Redirect to homepage after 2 seconds
      setTimeout(() => {
        console.log('🏠 Redirecting to homepage');
        setShowSuccessMessage(false);
        onBack();  // Redirect to homepage
      }, 2000);
    } catch (error: any) {
      // Check if this is an edit mode and group not found error, then try createGroup instead
      if (isEditMode && (error?.message?.includes('not found') || error?.message?.includes('GROUP_NOT_FOUND'))) {
        console.log('🔄 Group not found during update, trying createGroup instead:', formData.groupName);
        try {
          const result = await createGroup(finalData);
          console.log('✅ Group created successfully via fallback:', result);
          
          const updatedData = {
            ...finalData,
            isComplete: true,
          };
          
          // Notify parent component, pass updated data
          if (onGroupCreated) {
            onGroupCreated(updatedData);
          }
          
          // ✅ Show success message
          tempStorage.clear();
          setIsErrorMessage(false);
          setSuccessMessage(`✅ Group created successfully!\nSaved at: ${result.savedAt || new Date().toLocaleString()}`);
          setShowSuccessMessage(true);
          
          // ✅ Redirect to homepage after 2 seconds
          setTimeout(() => {
            console.log('🏠 Redirecting to homepage');
            setShowSuccessMessage(false);
            onBack();  // Redirect to homepage
          }, 2000);
          return;
        } catch (createError: any) {
          console.error('❌ Failed to create group via fallback:', createError);
          // Fall through to original error handling
        }
      }
      
      // HTTP status code pattern: all errors (HTTP errors, business errors, network errors) are handled here
      console.error('❌ Failed to create group:', error);
      setIsErrorMessage(true);
      
      // Parse error information, show detailed HTTP status code
      let errorMessage = 'Failed to create group. Please try again.';
      
      if (error.message) {
        // Check if this is an HTTP status code error
        const httpMatch = error.message.match(/HTTP (\d+):\s*(.+)/);
        if (httpMatch) {
          const statusCode = httpMatch[1];
          const statusText = httpMatch[2];
          // Use backend returned error message directly, add status code prefix
          errorMessage = `HTTP ${statusCode}\n${statusText}`;
        } else {
          // Network error or other error
          if (error.message.includes('fetch')) {
            errorMessage = ` Network Error\nCannot connect to server.\n\nPlease check if the backend is running.`;
          } else if (error.message.includes('timeout')) {
            errorMessage = ` Timeout Error\nRequest timed out.\n\nPlease try again.`;
          } else {
            errorMessage = ` Error\n${error.message}`;
          }
        }
      }
      
      setSuccessMessage(errorMessage);
      setShowSuccessMessage(true);
      
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (existingGroup) {
      setShowDeleteConfirm(true);
    } else {
      onBack();
    }
  };

  const confirmDelete = async () => {
    if (existingGroup && existingGroup.id) {
      // If in edit mode (completed route), call backend delete by name first
      if (isEditMode) {
        try {
          const savedGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
          const card = savedGroups.find((g: any) => g.id === existingGroup.id);
          const nameToDelete = card?.name || card?.formData?.groupName || formData.groupName;
          if (nameToDelete) {
            await deleteGroupApi(nameToDelete);
          }
        } catch (err: any) {
          // Check if it's a 404/not found error - if so, delete locally since backend doesn't have it
          if (err?.message?.includes('404') || err?.message?.includes('not found') || err?.message?.includes('Not Found')) {
            console.log('Group not found in backend, proceeding with local deletion');
            // Continue with local deletion below
          } else {
            console.warn('Backend delete failed; preserving local copy:', err?.message);
            setDeleteErrorMessage(err?.message || 'Failed to delete group from backend');
            setShowDeleteErrorModal(true);
            // do not delete locally if backend fails in edit mode
            return;
          }
        }
      }

      // Then remove locally
      deleteGroup(
        existingGroup.id,
        () => {
          setIsErrorMessage(false);
          setSuccessMessage('Group deleted successfully!');
          setShowSuccessMessage(true);
          setTimeout(() => {
            setShowSuccessMessage(false);
            onBack();
          }, 500);
        },
        (error) => {
          console.error('Failed to delete group:', error);
          setIsErrorMessage(true);
          setSuccessMessage('Failed to delete group. Please try again.');
          setShowSuccessMessage(true);
          setTimeout(() => {
            setShowSuccessMessage(false);
          }, 3000);
        }
      );
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleClearCache = () => {
    if (window.confirm('Are you sure you want to clear all cached form data? This action cannot be undone.')) {
      tempStorage.clear();
      alert('Cached form data cleared successfully!');
      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, startTime: formattedTime }));
      console.log('🧹 Cleared cache, fallback start time set:', formattedTime);
    }
  };

  const getOrdinalSuffix = (num: number): string => {
    if (num === 1) return 'st';
    if (num === 2) return 'nd';
    if (num === 3) return 'rd';
    return 'th';
  };

  const handleBack = () => {
    if (existingGroup && existingGroup.id) {
      const currentData = {
        ...formData,
        skills: selectedSkills
      };
      enhancedTempStorage.saveGroupToFile(existingGroup.id, currentData);
      console.log(`💾 Group data saved to file system before going back`);
      
      // update group data in localStorage
      const savedGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
      const updatedGroups = savedGroups.map((group: any) => {
        if (group.id === existingGroup.id) {
          return {
            ...group,
            name: currentData.groupName || group.name,
            members: [currentData.student1, currentData.student2, currentData.student3, currentData.student4, currentData.student5, currentData.student6, currentData.student7].filter(Boolean).length,
            formData: currentData,
            student1: currentData.student1,
            student2: currentData.student2,
            student3: currentData.student3,
            student4: currentData.student4,
            student5: currentData.student5,
            student6: currentData.student6,
            student7: currentData.student7
          };
        }
        return group;
      });
      
      localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
      console.log('💾 Group data updated in localStorage before going back');
    }
    
    enhancedTempStorage.clearGroup();
    onBack();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {!!fetchBanner && (
          <div className="mb-4 p-2 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
            {fetchBanner}
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleBack} className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Submit Group
              </h1>
              <p className="text-gray-600 mt-1">Fill in your group information below</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {tempStorage.hasData() && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Save className="h-3 w-3" />
                <span>Draft saved</span>
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleClearCache}>
              Clear Cache
            </Button>

          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Hidden time fields */}
          <input type="hidden" name="startTime" value={formData.startTime} />
          <input type="hidden" name="finishTime" value={formData.finishTime} />

          {/* Group Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Group Information</span>
              </CardTitle>
              <CardDescription>Basic information about your group</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Your Group Name *</Label>
                <Input
                  id="groupName"
                  name="groupName"
                  value={formData.groupName}
                  onChange={handleInputChange}
                  placeholder="TutorialCode_TutorialDayTime_GroupNumber, e.g.: COMP3888_M10_03"
                  required
                  className={validationErrors.groupName ? 'border-red-500 focus:border-red-500' : ''}
                />
                {validationErrors.groupName && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {validationErrors.groupName}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Student Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Student Information</span>
              </CardTitle>
              <CardDescription>Note: please separate each answer with a comma. Student IDs and Unikeys must be unique (no duplicates).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <div key={num} className="space-y-2">
                    <Label htmlFor={`student${num}`}>
                      Student {num} (name, student ID, unikey, UoS code)
                    </Label>
                    <Input
                      id={`student${num}`}
                      name={`student${num}`}
                      value={formData[`student${num}` as keyof TempGroupFormData] as string}
                      onChange={handleInputChange}
                      placeholder="Name, ID, Unikey, UoS Code"
                      className={validationErrors[`student${num}`] ? 'border-red-500 focus:border-red-500' : ''}
                    />
                    {validationErrors[`student${num}`] && (
                      <div className="text-red-500 text-sm flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {validationErrors[`student${num}`]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Project Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Project Preferences</span>
              </CardTitle>
              <CardDescription>All 5 project preferences are required (ranked from highest to lowest priority). Each project must be unique (no duplicates).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num} className="space-y-2">
                    <Label htmlFor={`preference${num}`}>
                      {num}{getOrdinalSuffix(num)} preference (Project code) *
                    </Label>
                    <Input
                      id={`preference${num}`}
                      name={`preference${num}`}
                      value={formData[`preference${num}` as keyof TempGroupFormData] as string}
                      onChange={handleInputChange}
                      placeholder="e.g.: P01"
                      required
                      className={validationErrors[`preference${num}`] ? 'border-red-500 focus:border-red-500' : ''}
                    />
                    {validationErrors[`preference${num}`] && (
                      <div className="text-red-500 text-sm flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {validationErrors[`preference${num}`]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* WAM Statistics */}
          <Card className="wam-statistics-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Award className="h-5 w-5" />
                  <span>WAM Statistics</span>
                </CardTitle>
                {validationErrors.wamStats && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {validationErrors.wamStats}
                  </div>
                )}
              </div>
              <CardDescription>How many students in your group have WAM in the prerequisite units?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wamHD">HD (≥85) *</Label>
                  <Input
                    type="number"
                    id="wamHD"
                    name="wamHD"
                    value={formData.wamHD}
                    onChange={handleInputChange}
                    placeholder="0-7"
                    min="0"
                    max="7"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wamD">D (≥75 and &lt;85) *</Label>
                  <Input
                    type="number"
                    id="wamD"
                    name="wamD"
                    value={formData.wamD}
                    onChange={handleInputChange}
                    placeholder="0-7"
                    min="0"
                    max="7"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wamCR">CR (≥65 and &lt;75) *</Label>
                  <Input
                    type="number"
                    id="wamCR"
                    name="wamCR"
                    value={formData.wamCR}
                    onChange={handleInputChange}
                    placeholder="0-7"
                    min="0"
                    max="7"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wamP">P (≥50 and &lt;65) *</Label>
                  <Input
                    type="number"
                    id="wamP"
                    name="wamP"
                    value={formData.wamP}
                    onChange={handleInputChange}
                    placeholder="0-7"
                    min="0"
                    max="7"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dual Enrollment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Dual Enrollment</span>
              </CardTitle>
              <CardDescription>Check if any student is enrolled in multiple project units</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="dualEnrollment">
                  Is there any student enrolled in two different project units in your group? *
                </Label>
                <Select
                  value={formData.dualEnrollment}
                  onValueChange={(value) => handleSelectChange('dualEnrollment', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card className="skills-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>Your Group Skills</span>
                </CardTitle>
                {validationErrors.skills && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {validationErrors.skills}
                  </div>
                )}
              </div>
              <CardDescription>Select all applicable skills (multiple selection allowed, at least one required)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {availableSkills.map((skill) => (
                  <Button
                    key={skill}
                    type="button"
                    variant={selectedSkills.includes(skill) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSkillToggle(skill)}
                    className="h-auto py-2 px-3"
                  >
                    {skill}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Project Suitability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Project Suitability</span>
              </CardTitle>
              <CardDescription>Explain why your group is the best fit for this project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Briefly describe why your group is most suitable to undertake the project preference
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Explain why your group is the best fit for this project..."
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex items-center space-x-2"
            >
              {existingGroup ? (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Group</span>
                </>
              ) : (
                <>
                  <span>Cancel</span>
                </>
              )}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>{isSubmitting ? 'Submitting...' : (isEditMode ? 'Update Group' : 'Submit')}</span>
            </Button>
          </div>

          {/* Debug Info */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-sm text-gray-600 flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Time Tracking</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <div><strong>Start Time:</strong> {formData.startTime || 'Not set'}</div>
              <div><strong>Finish Time:</strong> {formData.finishTime || 'Not set'}</div>
            </CardContent>
          </Card>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  <span>Delete Group</span>
                </CardTitle>
                <CardDescription>
                  Are you sure you want to delete this group? This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={cancelDelete}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Error Modal */}
        {showDeleteErrorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  <span>Delete Failed</span>
                </CardTitle>
                <CardDescription>
                  {deleteErrorMessage}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Local data has been preserved.</strong>
                </p>
                <div className="flex items-center justify-end">
                  <Button variant="outline" onClick={() => setShowDeleteErrorModal(false)}>
                    OK
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Success Message Modal */}
        {showSuccessMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className={`flex items-center space-x-2 ${isErrorMessage ? 'text-red-600' : 'text-green-600'}`}>
                  {isErrorMessage ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  <span>{isErrorMessage ? 'Error' : 'Success'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{successMessage}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewGroupFormShadcn;
