import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ShadcnSidebar from './ShadcnSidebar';
import { getAllProjects, type ProjectApiData } from '../api/projectApi';

interface StudentProjectsShadcnProps {}

const StudentProjectsShadcn: React.FC<StudentProjectsShadcnProps> = () => {
  const [projects, setProjects] = React.useState<ProjectApiData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [emptyReason, setEmptyReason] = React.useState<string>('');
  const [showPreview, setShowPreview] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<ProjectApiData | null>(null);

  const fetchProjects = React.useCallback(async () => {
    try {
      setLoading(true);
      setEmptyReason('');
      const data = await getAllProjects();
      if (Array.isArray(data)) {
        setProjects(data);
        if (data.length === 0) setEmptyReason('No projects have been created yet.');
      } else {
        setProjects([]);
        setEmptyReason('Server returned invalid data format. Please check backend implementation.');
      }
    } catch (err: any) {
      setProjects([]);
      if (err.message.includes('503') || err.message.includes('Service Unavailable')) {
        setEmptyReason('Backend server is not running. Please ensure the backend server is started.');
      } else if (err.message.includes('Failed to fetch')) {
        setEmptyReason('Cannot connect to backend server. Please check if the server is running.');
      } else if (err.message.includes('404')) {
        setEmptyReason('Projects API endpoint not found. Backend may not have implemented GET /api/projects yet.');
      } else {
        setEmptyReason(`Failed to load projects: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);
  return (
    <div className="flex h-screen bg-gray-50">
      {/* use shared sidebar component */}
      <ShadcnSidebar />
      
      {/* main content area */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Project lists</h1>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Projects</h2>
              <button className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-50" onClick={fetchProjects}>Refresh</button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">Loading projects...</div>
            ) : projects.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-600">
                  <div className="text-base font-medium mb-1">No Projects Found</div>
                  <div className="text-sm">{emptyReason || 'No projects available.'}</div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p, idx) => (
                  <Card key={idx} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedProject(p); setShowPreview(true); }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="truncate">{p.projectName}</span>
                        <span className="text-xs text-gray-500">Project</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-1">
                      <div>Project ID: {p.projectID ?? 'N/A'}</div>
                      <div>Client: {p.client || 'N/A'}</div>
                      <div>Max Groups: {p.maxGroups}</div>
                      <div>Fields: {Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || 'N/A')}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* shadcn-like modal */}
      {showPreview && selectedProject && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 sm:p-6 overflow-y-auto"
          onClick={() => { setShowPreview(false); setSelectedProject(null); }}
        >
          <Card
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="relative pb-3">
              <CardTitle className="text-lg pr-8">Project Details: {selectedProject.projectName}</CardTitle>
              <button
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                aria-label="Close"
                onClick={() => { setShowPreview(false); setSelectedProject(null); }}
              >
                ✖
              </button>
            </CardHeader>
            <CardContent className="text-sm text-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><div className="text-xs text-gray-500">Project ID</div><div className="font-medium">{selectedProject.projectId || (selectedProject as any).projectID || 'N/A'}</div></div>
                <div className="space-y-1"><div className="text-xs text-gray-500">Project Name</div><div className="font-medium">{selectedProject.projectName}</div></div>
                <div className="space-y-1"><div className="text-xs text-gray-500">Client</div><div className="font-medium">{selectedProject.client || 'N/A'}</div></div>
                <div className="space-y-1"><div className="text-xs text-gray-500">Max Groups</div><div className="font-medium">{selectedProject.maxGroups}</div></div>
                {/* intentionally hide start/finish time to match classic */}
                <div className="md:col-span-2 space-y-1"><div className="text-xs text-gray-500">Tags</div><div className="font-medium break-words">{Array.isArray(selectedProject.tags) ? selectedProject.tags.join(', ') : (selectedProject.tags || 'N/A')}</div></div>
                <div className="md:col-span-2 space-y-1"><div className="text-xs text-gray-500">Resources Provided</div><div className="font-medium break-words">{selectedProject.resourcesProvided || 'N/A'}</div></div>
                <div className="md:col-span-2 space-y-1"><div className="text-xs text-gray-500">Deliverables</div><div className="font-medium break-words">{selectedProject.deliverables || 'N/A'}</div></div>
                <div className="md:col-span-2 space-y-1"><div className="text-xs text-gray-500">Specific Skills</div><div className="font-medium break-words">{selectedProject.specificSkills || 'N/A'}</div></div>
                <div className="md:col-span-2 space-y-1"><div className="text-xs text-gray-500">Description</div><div className="font-medium break-words">{selectedProject.description || 'N/A'}</div></div>
                <div className="md:col-span-2 space-y-1"><div className="text-xs text-gray-500">Group Names</div><div className="font-medium break-words">{Array.isArray(selectedProject.groupname) && selectedProject.groupname.length > 0 ? selectedProject.groupname.join(', ') : 'N/A'}</div></div>
              </div>
              <div className="flex items-center justify-end mt-4">
                <button className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-50" onClick={() => { setShowPreview(false); setSelectedProject(null); }}>Close</button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StudentProjectsShadcn;
