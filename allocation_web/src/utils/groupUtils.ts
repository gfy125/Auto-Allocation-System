// Group type definition
export interface Group {
  id: number;
  name: string;
  course: string;
  members: number;
  createdAt: string;
  status: 'draft' | 'completed';
  formData?: any;
  student1?: string;
  student2?: string;
  student3?: string;
  student4?: string;
  student5?: string;
  student6?: string;
  student7?: string;
}

// delete group function
export const deleteGroup = (
  groupId: number,
  onSuccess: () => void,
  onError: (error: any) => void
) => {
  try {
    // delete group data from localStorage
    const savedGroups = localStorage.getItem('createdGroups');
    if (savedGroups) {
      const groups = JSON.parse(savedGroups);
      const updatedGroups = groups.filter((g: Group) => g.id !== groupId);
      localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
    }
    
    // clear related temporary storage data
    localStorage.removeItem(`newGroupFormTemp`);
    
    // clear enhancedTempStorage file system cache
    const enhancedTempStorage = (window as any).enhancedTempStorage;
    if (enhancedTempStorage && enhancedTempStorage.deleteGroupFile) {
      enhancedTempStorage.deleteGroupFile(groupId);
    }
    
    // clear draft group data from enhancedTempStorage
    if (enhancedTempStorage && enhancedTempStorage.clearDraftGroup) {
      console.log('🧹 Clearing draft group data from enhancedTempStorage');
      enhancedTempStorage.clearDraftGroup();
    }
    
    // also clear the legacy localStorage key
    localStorage.removeItem('newGroupFormTemp');
    console.log('🧹 Cleared newGroupFormTemp from localStorage');
    
    console.log(`✅ Group ${groupId} deleted successfully`);
    onSuccess();
  } catch (error) {
    console.error('❌ Failed to delete group:', error);
    onError(error);
  }
};

// calculate filled student count
export const getFilledStudentCount = (group: Group): number => {
  if (!group) return 0;
  
  // check student fields in formData
  if (group.formData) {
    const students = [
      group.formData.student1,
      group.formData.student2,
      group.formData.student3,
      group.formData.student4,
      group.formData.student5,
      group.formData.student6,
      group.formData.student7
    ];
    return students.filter(Boolean).length;
  }
  
  // check direct student fields
  const students = [
    group.student1,
    group.student2,
    group.student3,
    group.student4,
    group.student5,
    group.student6,
    group.student7
  ];
  return students.filter(Boolean).length;
};

// get filled students list
export const getFilledStudents = (group: Group): string[] => {
  if (!group) return [];
  
  // check student fields in formData
  if (group.formData) {
    const students = [
      group.formData.student1,
      group.formData.student2,
      group.formData.student3,
      group.formData.student4,
      group.formData.student5,
      group.formData.student6,
      group.formData.student7
    ];
    return students.filter(Boolean) as string[];
  }
  
  // check direct student fields
  const students = [
    group.student1,
    group.student2,
    group.student3,
    group.student4,
    group.student5,
    group.student6,
    group.student7
  ];
  return students.filter(Boolean) as string[];
};