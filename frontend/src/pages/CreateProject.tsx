import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useDropzone } from 'react-dropzone'
import { projectsAPI } from '../lib/api'
import { Upload, FileText, X, ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { formatFileSize } from '../lib/utils'
import LoadingSpinner from '../components/LoadingSpinner'

interface CreateProjectForm {
  name: string
  description?: string
}

const CreateProject = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectForm>()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setSelectedFile(acceptedFiles[0])
    },
  })

  const removeFile = () => {
    setSelectedFile(null)
  }

  const onSubmit = async (data: CreateProjectForm) => {
    if (!selectedFile) {
      toast.error('Please select a PDF file')
      return
    }

    try {
      setIsLoading(true)
      const formData = new FormData()
      formData.append('name', data.name)
      if (data.description) {
        formData.append('description', data.description)
      }
      formData.append('pdf', selectedFile)

      const response = await projectsAPI.create(formData)
      toast.success('Project created successfully! PDF is being processed.')
      navigate(`/projects/${response.data.project.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Create New Project</h1>
          <p className="text-secondary-600">Upload a PDF and create an intelligent chatbot</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Project Details */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-secondary-700 mb-2">
              Project Name *
            </label>
            <input
              {...register('name', {
                required: 'Project name is required',
                minLength: {
                  value: 2,
                  message: 'Project name must be at least 2 characters',
                },
              })}
              type="text"
              id="name"
              className="input-field"
              placeholder="Enter project name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-secondary-700 mb-2">
              Description (optional)
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={3}
              className="input-field resize-none"
              placeholder="Describe your project..."
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              PDF Document *
            </label>
            
            {!selectedFile ? (
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-secondary-300 hover:border-primary-400 hover:bg-primary-50'
                  }
                `}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto text-secondary-400" size={48} />
                <p className="mt-4 text-lg font-medium text-secondary-900">
                  {isDragActive ? 'Drop the PDF here' : 'Upload PDF document'}
                </p>
                <p className="mt-2 text-sm text-secondary-600">
                  Drag and drop a PDF file, or click to browse
                </p>
                <p className="mt-1 text-xs text-secondary-500">
                  Maximum file size: 10MB
                </p>
              </div>
            ) : (
              <div className="border border-secondary-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="text-primary-600" size={24} />
                    <div>
                      <p className="font-medium text-secondary-900">{selectedFile.name}</p>
                      <p className="text-sm text-secondary-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Processing Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your PDF will be processed and text will be extracted</li>
              <li>• AI embeddings will be generated for intelligent search</li>
              <li>• A unique chat URL will be created for your customers</li>
              <li>• Processing typically takes 1-2 minutes</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedFile}
              className="btn-primary flex items-center"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Creating Project...</span>
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateProject 