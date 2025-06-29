import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { enhancedChatAPI, ttsAPI, emotionAPI } from '../lib/api'
import LanguageSelector from '../components/LanguageSelector'
import LoadingSpinner from '../components/LoadingSpinner'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  emotion?: {
    primaryEmotion: string
    confidence: number
    emotions: Record<string, number>
    wordMapping: Array<{
      word: string
      index: number
      emotion: string
      confidence: number
    }>
    emotionColor: string
    emotionIcon: string
    emotionDescription: string
  }
  audio?: {
    audioUrl: string
    voiceId: string
    language: string
    format: string
  }
}

interface Project {
  id: string
  name: string
  description: string
  publicUrl: string
}

const PublicChat: React.FC = () => {
  const { publicUrl } = useParams<{ publicUrl: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoading(true)
        // For now, we'll use a mock project since the endpoint might not exist
        setProject({
          id: 'mock-project',
          name: 'AI Chat Assistant',
          description: 'A multilingual AI chatbot with voice support',
          publicUrl: publicUrl || 'demo'
        })
      } catch (error) {
        console.error('Failed to load project:', error)
        setError('Failed to load chat project')
      } finally {
        setIsLoading(false)
      }
    }

    if (publicUrl) {
      loadProject()
    }
  }, [publicUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleVoiceMessage(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      setError('Failed to start voice recording')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleVoiceMessage = async (audioBlob: Blob) => {
    try {
      setIsLoading(true)
      setError(null)

      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })
      
      const response = await enhancedChatAPI.sendEnhancedVoiceMessage(
        audioFile, 
        selectedLanguage, 
        true // Generate audio for response
      )

      const { transcription, finalResponse, emotion, audio } = response.data

      // Add user message (transcription)
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: transcription,
        timestamp: new Date()
      }

      // Add assistant message with emotion and audio
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: finalResponse,
        timestamp: new Date(),
        emotion: emotion,
        audio: audio
      }

      setMessages(prev => [...prev, userMessage, assistantMessage])
      setInputMessage('')

    } catch (error) {
      console.error('Voice message error:', error)
      setError('Failed to process voice message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTextMessage = async () => {
    if (!inputMessage.trim()) return

    try {
      setIsLoading(true)
      setError(null)

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: inputMessage,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage])
      const currentMessage = inputMessage
      setInputMessage('')

      const response = await enhancedChatAPI.sendEnhancedMessage(
        currentMessage, 
        selectedLanguage, 
        undefined, // No project ID for public chat
        true // Generate audio
      )

      const { response: aiResponse, emotion, audio } = response.data

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        emotion: emotion,
        audio: audio
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      console.error('Text message error:', error)
      setError('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const playAudio = async (audioUrl: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        await audioRef.current.play()
      }
    } catch (error) {
      console.error('Failed to play audio:', error)
      setError('Failed to play audio')
    }
  }

  const generateAudioForMessage = async (messageId: string, text: string) => {
    try {
      setIsGeneratingAudio(true)
      const response = await ttsAPI.generateSpeech(text, selectedLanguage)
      const { audioUrl } = response.data

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, audio: { audioUrl, voiceId: 'generated', language: selectedLanguage, format: 'MP3' } }
          : msg
      ))
    } catch (error) {
      console.error('Failed to generate audio:', error)
      setError('Failed to generate audio')
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const renderEmotionText = (text: string, wordMapping: ChatMessage['emotion']['wordMapping']) => {
    if (!wordMapping || wordMapping.length === 0) {
      return <span>{text}</span>
    }

    const words = text.split(' ')
    return words.map((word, index) => {
      const mapping = wordMapping.find(m => m.index === index)
      if (mapping && mapping.confidence > 0.3) {
        const emotionColors = {
          joy: '#FFD700',
          sadness: '#4682B4',
          anger: '#DC143C',
          fear: '#8B4513',
          surprise: '#FF69B4',
          disgust: '#228B22',
          trust: '#4169E1',
          anticipation: '#FF8C00',
          neutral: '#808080'
        }
        
        return (
          <span
            key={index}
            style={{
              backgroundColor: emotionColors[mapping.emotion as keyof typeof emotionColors] || '#808080',
              color: 'white',
              padding: '2px 4px',
              borderRadius: '4px',
              margin: '0 1px',
              fontSize: '0.9em'
            }}
            title={`${mapping.emotion} (${Math.round(mapping.confidence * 100)}%)`}
          >
            {word}
          </span>
        )
      }
      return <span key={index}>{word} </span>
    })
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project?.name || 'AI Chat Assistant'}
              </h1>
              <p className="text-gray-600 mt-1">
                {project?.description || 'Multilingual AI chatbot with voice support'}
              </p>
            </div>
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
            />
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-4">🤖</div>
                <p className="text-lg font-medium">Welcome to the AI Chat Assistant!</p>
                <p className="text-sm mt-2">Start a conversation by typing a message or using voice input.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {/* Message content with emotion highlighting */}
                    <div className="mb-2">
                      {message.emotion?.wordMapping ? (
                        renderEmotionText(message.content, message.emotion.wordMapping!)
                      ) : (
                        <span>{message.content}</span>
                      )}
                    </div>

                    {/* Emotion indicator */}
                    {message.emotion && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{message.emotion.emotionIcon}</span>
                        <span className="text-xs opacity-75">
                          {message.emotion.emotionDescription} 
                          ({Math.round(message.emotion.confidence * 100)}%)
                        </span>
                      </div>
                    )}

                    {/* Audio controls */}
                    {message.type === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2">
                        {message.audio ? (
                          <button
                            onClick={() => playAudio(message.audio!.audioUrl)}
                            className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                          >
                            🔊 Play Audio
                          </button>
                        ) : (
                          <button
                            onClick={() => generateAudioForMessage(message.id, message.content)}
                            disabled={isGeneratingAudio}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            {isGeneratingAudio ? '🎵 Generating...' : '🎵 Generate Audio'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-6 py-3 bg-red-50 border-t border-red-200">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Input area */}
          <div className="border-t bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              {/* Voice recording button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`p-3 rounded-full transition-colors ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } disabled:opacity-50`}
                title={isRecording ? 'Stop recording' : 'Start voice recording'}
              >
                {isRecording ? '⏹️' : '🎤'}
              </button>

              {/* Text input */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTextMessage()}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />

              {/* Send button */}
              <button
                onClick={handleTextMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="mt-2 text-center">
                <p className="text-sm text-red-600 animate-pulse">
                  🎤 Recording... Click the button again to stop
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}

export default PublicChat