// file system tool - for generating actual files locally
export class FileSystemManager {
  private static readonly PROJECTS_DIR = 'src/temp_store/projects';
  private static readonly GROUPS_DIR = 'src/temp_store/groups';

  /**
   * generate project file to local file system
   * @param projectId project ID
   * @param projectData project data
   * @returns Promise<boolean> whether successful
   */
  static async generateProjectFile(projectId: number, projectData: any): Promise<boolean> {
    try {
      console.log(`🚀 Generating project file for project ${projectId}...`);
      
      // create project data object
      const fileData = {
        projectId,
        ...projectData,
        generatedAt: new Date().toISOString(),
        status: 'active', // change from draft to active
        version: '1.0.0',
        filePath: `${this.PROJECTS_DIR}/project_${projectId}_${Date.now()}.json`
      };

      // generate file name
      const filename = `project_${projectId}_${Date.now()}.json`;
      
      // use Blob and download link to "generate" file
      // note: due to browser security restrictions, we cannot directly write to local file system
      // but we can create a download link, let user choose save location
      const blob = new Blob([JSON.stringify(fileData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      // trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // clean up URL object
      URL.revokeObjectURL(url);
      
      console.log(`✅ Project file generated: ${filename}`);
      console.log(`📁 Suggested save location: ${this.PROJECTS_DIR}/`);
      return true;
    } catch (error) {
      console.error('❌ Failed to generate project file:', error);
      return false;
    }
  }

  /**
   * update project status to active (non-draft)
   * @param projectId project ID
   * @returns Promise<boolean> whether successful
   */
  static async updateProjectStatus(projectId: number): Promise<boolean> {
    try {
      console.log(`🔄 Updating project ${projectId} status from draft to active...`);
      
      // get project list from localStorage
      const savedProjects = localStorage.getItem('createdProjects');
      if (!savedProjects) {
        console.error('No projects found in localStorage');
        return false;
      }

      const projects = JSON.parse(savedProjects);
      const projectIndex = projects.findIndex((p: any) => p.id === projectId);
      
      if (projectIndex === -1) {
        console.error(`Project with ID ${projectId} not found`);
        return false;
      }

      // check current status
      const currentStatus = projects[projectIndex].status;
      console.log(`📊 Current project status: ${currentStatus}`);

      // update project status
      projects[projectIndex].status = 'active';
      projects[projectIndex].lastModified = new Date().toISOString();
      
      // save back to localStorage
      localStorage.setItem('createdProjects', JSON.stringify(projects));
      
      // trigger storage event, notify other components to update
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'createdProjects',
        newValue: JSON.stringify(projects)
      }));

      console.log(`✅ Project ${projectId} status updated from ${currentStatus} to active`);
      return true;
    } catch (error) {
      console.error('❌ Failed to update project status:', error);
      return false;
    }
  }

  /**
   * generate project file and update status
   * @param projectId project ID
   * @param projectData project data
   * @returns Promise<boolean> whether successful
   */
  static async submitProject(projectId: number, projectData: any): Promise<boolean> {
    try {
      console.log(`🎯 Starting project submission for project ${projectId}...`);
      
      // 1. generate project file
      const fileGenerated = await this.generateProjectFile(projectId, projectData);
      if (!fileGenerated) {
        console.error('❌ Project file generation failed');
        return false;
      }

      // 2. update project status
      const statusUpdated = await this.updateProjectStatus(projectId);
      if (!statusUpdated) {
        console.error('❌ Project status update failed');
        return false;
      }

      console.log(`🎉 Project ${projectId} submitted successfully!`);
      console.log(`📋 Summary:`);
      console.log(`   - File generated: ✅`);
      console.log(`   - Status updated: ✅`);
      console.log(`   - Dashboard will reflect changes immediately`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to submit project:', error);
      return false;
    }
  }

  // ===== GROUP related methods =====

  /**
   * generate group file to local file system
   * @param groupId group ID
   * @param groupData group data
   * @returns Promise<boolean> whether successful
   */
  static async generateGroupFile(groupId: number, groupData: any): Promise<boolean> {
    try {
      console.log(`🚀 Generating group file for group ${groupId}...`);
      
      // create group data object (only contains group data, no system metadata)
      const fileData = {
        groupId,
        ...groupData
      };

      // generate file name
      const filename = `group_${groupId}_${Date.now()}.json`;
      
      // use Blob and download link to "generate" file
      // note: due to browser security restrictions, we cannot directly write to local file system
      // but we can create a download link, let user choose save location
      const blob = new Blob([JSON.stringify(fileData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      // trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // clean up URL object
      URL.revokeObjectURL(url);
      
      console.log(`✅ Group file generated: ${filename}`);
      console.log(`📁 Suggested save location: ${this.GROUPS_DIR}/`);
      return true;
    } catch (error) {
      console.error('❌ Failed to generate group file:', error);
      return false;
    }
  }

  /**
   * update group status to completed (non-draft)
   * @param groupId group ID
   * @returns Promise<boolean> whether successful
   */
  static async updateGroupStatus(groupId: number): Promise<boolean> {
    try {
      console.log(`🔄 Updating group ${groupId} status from draft to completed...`);
      
      // get group list from localStorage
      const savedGroups = localStorage.getItem('createdGroups');
      if (!savedGroups) {
        console.error('No groups found in localStorage');
        return false;
      }

      const groups = JSON.parse(savedGroups);
      const groupIndex = groups.findIndex((g: any) => g.id === groupId);
      
      if (groupIndex === -1) {
        console.error(`Group with ID ${groupId} not found`);
        return false;
      }

      // check current status
      const currentStatus = groups[groupIndex].status;
      console.log(`📊 Current group status: ${currentStatus}`);

      // update group status (not write lastModified)
      groups[groupIndex].status = 'completed';
      
      // save back to localStorage
      localStorage.setItem('createdGroups', JSON.stringify(groups));
      
      // trigger storage event, notify other components to update
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'createdGroups',
        newValue: JSON.stringify(groups)
      }));

      console.log(`✅ Group ${groupId} status updated from ${currentStatus} to completed`);
      return true;
    } catch (error) {
      console.error('❌ Failed to update group status:', error);
      return false;
    }
  }

  /**
   * generate group file and update status
   * @param groupId group ID
   * @param groupData group data
   * @returns Promise<boolean> whether successful
   */
  static async submitGroup(groupId: number, groupData: any): Promise<boolean> {
    try {
      console.log(`🎯 Starting group submission for group ${groupId}...`);
      
      // 1. generate group file
      const fileGenerated = await this.generateGroupFile(groupId, groupData);
      if (!fileGenerated) {
        console.error('❌ Group file generation failed');
        return false;
      }

      // 2. update group status
      const statusUpdated = await this.updateGroupStatus(groupId);
      if (!statusUpdated) {
        console.error('❌ Group status update failed');
        return false;
      }

      console.log(`🎉 Group ${groupId} submitted successfully!`);
      console.log(`📋 Summary:`);
      console.log(`   - File generated: ✅`);
      console.log(`   - Status updated: ✅`);
      console.log(`   - Dashboard will reflect changes immediately`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to submit group:', error);
      return false;
    }
  }
}
