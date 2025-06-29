import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

export const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from Zustand store
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API functions
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (email: string, password: string, name: string, company?: string) =>
    api.post('/auth/register', { email, password, name, company }),
  
  getProfile: () => api.get('/auth/me'),
  
  updateProfile: (name?: string, company?: string) =>
    api.put('/auth/me', { name, company }),
}

export const projectsAPI = {
  getAll: () => api.get('/projects'),
  
  getById: (id: string) => api.get(`/projects/${id}`),
  
  create: (data: FormData) =>
    api.post('/projects', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/projects/${id}`, data),
  
  delete: (id: string) => api.delete(`/projects/${id}`),
  
  getPublic: (publicUrl: string) => api.get(`/projects/public/${publicUrl}`),
}

export const chatAPI = {
  sendMessage: (projectId: string, message: string, language: string) =>
    api.post(`/chat/${projectId}`, { message, language }),
  
  sendVoiceMessage: (projectId: string, audioFile: File, language: string) => {
    const formData = new FormData()
    formData.append('audio', audioFile)
    formData.append('language', language)
    
    return api.post(`/chat/${projectId}/voice`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  getLanguages: () => api.get('/chat/languages'),
  
  getPublic: (projectId: string) => api.get(`/chat/${projectId}/public`),
}

// Enhanced chat API with TTS and emotion detection
export const enhancedChatAPI = {
  // Enhanced text chat with emotion detection and optional TTS
  sendEnhancedMessage: (message: string, language: string, projectId?: string, generateAudio: boolean = false) =>
    api.post('/chat/enhanced', { message, language, projectId, generateAudio }),
  
  // Enhanced voice chat with emotion detection and optional TTS
  sendEnhancedVoiceMessage: (audioFile: File, language: string, generateAudio: boolean = false) => {
    const formData = new FormData()
    formData.append('audio', audioFile)
    formData.append('language', language)
    formData.append('generateAudio', generateAudio.toString())
    
    return api.post('/voice-chat/enhanced', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  // Regular voice chat (existing functionality)
  sendVoiceMessage: (audioFile: File, language: string) => {
    const formData = new FormData()
    formData.append('audio', audioFile)
    formData.append('language', language)
    
    return api.post('/voice-chat', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

// TTS API
export const ttsAPI = {
  generateSpeech: (text: string, language: string, options?: {
    format?: string;
    channelType?: string;
    sampleRate?: number;
    encodeAsBase64?: boolean;
  }) =>
    api.post('/tts/generate', { text, language, options }),
  
  getAvailableVoices: (language: string) =>
    api.get(`/tts/voices/${language}`),
  
  getSupportedLanguages: () =>
    api.get('/tts/languages'),
}

// Emotion detection API
export const emotionAPI = {
  detectEmotion: (text: string, language: string) =>
    api.post('/emotion/detect', { text, language }),
}

// Translation API
export const translationAPI = {
  translateText: (text: string, targetLanguage: string) =>
    api.post('/translate', { sentences: [text], targetLanguage }),
  
  testTranslation: (text: string, targetLanguage: string, sourceLanguage?: string) =>
    api.post('/test-translate', { text, targetLanguage, sourceLanguage }),
}

// Speech-to-text API
export const sttAPI = {
  transcribeAudio: (audioFile: File, language: string) => {
    const formData = new FormData()
    formData.append('audio', audioFile)
    formData.append('language', language)
    
    return api.post('/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

// Dubbing API
export const dubbingAPI = {
  getSupportedLanguages: () => api.get('/dubbing/languages'),
  
  createDubbingJob: (formData: FormData) =>
    api.post('/dubbing/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  createDubbingJobFromUrl: (data: {
    fileName: string
    fileUrl: string
    targetLocales: string[]
    priority?: 'LOW' | 'NORMAL' | 'HIGH'
    projectName?: string
    persistent?: boolean
  }) => api.post('/dubbing/create-url', data),
  
  getDubbingJobStatus: (jobId: string) => api.get(`/dubbing/status/${jobId}`),
  
  downloadDubbedContent: (downloadUrl: string, fileName: string) =>
    api.post('/dubbing/download', { downloadUrl, fileName }),
  
  estimateCost: (durationMinutes: number, targetLocales: string[]) =>
    api.post('/dubbing/estimate-cost', { durationMinutes, targetLocales }),
  
  validateLanguages: (targetLocales: string[]) =>
    api.post('/dubbing/validate-languages', { targetLocales }),
  
  getHealth: () => api.get('/dubbing/health'),
} 