import React, { useState, useEffect } from 'react';
import './NewGroupForm.css';
import { tempStorage, enhancedTempStorage } from '../utils/tempStorage';
import type { TempGroupFormData } from '../utils/tempStorage';
import { useDynamicFavicon } from '../hooks/useDynamicFavicon';
import { deleteGroup } from '../utils/groupUtils';
import { createGroup } from '../api';
import { updateGroup, deleteGroup as deleteGroupApi, getGroupByName, type GroupApiData } from '../api/groupApi';


interface NewGroupFormProps {
  onBack: () => void;
  onGroupCreated?: (groupData: any) => void;
  existingGroup?: any;
}

const NewGroupForm: React.FC<NewGroupFormProps> = ({ onBack, onGroupCreated, existingGroup }) => {
  // 使用动态 favicon hook
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
  const [showDeleteErrorModal, setShowDeleteErrorModal] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [fetchBanner, setFetchBanner] = useState<string>('');
  
  // validation state
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  


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

  // check if in edit mode
  const isEditMode = !!existingGroup?.id && !!existingGroup?.isEditRoute;

  // load existing group data or temporary saved data
  useEffect(() => {
    if (isEditMode && existingGroup?.id) {
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
        // begin backend fetch
        setFetchBanner('');
        try {
          const name = existingGroup.name || existingGroup.formData?.groupName || formData.groupName;
          if (name) {
            const data: GroupApiData = await getGroupByName(name);
            // Map backend data to form structure
            const members = Array.isArray(data.members) ? data.members : [];
            const studentStrings: string[] = [];
            for (let i = 0; i < 7; i++) {
              const m = members[i];
              if (m) {
                studentStrings[i] = `${m.StudentName || ''}, ${m.StudentID || ''}, ${m.UniKey || ''}, ${m.UnitOfStudy || ''}`.trim();
              } else {
                studentStrings[i] = '';
              }
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
            console.log('✅ Loaded group from backend by name');

            // Sync latest backend structure into localStorage.createdGroups
            try {
              const savedRaw = localStorage.getItem('createdGroups');
              if (savedRaw) {
                const saved = JSON.parse(savedRaw);
                const mappedName = (data as any).GroupName || (data as any).groupName || name;
                const memberCount = members.length;
                const newFormData: any = {
                  groupName: mappedName,
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
                  skills: Array.isArray(data.skills) ? data.skills : [],
                  description: (data as any).GroupDescription || ''
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
        } catch (e: any) {
          console.warn('Backend fetch failed, falling back to local snapshot:', e?.message || e);
          // fallback to pseudo FS then formData snapshot
          const fileData = enhancedTempStorage.loadGroupFromFile(existingGroup.id);
          if (fileData) {
            setFormData(prev => ({ ...prev, ...fileData }));
            setSelectedSkills(Array.isArray(fileData.skills) ? fileData.skills : []);
            setFetchBanner('Backend fetch failed. Showing local data snapshot.');
          } else if (existingGroup.formData) {
            setFormData(prev => ({ ...prev, ...existingGroup.formData }));
            setSelectedSkills(Array.isArray(existingGroup.formData.skills) ? existingGroup.formData.skills : []);
            setFetchBanner('Backend fetch failed. Showing local data snapshot.');
          } else {
            setFetchBanner('Backend fetch failed and no local snapshot available.');
          }
        } finally {
        }
      })();
    } else {
      // new mode: auto-fill from draft sources if available (only one draft exists)
      console.log('🆕 New mode: attempting to load draft data for auto-fill');
      let loaded: any = null;
      try {
        // 1) prefer card snapshot
        if (existingGroup && existingGroup.formData && Object.keys(existingGroup.formData).length > 0) {
          loaded = existingGroup.formData;
          console.log('✅ Loaded from existingGroup.formData');
        }
        // 2) fallback to enhanced draft temp storage
        if (!loaded) {
          const draft = tempStorage.loadGroup();
          if (draft) {
            loaded = draft;
            console.log('✅ Loaded from tempStorage (draft)');
          }
        }
        // 3) fallback to legacy key newGroupFormTemp
        if (!loaded) {
          const legacy = localStorage.getItem('newGroupFormTemp');
          if (legacy) {
            loaded = JSON.parse(legacy);
            console.log('✅ Loaded from legacy newGroupFormTemp');
          }
        }
      } catch (e) {
        console.warn('Failed to load draft data:', e);
      }

      // apply loaded data
      if (loaded) {
        setFormData(prev => ({ ...prev, ...loaded }));
        setSelectedSkills(Array.isArray(loaded.skills) ? loaded.skills : []);
      }

      // ensure start time is set
      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, startTime: prev.startTime || formattedTime }));
      console.log('Setting start time (new mode):', formattedTime);
    }
  }, [isEditMode, existingGroup]); // depend on isEditMode and existingGroup

  // ensure start time is set
  useEffect(() => {
    if (!formData.startTime) {
      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, startTime: formattedTime }));
      console.log('Fallback start time setting:', formattedTime);
    }
  }, [formData.startTime]);

  // automatically save data to localStorage (with debounce) - only in new mode
  useEffect(() => {
    if (!isEditMode && existingGroup?.id) {
      const timeoutId = setTimeout(() => {
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
          console.log('💾 Saved new mode data to createdGroups');
        } catch (error) {
          console.error('❌ Failed to save group data:', error);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [formData, selectedSkills, isEditMode, existingGroup]);

  // in edit mode, real-time sync data to outer card
  useEffect(() => {
    if (isEditMode && existingGroup?.id) {
      const timeoutId = setTimeout(() => {
        const dataToSave = { ...formData, skills: selectedSkills };
        
        // update file system structure
        enhancedTempStorage.saveGroupToFile(existingGroup.id, dataToSave);
        
        // sync update outer group card
        const savedGroups = localStorage.getItem('createdGroups');
        if (savedGroups) {
          const groups = JSON.parse(savedGroups);
          const updatedGroups = groups.map((g: any) => 
            g.id === existingGroup.id 
              ? { 
                  ...g, 
                  name: dataToSave.groupName || g.name,
                  formData: dataToSave
                }
              : g
          );
          localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
          
          // trigger storage event, notify other components to update
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'createdGroups',
            newValue: JSON.stringify(updatedGroups)
          }));
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [formData, selectedSkills, isEditMode, existingGroup]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      return newData;
    });
  };

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) 
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  // validate form
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    const validCourses = ['SOFT3888', 'COMP3888', 'COMP3988', 'ISYS3888', 'CSEC3888', 'COMP5615'];

    // 1. Group Name 
    const groupNamePattern = /^(SOFT3888|COMP3888|COMP3988|ISYS3888|CSEC3888|COMP5615)_(M|TU|W|TH|F)\d{2}_\d{2}$/;
    if (!formData.groupName) {
      errors.groupName = 'Group Name is required';
      console.log('❌ Group Name is empty');
    } else if (!groupNamePattern.test(formData.groupName)) {
      errors.groupName = 'Group Name must follow format: CourseCode_DayTime_GroupNumber (e.g., SOFT3888_TU12_03,DayTime: M, TU, W, TH, F)';
      console.log('❌ Group Name format invalid:', formData.groupName);
    }

    // 2. Student 
    const students = [formData.student1, formData.student2, formData.student3, formData.student4, 
                     formData.student5, formData.student6, formData.student7].filter(s => s && s.trim());
    
    if (students.length < 3) {
      errors.student1 = 'At least 3 students are required';
    }

    // student format
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
          
          if (!id || !/^\d+$/.test(id)) {
            errors[studentField] = 'Student ID must be numbers only';
          } else {
            if (studentIds.has(id)) {
              errors[studentField] = 'Duplicate Student ID found';
            } else {
              studentIds.add(id);
            }
          }
          if (!unikey || !/^[a-zA-Z]{4}\d{4}$/.test(unikey)) {
            errors[studentField] = 'Unikey must be 4 letters + 4 digits (e.g., abcd1234)';
          } else {
            if (unikeys.has(unikey.toLowerCase())) {
              errors[studentField] = 'Duplicate Unikey found';
            } else {
              unikeys.add(unikey.toLowerCase());
            }
          }
          
          
          if (!uosCode || !validCourses.includes(uosCode.toUpperCase())) {
            errors[studentField] = `UoS Code must be one of: ${validCourses.join(', ')}`;
          }
        }
      }
    });

    // 3. Project Preference 
    const preferences = [formData.preference1, formData.preference2, formData.preference3, 
                        formData.preference4, formData.preference5];
    const projectNumbers = new Set();
    
    preferences.forEach((pref, index) => {
      const prefField = `preference${index + 1}`;
      
      // 
      if (!pref || !pref.trim()) {
        errors[prefField] = `Preference ${index + 1} is required`;
      } else {

        const prefPattern = /^P(\d{1,2})$/i;
        const match = pref.trim().toUpperCase().match(prefPattern);
        if (!match) {
          errors[prefField] = 'Format must be P + number (e.g., P01 or P1)';
        } else {
          const num = parseInt(match[1]);
          if (num < 1 || num > 99) {
            errors[prefField] = 'Project number must be between 1 and 99';
          } else {

            if (projectNumbers.has(num)) {
              errors[prefField] = 'Duplicate project preference found';
            } else {
              projectNumbers.add(num);
            }
          }
        }
      }
    });

    // 4. WAM Statistics 
    const wamHD = parseInt(formData.wamHD) || 0;
    const wamD = parseInt(formData.wamD) || 0;
    const wamCR = parseInt(formData.wamCR) || 0;
    const wamP = parseInt(formData.wamP) || 0;
    const totalWAM = wamHD + wamD + wamCR + wamP;
    
    if (totalWAM !== students.length) {
      errors.wamStats = 'Number must match with student information';
    }
    
    // 5. Skills 
    if (!selectedSkills || selectedSkills.length === 0) {
      errors.skills = 'At least one skill must be selected';
    }


    return errors;
  };

  const focusErrorField = (fieldName: string) => {
    if (fieldName === 'wamStats') {
      const wamSection = document.querySelector('.wam-statistics-section');
      if (wamSection) {
        wamSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const element = document.getElementById('wamHD');
      if (element) {
        setTimeout(() => element.focus(), 200);
      }
    } else if (fieldName === 'skills') {
      const skillsSection = document.querySelector('.skills-section');
      if (skillsSection) {
        skillsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      
      const fieldPriority = [
        'groupName', 
        'student1', 'student2', 'student3', 'student4', 'student5', 'student6', 'student7',
        'preference1', 'preference2', 'preference3', 'preference4', 'preference5',
        'wamStats',
        'skills'
      ];
      
      const firstErrorField = fieldPriority.find(field => errors[field]) || Object.keys(errors)[0];
      console.log(' First error field:', firstErrorField, 'Error:', errors[firstErrorField]);
      
      setTimeout(() => {
        focusErrorField(firstErrorField);
      }, 100);
      
      return; 
    }
    
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
    

    setIsSubmitting(true);
    
    try {      
      const result = isEditMode
        ? await updateGroup(formData.groupName, finalData)
        : await createGroup(finalData);

      // HTTP 状态码模式：能执行到这里说明成功了
      console.log('Group created successfully:', result);
      
      // ✅ Step 2: 通知父组件组已创建
      const updatedData = {
        ...finalData,
        isComplete: true,
      };
      
      // 通知父组件，传递更新后的数据
      if (onGroupCreated) {
        onGroupCreated(updatedData);
      }
      
      // ✅ Step 3: 显示成功消息
      tempStorage.clear();
      setIsErrorMessage(false);
      setSuccessMessage(isEditMode ? `✅ Group updated successfully!` : `✅ Group created successfully!`);
      setShowSuccessMessage(true);
      
      // ✅ Step 4: 2秒后跳转到主页
      setTimeout(() => {
        setShowSuccessMessage(false);
        onBack();  // 跳转到主页
      }, 1000);
    } catch (error: any) {
      // HTTP 状态码模式：所有错误（HTTP 错误、业务错误、网络错误）都在这里处理
      console.error('❌ Failed to create group:', error);
      setIsErrorMessage(true);
      
      // 解析错误信息，显示详细的 HTTP 状态码
      let errorMessage = 'Failed to create group. Please try again.';
      
      if (error.message) {
        // 检查是否是 HTTP 状态码错误
        const httpMatch = error.message.match(/HTTP (\d+):\s*(.+)/);
        if (httpMatch) {
          const statusCode = httpMatch[1];
          const statusText = httpMatch[2];
          // 直接使用后端返回的错误信息，添加状态码前缀
          errorMessage = `HTTP ${statusCode}\n${statusText}`;
        } else {
          // 网络错误或其他错误
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
    // if in edit mode, show delete confirmation dialog
    if (isEditMode) {
      setShowDeleteConfirm(true);
    } else {
      onBack();
    }
  };

  // confirm delete
  const confirmDelete = async () => {
    if (existingGroup && existingGroup.id) {
      // If this is edit mode (completed route), call backend delete by group name first
      if (isEditMode) {
        try {
          const nameToDelete = formData.groupName || existingGroup.name;
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
            return; // Don't proceed with local deletion
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
          console.error('Failed to delete group locally:', error);
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

  // cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // helper function: get ordinal suffix
  const getOrdinalSuffix = (num: number): string => {
    if (num === 1) return 'st';
    if (num === 2) return 'nd';
    if (num === 3) return 'rd';
    return 'th';
  };

  const handleBack = () => {
    // if there is existing group data, save to file system structure
    if (isEditMode && existingGroup?.id) {
      const currentData = {
        ...formData,
        skills: selectedSkills
      };
      
      // save to file system structure
      enhancedTempStorage.saveGroupToFile(existingGroup.id, currentData);
    }
    
    // clear temporary cache
    enhancedTempStorage.clearGroup();
    
    // return to previous page
    onBack();
  };

  return (
    <div className="new-group-form">
      {fetchBanner && (
        <div className="info-item full-width" style={{ marginBottom: '10px' }}>
          <span className="label">Notice:</span>
          <span className="value">{fetchBanner}</span>
        </div>
      )}
      <div className="form-header">
        <button className="back-btn" onClick={handleBack}>
          ← Back
        </button>
                    <h1>{isEditMode ? 'Edit Group' : 'Create New Group'}</h1>
        <div className="header-actions">
          {tempStorage.hasData() && (
            <div className="temp-data-indicator">
              Draft saved automatically
            </div>
          )}

        </div>
      </div>

      <form onSubmit={handleSubmit} className="group-form" noValidate>
        {/* time tracking - hidden field, auto record */}
        <input
          type="hidden"
          name="startTime"
          value={formData.startTime}
        />
        <input
          type="hidden"
          name="finishTime"
          value={formData.finishTime}
        />

        {/* group name */}
        <div className="form-section">
          <h3>Group Information</h3>
          <div className="form-group">
            <label htmlFor="groupName">Your Group Name *</label>
            <input
              type="text"
              id="groupName"
              name="groupName"
              value={formData.groupName}
              onChange={handleInputChange}
              placeholder="TutorialCode_TutorialDayTime_GroupNumber, e.g.: COMP3888_M10_03"
              required
              className={validationErrors.groupName ? 'error' : ''}
            />
            {validationErrors.groupName && (
              <div className="error-message">❌ {validationErrors.groupName}</div>
            )}
          </div>
        </div>

        {/* student information */}
        <div className="form-section">
          <h3>Student Information</h3>
          <p className="section-description">
            Note: please separate each answer with a comma. Student IDs and Unikeys must be unique (no duplicates).
          </p>
          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
            <div className="form-group" key={num}>
              <label htmlFor={`student${num}`}>
                Student {num} (name, student ID, unikey, UoS code e.g.: COMP3888)
              </label>
              <input
                type="text"
                id={`student${num}`}
                name={`student${num}`}
                value={formData[`student${num}` as keyof TempGroupFormData] as string}
                onChange={handleInputChange}
                placeholder="Name, ID, Unikey, UoS Code"
                className={validationErrors[`student${num}`] ? 'error' : ''}
              />
              {validationErrors[`student${num}`] && (
                <div className="error-message">❌ {validationErrors[`student${num}`]}</div>
              )}
            </div>
          ))}
        </div>

        {/* project preference */}
        <div className="form-section">
          <h3>Project Preferences</h3>
          <p className="section-description">
            All 5 project preferences are required (ranked from highest to lowest priority). Each project must be unique (no duplicates).
          </p>
          {[1, 2, 3, 4, 5].map((num) => (
            <div className="form-group" key={num}>
              <label htmlFor={`preference${num}`}>
                Your group's {num}{getOrdinalSuffix(num)} preference (Project code only, e.g.: P01) *
              </label>
              <input
                type="text"
                id={`preference${num}`}
                name={`preference${num}`}
                value={formData[`preference${num}` as keyof TempGroupFormData] as string}
                onChange={handleInputChange}
                placeholder="e.g.: P01"
                required
                className={validationErrors[`preference${num}`] ? 'error' : ''}
              />
              {validationErrors[`preference${num}`] && (
                <div className="error-message">❌ {validationErrors[`preference${num}`]}</div>
              )}
            </div>
          ))}
        </div>

        {/* WAM statistics */}
        <div className="form-section wam-statistics-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3>WAM Statistics</h3>
            {validationErrors.wamStats && (
              <div className="error-message" style={{ margin: 0 }}>❌ {validationErrors.wamStats}</div>
            )}
          </div>
          <p className="section-description">
            How many students in your group have WAM in the prerequisite units?
          </p>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="wamHD">HD (≥85) *</label>
              <input
                type="number"
                id="wamHD"
                name="wamHD"
                value={formData.wamHD}
                onChange={handleInputChange}
                placeholder="Numbers only"
                min="0"
                max="7"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="wamD">D (≥75 and &lt;85) *</label>
              <input
                type="number"
                id="wamD"
                name="wamD"
                value={formData.wamD}
                onChange={handleInputChange}
                placeholder="Numbers only"
                min="0"
                max="7"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="wamCR">CR (≥65 and &lt;75) *</label>
              <input
                type="number"
                id="wamCR"
                name="wamCR"
                value={formData.wamCR}
                onChange={handleInputChange}
                placeholder="Numbers only"
                min="0"
                max="7"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="wamP">P (≥50 and &lt;65) *</label>
              <input
                type="number"
                id="wamP"
                name="wamP"
                value={formData.wamP}
                onChange={handleInputChange}
                placeholder="Numbers only"
                min="0"
                max="7"
                required
              />
            </div>
          </div>
        </div>

        {/* dual enrollment */}
        <div className="form-section">
          <h3>Dual Enrollment</h3>
          <div className="form-group">
            <label htmlFor="dualEnrollment">
              Is there any student enrolled in two different project units in your group? *
            </label>
            <select
              id="dualEnrollment"
              name="dualEnrollment"
              value={formData.dualEnrollment}
              onChange={handleInputChange}
              required
            >
              <option value="">Select answer</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        {/* skills */}
        <div className="form-section skills-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3>Your Group Skills</h3>
            {validationErrors.skills && (
              <div className="error-message" style={{ margin: 0 }}>❌ {validationErrors.skills}</div>
            )}
          </div>
          <p className="section-description">
            Select all applicable skills (multiple selection allowed, at least one required)
          </p>
          <div className="skills-container">
            {availableSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                className={`skill ${selectedSkills.includes(skill) ? 'selected' : ''}`}
                onClick={() => handleSkillToggle(skill)}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        {/* description */}
        <div className="form-section">
          <h3>Project Suitability</h3>
          <div className="form-group">
            <label htmlFor="description">
              Briefly describe why your group is most suitable to undertake the project preference
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Explain why your group is the best fit for this project..."
              rows={6}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            {existingGroup ? '🗑️ Delete Group' : 'Cancel'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : (isEditMode ? 'Update Group' : 'Submit')}
          </button>
        </div>
        
        {/* debug information - show time tracking */}
        <div className="debug-info" style={{ marginTop: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', fontSize: '12px', color: '#6c757d' }}>
          <strong>Time Tracking:</strong><br/>
          Start Time: {formData.startTime || 'Not set'}<br/>
          Finish Time: {formData.finishTime || 'Not set'}
        </div>
      </form>

      {/* delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🗑️ Delete Group</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this group? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete error dialog */}
      {showDeleteErrorModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>❌ Delete Failed</h3>
            </div>
            <div className="modal-body">
              <p>{deleteErrorMessage}</p>
              <p><strong>Local data has been preserved.</strong></p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowDeleteErrorModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* success message dialog */}
      {showSuccessMessage && (
        <div className="modal-overlay">
          <div className="modal-content success-modal">
            <div className="modal-header">
              <h3>{isErrorMessage ? 'Error' : 'Success'}</h3>
            </div>
            <div className="modal-body">
              <p>{successMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewGroupForm;
