// temporary storage tool

// interface definition
export interface TempGroupFormData {
  startTime?: string;
  finishTime?: string;
  groupName: string;
  student1: string;
  student2: string;
  student3: string;
  student4: string;
  student5: string;
  student6: string;
  student7: string;
  preference1: string;
  preference2: string;
  preference3: string;
  preference4: string;
  preference5: string;
  wamHD: string;
  wamD: string;
  wamCR: string;
  wamP: string;
  dualEnrollment: 'yes' | 'no';
  skills: string[];
  description: string;
}

export interface TempProjectFormData {
  projectName: string;
  projectId: string;
  courseCode: string;
  semester: string;
  maxGroups: string;
  projectType: string;
  deadline: string;
  description: string;
  client: string;
  deliverables: string;
  specificSkills: string;
  generalFields: string;
  resourcesProvided: string;
  tags: string[];
  startTime?: string;
  finishTime?: string;
}

const GROUP_STORAGE_KEY = 'newGroupFormTemp';
const PROJECT_STORAGE_KEY = 'newProjectFormTemp';

// enhanced temporary storage system - simulate file system structure
class EnhancedTempStorage {
  private readonly STORAGE_PREFIX = 'temp_store';
  private readonly GROUPS_DIR = 'groups';
  private readonly PROJECTS_DIR = 'projects';

  // get full storage path
  private getPath(directory: string, filename: string): string {
    return `${this.STORAGE_PREFIX}/${directory}/${filename}`;
  }

  // get all files in directory
  private getDirectoryFiles(directory: string): string[] {
    const files: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${this.STORAGE_PREFIX}/${directory}/`)) {
        files.push(key);
      }
    }
    return files;
  }

  // ===== GROUP related methods =====
  
  // save group data to file system structure
  saveGroupToFile(groupId: number, data: any): void {
    const filename = `group_${groupId}.json`;
    const filepath = this.getPath(this.GROUPS_DIR, filename);
    
    const fileData = {
      ...data,
      groupId: groupId
    };
    
    localStorage.setItem(filepath, JSON.stringify(fileData));
    console.log(`💾 Group data saved to file: ${filepath}`);
  }

  // load group data from file system structure
  loadGroupFromFile(groupId: number): any {
    const filename = `group_${groupId}.json`;
    const filepath = this.getPath(this.GROUPS_DIR, filename);
    
    const fileData = localStorage.getItem(filepath);
    if (fileData) {
      try {
        const parsed = JSON.parse(fileData);
        console.log(`📂 Group data loaded from file: ${filepath}`);
        return parsed;
      } catch (error) {
        console.error('❌ Failed to parse group file data:', error);
        return null;
      }
    }
    return null;
  }

  // delete group file
  deleteGroupFile(groupId: number): void {
    const filename = `group_${groupId}.json`;
    const filepath = this.getPath(this.GROUPS_DIR, filename);
    
    localStorage.removeItem(filepath);
    console.log(`🗑️ Group file deleted: ${filepath}`);
  }

  // list all group files
  listGroupFiles(): string[] {
    return this.getDirectoryFiles(this.GROUPS_DIR);
  }

  // ===== DRAFT specific methods =====
  
  private readonly DRAFT_GROUP_ID = -1;
  private readonly DRAFT_PROJECT_ID = -1;
  
  // save draft group data
  saveDraftGroup(data: any): void {
    this.saveGroupToFile(this.DRAFT_GROUP_ID, data);
  }
  
  // load draft group data
  loadDraftGroup(): any {
    return this.loadGroupFromFile(this.DRAFT_GROUP_ID);
  }
  
  // clear draft group data
  clearDraftGroup(): void {
    this.deleteGroupFile(this.DRAFT_GROUP_ID);
  }
  
  // save draft project data
  saveDraftProject(data: any): void {
    this.saveProjectToFile(this.DRAFT_PROJECT_ID, data);
  }
  
  // load draft project data  
  loadDraftProject(): any {
    return this.loadProjectFromFile(this.DRAFT_PROJECT_ID);
  }
  
  // clear draft project data
  clearDraftProject(): void {
    this.deleteProjectFile(this.DRAFT_PROJECT_ID);
  }

  // ===== PROJECT related methods =====
  
  // save project data to file system structure
  saveProjectToFile(projectId: number, data: any): void {
    const filename = `project_${projectId}.json`;
    const filepath = this.getPath(this.PROJECTS_DIR, filename);
    
    const fileData = {
      ...data,
      lastModified: new Date().toISOString(),
      projectId: projectId
    };
    
    localStorage.setItem(filepath, JSON.stringify(fileData));
    console.log(`💾 Project data saved to file: ${filepath}`);
  }

  // load project data from file system structure
  loadProjectFromFile(projectId: number): any {
    const filename = `project_${projectId}.json`;
    const filepath = this.getPath(this.PROJECTS_DIR, filename);
    
    const fileData = localStorage.getItem(filepath);
    if (fileData) {
      try {
        const parsed = JSON.parse(fileData);
        console.log(`📂 Project data loaded from file: ${filepath}`);
        return parsed;
      } catch (error) {
        console.error('❌ Failed to parse project file data:', error);
        return null;
      }
    }
    return null;
  }

  // delete project file
  deleteProjectFile(projectId: number): void {
    const filename = `project_${projectId}.json`;
    const filepath = this.getPath(this.PROJECTS_DIR, filename);
    
    localStorage.removeItem(filepath);
    console.log(`🗑️ Project file deleted: ${filepath}`);
  }

  // list all project files
  listProjectFiles(): string[] {
    return this.getDirectoryFiles(this.PROJECTS_DIR);
  }

  // ===== compatibility methods (keep original functionality) =====
  
  // save group to temporary storage (compatible with original code)
  saveGroup(data: any): void {
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(data));
  }

  // load group from temporary storage (compatible with original code)
  loadGroup(): any {
    const data = localStorage.getItem(GROUP_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  // clear group temporary storage (compatible with original code)
  clearGroup(): void {
    localStorage.removeItem(GROUP_STORAGE_KEY);
  }

  // save project to temporary storage (compatible with original code)
  saveProject(data: any): void {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(data));
  }

  // load project from temporary storage (compatible with original code)
  loadProject(): any {
    const data = localStorage.getItem(PROJECT_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  // clear project temporary storage (compatible with original code)
  clearProject(): void {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  }

  // check if there is temporary data
  hasData(): boolean {
    return !!(localStorage.getItem(GROUP_STORAGE_KEY) || localStorage.getItem(PROJECT_STORAGE_KEY));
  }

  // get storage statistics
  getStorageInfo(): any {
    const groupFiles = this.listGroupFiles();
    const projectFiles = this.listProjectFiles();
    
    return {
      groups: {
        count: groupFiles.length,
        files: groupFiles.map(file => {
          const data = localStorage.getItem(file);
          if (data) {
            const parsed = JSON.parse(data);
            return {
              filename: file.split('/').pop(),
              groupId: parsed.groupId
            };
          }
          return null;
        }).filter(Boolean)
      },
      projects: {
        count: projectFiles.length,
        files: projectFiles.map(file => {
          const data = localStorage.getItem(file);
          if (data) {
            const parsed = JSON.parse(data);
            return {
              filename: file.split('/').pop(),
              lastModified: parsed.lastModified,
              projectId: parsed.projectId
            };
          }
          return null;
        }).filter(Boolean)
      }
    };
  }
}

// export enhanced temporary storage instance
export const enhancedTempStorage = new EnhancedTempStorage();

// keep original export to compatible with existing code
export const tempStorage = {
  // updated to use draft methods for better organization
  saveGroup: (data: any) => enhancedTempStorage.saveDraftGroup(data),
  loadGroup: () => enhancedTempStorage.loadDraftGroup(),
  clearGroup: () => enhancedTempStorage.clearDraftGroup(),
  saveProject: (data: any) => enhancedTempStorage.saveDraftProject(data),
  loadProject: () => enhancedTempStorage.loadDraftProject(),
  clearProject: () => enhancedTempStorage.clearDraftProject(),
  hasData: () => enhancedTempStorage.hasData(),
  
  // backward compatible old methods
  save: (data: Partial<TempGroupFormData>) => enhancedTempStorage.saveDraftGroup(data),
  load: () => enhancedTempStorage.loadDraftGroup(),
  clear: () => enhancedTempStorage.clearDraftGroup(),
  
  // new: support independent cache key methods
  saveWithKey: (key: string, data: Partial<TempGroupFormData>) => {
    localStorage.setItem(`temp_group_${key}`, JSON.stringify(data));
  },
  loadWithKey: (key: string) => {
    const data = localStorage.getItem(`temp_group_${key}`);
    return data ? JSON.parse(data) : null;
  },
  clearWithKey: (key: string) => {
    localStorage.removeItem(`temp_group_${key}`);
  }
};
