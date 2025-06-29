import React, { useState, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  CloudArrowUpIcon, 
  FilmIcon,
  SpeakerWaveIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline'
import { api } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

interface DubbingJob {
  jobId: string
  fileName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  targetLocales: Array<{
    code: string
    name: string
    status: string
    downloadUrl?: string
    downloadSrtUrl?: string
  }>
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  createdAt: string
  estimatedCredits: number
}

interface LanguageOption {
  code: string
  name: string
}

const DubbingStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['fr_FR'])
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([])
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('LOW')
  const [projectName, setProjectName] = useState('')
  const [isPersistent, setIsPersistent] = useState(false)
  const [dubbingJobs, setDubbingJobs] = useState<DubbingJob[]>(() => {
    // Load from localStorage on first render
    const stored = localStorage.getItem('dubbingJobs')
    if (stored) {
      try {
        return JSON.parse(stored) as DubbingJob[]
      } catch (_) {
        return []
      }
    }
    return []
  })
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState<any>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false)
  const [fileUrl, setFileUrl] = useState('')
  const [useFileUrl, setUseFileUrl] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Map of jobId to polling interval
  const pollingRefs = useRef<Record<string, NodeJS.Timeout>>({})

  // Load supported languages
  React.useEffect(() => {
    const loadLanguages = async () => {
      try {
        setIsLoadingLanguages(true)
        const response = await api.get('/dubbing/languages')
        setAvailableLanguages(response.data.data.destinationLanguages)
      } catch (error) {
        console.error('Failed to load languages:', error)
        toast.error('Failed to load supported languages')
      } finally {
        setIsLoadingLanguages(false)
      }
    }

    loadLanguages()
  }, [])

  // File dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      setUseFileUrl(false)
      
      // Get video duration for cost estimation
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          setVideoDuration(video.duration / 60) // Convert to minutes
        }
        video.src = URL.createObjectURL(file)
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv'],
      'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false
  })

  // Estimate cost when duration or languages change
  React.useEffect(() => {
    if (videoDuration > 0 && selectedLanguages.length > 0) {
      estimateDubbingCost()
    }
  }, [videoDuration, selectedLanguages])

  const estimateDubbingCost = async () => {
    try {
      const response = await api.post('/dubbing/estimate-cost', {
        durationMinutes: videoDuration,
        targetLocales: selectedLanguages
      })
      setEstimatedCost(response.data.data)
    } catch (error) {
      console.error('Failed to estimate cost:', error)
    }
  }

  const createDubbingJob = async () => {
    try {
      setIsCreatingJob(true)
      
      let response
      if (useFileUrl && fileUrl) {
        // Create job with URL
        response = await api.post('/dubbing/create-url', {
          fileName: projectName || 'Video Content',
          fileUrl,
          targetLocales: selectedLanguages,
          priority,
          projectName: projectName || undefined,
          persistent: isPersistent
        })
      } else if (selectedFile) {
        // Create job with file upload
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('fileName', projectName || selectedFile.name)
        formData.append('targetLocales', JSON.stringify(selectedLanguages))
        formData.append('priority', priority)
        formData.append('persistent', isPersistent.toString())
        if (projectName) {
          formData.append('projectName', projectName)
        }

        response = await api.post('/dubbing/create', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      } else {
        throw new Error('No file or URL provided')
      }

      const jobData = response.data.data
      
      // Add job to list
      const newJob: DubbingJob = {
        jobId: jobData.jobId,
        fileName: jobData.fileName,
        status: 'pending',
        targetLocales: selectedLanguages.map(code => ({
          code,
          name: availableLanguages.find(lang => lang.code === code)?.name || code,
          status: 'pending'
        })),
        priority: jobData.priority,
        createdAt: jobData.timestamp,
        estimatedCredits: estimatedCost?.estimatedCredits || 0
      }

      setDubbingJobs(prev => [newJob, ...prev])
      
      // Start polling for status
      startPollingJobStatus(jobData.jobId)
      
      // Reset form
      setSelectedFile(null)
      setFileUrl('')
      setProjectName('')
      setVideoDuration(0)
      setEstimatedCost(null)
      
      toast.success('Dubbing job created successfully!')

    } catch (error: any) {
      console.error('Failed to create dubbing job:', error)
      toast.error(error.response?.data?.error || 'Failed to create dubbing job')
    } finally {
      setIsCreatingJob(false)
    }
  }

  const startPollingJobStatus = (jobId: string) => {
    // Avoid duplicate polling intervals
    if (pollingRefs.current[jobId]) return

    pollingRefs.current[jobId] = setInterval(async () => {
      try {
        const response = await api.get(`/dubbing/status/${jobId}`)
        const statusData = response.data.data

        setDubbingJobs(prev => prev.map(job => {
          if (job.jobId === jobId) {
            const updatedLocales = job.targetLocales.map(locale => {
              const downloadDetail = statusData.downloadDetails?.find(
                (detail: any) => detail.locale === locale.code
              )
              return {
                ...locale,
                status: downloadDetail?.status || 'pending',
                downloadUrl: downloadDetail?.download_url,
                downloadSrtUrl: downloadDetail?.download_srt_url
              }
            })

            return {
              ...job,
              status: statusData.status,
              targetLocales: updatedLocales
            }
          }
          return job
        }))

        // Stop polling if job is completed or failed
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          clearInterval(pollingRefs.current[jobId])
          delete pollingRefs.current[jobId]
          
          if (statusData.status === 'completed') {
            toast.success(`Dubbing job ${jobId} completed!`)
          } else {
            toast.error(`Dubbing job ${jobId} failed`)
          }
        }

      } catch (error) {
        console.error('Failed to get job status:', error)
      }
    }, 5000) // Poll every 5 seconds
  }

  // On mount, resume polling for any in-progress jobs
  React.useEffect(() => {
    dubbingJobs.forEach(job => {
      if (job.status !== 'completed' && job.status !== 'failed') {
        startPollingJobStatus(job.jobId)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const downloadDubbedContent = async (downloadUrl: string, fileName: string) => {
    try {
      const response = await api.post('/dubbing/download', {
        downloadUrl,
        fileName
      })
      
      toast.success('Download started!')
      
      // Create download link
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Failed to download content:', error)
      toast.error('Failed to download content')
    }
  }

  const toggleLanguage = (languageCode: string) => {
    setSelectedLanguages(prev => 
      prev.includes(languageCode)
        ? prev.filter(code => code !== languageCode)
        : [...prev, languageCode]
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-100'
      case 'NORMAL': return 'text-yellow-600 bg-yellow-100'
      case 'LOW': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100'
      case 'processing': return 'text-blue-600 bg-blue-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // Persist jobs to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('dubbingJobs', JSON.stringify(dubbingJobs))
  }, [dubbingJobs])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FilmIcon className="h-12 w-12 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Dubbing Studio
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Create high-quality dubbing for your videos in multiple languages
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <CloudArrowUpIcon className="h-6 w-6 text-purple-600" />
                Upload Content
              </h2>

              {/* File Upload Toggle */}
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUseFileUrl(false)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    !useFileUrl ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUseFileUrl(true)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    useFileUrl ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Use URL
                </button>
              </div>

              {/* File Upload */}
              {!useFileUrl ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragActive 
                      ? 'border-purple-400 bg-purple-50' 
                      : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <CloudArrowUpIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  {selectedFile ? (
                    <div>
                      <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      {videoDuration > 0 && (
                        <p className="text-sm text-purple-600 mt-2">
                          Duration: {videoDuration.toFixed(1)} minutes
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        {isDragActive ? 'Drop the file here...' : 'Drag & drop your video or audio file'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports MP4, AVI, MOV, MP3, WAV and more (up to 100MB)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // URL Input
                <div className="space-y-4">
                  <input
                    type="url"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="Enter video/audio URL..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {fileUrl && (
                    <div className="p-4 bg-purple-50 rounded-xl">
                      <p className="text-sm text-purple-700">
                        <strong>URL:</strong> {fileUrl}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Project Settings */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Awesome Video Project"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="NORMAL">Normal Priority</option>
                      <option value="HIGH">High Priority</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPersistent}
                        onChange={(e) => setIsPersistent(e.target.checked)}
                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Persistent Project</span>
                        <p className="text-xs text-gray-500">Enable editing and QA features</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Language Selection */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Target Languages ({selectedLanguages.length} selected)
                </label>
                
                {isLoadingLanguages ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {availableLanguages.map((language) => (
                      <button
                        key={language.code}
                        onClick={() => toggleLanguage(language.code)}
                        className={`p-3 text-left rounded-lg border-2 transition-all ${
                          selectedLanguages.includes(language.code)
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <GlobeAltIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{language.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cost Estimation */}
              {estimatedCost && (
                <div className="mt-6 p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CurrencyDollarIcon className="h-5 w-5 text-purple-600" />
                    <h3 className="font-medium text-purple-900">Cost Estimation</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-purple-600">Credits:</span>
                      <p className="font-medium">{estimatedCost.estimatedCredits.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-purple-600">Duration:</span>
                      <p className="font-medium">{estimatedCost.durationMinutes.toFixed(1)} min</p>
                    </div>
                    <div>
                      <span className="text-purple-600">Languages:</span>
                      <p className="font-medium">{estimatedCost.languageCount}</p>
                    </div>
                    <div>
                      <span className="text-purple-600">Rate:</span>
                      <p className="font-medium">{estimatedCost.creditsPerMinute}/min</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">{estimatedCost.note}</p>
                </div>
              )}

              {/* Create Job Button */}
              <button
                onClick={createDubbingJob}
                disabled={isCreatingJob || (!selectedFile && !fileUrl) || selectedLanguages.length === 0}
                className="w-full mt-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isCreatingJob ? (
                  <>
                    <LoadingSpinner />
                    Creating Dubbing Job...
                  </>
                ) : (
                  <>
                    <SpeakerWaveIcon className="h-6 w-6" />
                    Create Dubbing Job
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Jobs Status Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ClockIcon className="h-6 w-6 text-blue-600" />
                Dubbing Jobs
              </h2>

              {dubbingJobs.length === 0 ? (
                <div className="text-center py-8">
                  <FilmIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No dubbing jobs yet</p>
                  <p className="text-sm text-gray-400">Create your first dubbing job to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dubbingJobs.map((job) => (
                    <div key={job.jobId} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.fileName}</h3>
                          <p className="text-sm text-gray-500">{job.jobId}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                            {job.priority}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {job.targetLocales.map((locale) => (
                          <div key={locale.code} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{locale.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(locale.status)}`}>
                                {locale.status}
                              </span>
                              {locale.downloadUrl && (
                                <button
                                  onClick={() => downloadDubbedContent(locale.downloadUrl!, `${job.fileName}_${locale.code}`)}
                                  className="p-1 text-blue-600 hover:text-blue-800"
                                  title="Download"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                        <div className="flex justify-between">
                          <span>Created: {new Date(job.createdAt).toLocaleString()}</span>
                          <span>Credits: {job.estimatedCredits.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DubbingStudio
