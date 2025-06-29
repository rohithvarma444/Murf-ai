import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { projectsAPI } from '../lib/api';
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  ChatBubbleLeftRightIcon,
  UsersIcon,
  EyeIcon,
  ClockIcon,
  PlusIcon,
  GlobeAltIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { HeartPulse } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  documents: Array<{
    id: string;
    filename: string;
    fileSize: number;
    createdAt: string;
  }>;
  _count: {
    chatSessions: number;
  };
}

interface Analytics {
  totalProjects: number;
  totalChats: number;
  totalVisitors: number;
  averageResponseTime: number;
  monthlyGrowth: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalProjects: 0,
    totalChats: 0,
    totalVisitors: 0,
    averageResponseTime: 2.5,
    monthlyGrowth: 15.2
  });
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadProjects();
  }, [user, navigate]);

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.data.projects);
      
      // Calculate analytics
      const totalChats = response.data.projects.reduce((acc: number, project: Project) => 
        acc + project._count.chatSessions, 0);
      
      setAnalytics({
        totalProjects: response.data.projects.length,
        totalChats,
        totalVisitors: totalChats * 3.2, // Mock calculation
        averageResponseTime: 2.5,
        monthlyGrowth: 15.2
      });
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPublicChatUrl = (projectId: string) => {
    return `${window.location.origin}/chat/${projectId}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">L</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Lyra AI</h1>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-sm text-gray-600">Enterprise Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.company}</p>
              </div>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <CogIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Chats</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalChats}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Visitors</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalVisitors.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.averageResponseTime}s</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Growth</p>
                <p className="text-2xl font-bold text-gray-900">+{analytics.monthlyGrowth}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Your Chatbots</h2>
                  <button
                    onClick={() => navigate('/create-project')}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Chatbot
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {projects.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No chatbots yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating your first chatbot from a PDF document.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate('/create-project')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create Chatbot
                      </button>
                    </div>
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                          <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                            <span>Created {formatDate(project.createdAt)}</span>
                            <span>•</span>
                            <span>{project._count.chatSessions} conversations</span>
                            <span>•</span>
                            <span>{project.documents.length} document{project.documents.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(getPublicChatUrl(project.id));
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy chat link"
                          >
                            <GlobeAltIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${project.id}`);
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <EyeIcon className="h-4 w-4" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/care/${project.id}`);
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-50 border border-red-200 rounded-md text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <HeartPulse className="h-4 w-4" />
                            <span>Customer Care</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Project Details / Quick Actions */}
          <div className="space-y-6">
            {selectedProject ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chatbot Details</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{selectedProject.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{selectedProject.description}</p>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Documents</h5>
                    {selectedProject.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate">{doc.filename}</span>
                        <span className="text-gray-500">{formatFileSize(doc.fileSize)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Public Chat Link</h5>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={getPublicChatUrl(selectedProject.id)}
                        readOnly
                        className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2"
                      />
                      <button
                        onClick={() => copyToClipboard(getPublicChatUrl(selectedProject.id))}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate(`/projects/${selectedProject.id}`)}
                      className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => window.open(getPublicChatUrl(selectedProject.id), '_blank')}
                      className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Test Chat
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/create-project')}
                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create New Chatbot
                  </button>
                  <button
                    onClick={() => navigate('/analytics')}
                    className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <ChartBarIcon className="h-4 w-4 mr-2" />
                    View Analytics
                  </button>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        New chat in {project.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(project.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 