import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsAPI, chatAPI } from '../lib/api'
import { 
  ArrowLeftIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClockIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CogIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { formatDate, formatFileSize, copyToClipboard } from '../lib/utils'
import LoadingSpinner from '../components/LoadingSpinner'

interface Document {
  id: string
  filename: string
  fileSize: number
  createdAt: string
}

interface ChatSession {
  id: string
  sessionId: string
  language: string
  createdAt: string
  _count: {
    messages: number
  }
}

interface Project {
  id: string
  name: string
  description: string
  publicUrl: string
  createdAt: string
  documents: Document[]
  chatSessions: ChatSession[]
}

interface Analytics {
  totalSessions: number
  totalMessages: number
  averageSessionLength: number
  topLanguages: Array<{ language: string; count: number }>
  dailyVisitors: Array<{ date: string; count: number }>
  responseTime: number
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [analytics, setAnalytics] = useState<Analytics>({
    totalSessions: 0,
    totalMessages: 0,
    averageSessionLength: 0,
    topLanguages: [],
    dailyVisitors: [],
    responseTime: 2.5
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'sessions' | 'settings'>('overview')

  useEffect(() => {
    if (id) {
      loadProject()
    }
  }, [id])

  const loadProject = async () => {
    try {
      const response = await projectsAPI.getById(id!)
      setProject(response.data.project)
      
      // Calculate mock analytics
      const totalSessions = response.data.project.chatSessions.length
      const totalMessages = response.data.project.chatSessions.reduce(
        (acc: number, session: any) => acc + session._count.messages, 0
      )
      
      const languageCounts: { [key: string]: number } = {}
      response.data.project.chatSessions.forEach((session: any) => {
        languageCounts[session.language] = (languageCounts[session.language] || 0) + 1
      })
      
      const topLanguages = Object.entries(languageCounts)
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      
      setAnalytics({
        totalSessions,
        totalMessages,
        averageSessionLength: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
        topLanguages,
        dailyVisitors: generateMockDailyData(),
        responseTime: 2.5
      })
    } catch (error: any) {
      toast.error('Failed to load project')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const generateMockDailyData = () => {
    const data = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50) + 10
      })
    }
    return data
  }

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    try {
      await projectsAPI.delete(id!)
      toast.success('Project deleted successfully')
      navigate('/dashboard')
    } catch (error: any) {
      toast.error('Failed to delete project')
    }
  }

  const getPublicChatUrl = () => {
    return `${window.location.origin}/chat/${project?.id}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">{project.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => copyToClipboard(getPublicChatUrl())}
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <GlobeAltIcon className="h-4 w-4 mr-2" />
                Copy Link
              </button>
              <button
                onClick={() => window.open(getPublicChatUrl(), '_blank')}
                className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                Preview
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: ChartBarIcon },
              { id: 'analytics', name: 'Analytics', icon: ChartBarIcon },
              { id: 'sessions', name: 'Chat Sessions', icon: ChatBubbleLeftRightIcon },
              { id: 'settings', name: 'Settings', icon: CogIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 inline mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.totalSessions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Messages</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.totalMessages}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Session Length</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.averageSessionLength}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Response Time</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.responseTime}s</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {project.documents.map((doc) => (
                  <div key={doc.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.fileSize)} • Uploaded {formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Public Chat Link */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Public Chat Link</h2>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={getPublicChatUrl()}
                  readOnly
                  className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                />
                <button
                  onClick={() => copyToClipboard(getPublicChatUrl())}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => window.open(getPublicChatUrl(), '_blank')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Top Languages */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Languages</h2>
              <div className="space-y-3">
                {analytics.topLanguages.map((lang) => (
                  <div key={lang.language} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{lang.language}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(lang.count / analytics.totalSessions) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500 w-8 text-right">{lang.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Visitors Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Visitors (Last 7 Days)</h2>
              <div className="h-64 flex items-end justify-between space-x-2">
                {analytics.dailyVisitors.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-600 rounded-t"
                      style={{ height: `${(day.count / 60) * 200}px` }}
                    ></div>
                    <span className="text-xs text-gray-500 mt-2">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-xs font-medium text-gray-900">{day.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Chat Sessions</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {project.chatSessions.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No chat sessions yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Chat sessions will appear here once users start conversations.
                  </p>
                </div>
              ) : (
                project.chatSessions.map((session) => (
                  <div key={session.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <UsersIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Session {session.sessionId.slice(-8)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {session._count.messages} messages • {session.language} • {formatDate(session.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/chat/${project.id}/session/${session.sessionId}`)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                  <input
                    type="text"
                    defaultValue={project.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    defaultValue={project.description}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h2>
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-red-900">Delete Project</h3>
                    <p className="text-sm text-red-700 mt-1">
                      This action cannot be undone. This will permanently delete the project and all associated data.
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteProject}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4 inline mr-2" />
                    Delete Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectDetails 