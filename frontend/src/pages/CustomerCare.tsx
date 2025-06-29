import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { 
  MicrophoneIcon, 
  PaperAirplaneIcon, 
  SpeakerWaveIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  StarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageSelector from '../components/LanguageSelector'

interface CareMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  emotion?: {
    primaryEmotion: string
    confidence: number
    emotionColor: string
    emotionIcon: string
    emotionDescription: string
  }
  audioUrl?: string
}

interface SessionStats {
  messageCount: number
  avgResponseTime: number
  priority: 'normal' | 'high'
}

const CustomerCare: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<CareMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [satisfaction, setSatisfaction] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [agentTyping, setAgentTyping] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioChunkQueue = useRef<ArrayBuffer[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001')
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to customer care service')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from customer care service')
      setIsConnected(false)
    })

    newSocket.on('care_session_joined', (session) => {
      console.log('Joined care session:', session)
      setSessionId(session.sessionId)
      setTtsEnabled(session.ttsEnabled !== false)
      // Add welcome message
      const welcomeMsg: CareMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: session.welcomeMessage,
        timestamp: new Date()
      }
      setMessages([welcomeMsg])
    })

    newSocket.on('care_message', (data) => {
      // Update TTS status if provided
      if (data.ttsEnabled !== undefined) {
        setTtsEnabled(data.ttsEnabled)
      }
    })

    newSocket.on('care_response', (data) => {
      console.log('Received care response:', data)
      setAgentTyping(false)
      const assistantMsg: CareMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: data.message,
        timestamp: new Date(data.timestamp),
      }
      setMessages(prev => [...prev, assistantMsg])
      setSessionStats({
        messageCount: data.sessionStats?.messageCount || 0,
        avgResponseTime: data.sessionStats?.avgResponseTime || 0,
        priority: data.sessionStats?.priority || 'normal'
      })
    })

    newSocket.on('care_audio_chunk', (data) => {
      if (data.audioChunk && ttsEnabled) {
        const chunk = data.audioChunk instanceof ArrayBuffer ? data.audioChunk : new ArrayBuffer(0);
        audioChunkQueue.current.push(chunk);
        processAudioQueue();
      }
    });

    newSocket.on('care_session_ended', (summary) => {
      console.log('Session ended:', summary)
      setShowFeedback(true)
    })

    newSocket.on('care_error', (error) => {
      console.error('Care service error:', error)
      
      // Handle specific TTS-related errors
      if (error.error && error.error.includes('context limit')) {
        setTtsEnabled(false)
        // Show a more user-friendly message
        const errorMsg: CareMessage = {
          id: Date.now().toString(),
          type: 'assistant',
          content: "I'm experiencing some technical difficulties with voice features, but I can still help you with text-based support. Please continue typing your questions.",
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMsg])
      } else {
        // Show general error alert for other issues
        alert(`Error: ${error.error}`)
      }
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const processAudioQueue = () => {
    if (audioChunkQueue.current.length === 0) return;
    if (!sourceBufferRef.current || sourceBufferRef.current.updating) return;

    const chunk = audioChunkQueue.current.shift();
    if (chunk) {
      try {
        sourceBufferRef.current.appendBuffer(chunk);
      } catch (e) {
        console.error('Error appending buffer:', e);
        // If there's an error, try to reset or handle it
      }
    }
  }

  useEffect(() => {
    mediaSourceRef.current = new MediaSource();
    const mediaSource = mediaSourceRef.current;

    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(mediaSource);
    }

    const onSourceOpen = () => {
      if (!audioRef.current) return;
      URL.revokeObjectURL(audioRef.current.src);
      try {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        sourceBufferRef.current = sourceBuffer;
        sourceBuffer.addEventListener('updateend', processAudioQueue);
      } catch (e) {
        console.error("Error adding source buffer:", e);
      }
    };

    mediaSource.addEventListener('sourceopen', onSourceOpen);

    return () => {
      mediaSource.removeEventListener('sourceopen', onSourceOpen);
      if (sourceBufferRef.current) {
        sourceBufferRef.current.removeEventListener('updateend', processAudioQueue);
      }
    };
  }, []);

  // Join care session
  useEffect(() => {
    if (socket && isConnected && projectId) {
      const customerId = `customer_${Date.now()}`
      const customerInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timestamp: new Date().toISOString()
      }

      socket.emit('join_care_session', {
        customerId,
        projectId,
        language: selectedLanguage,
        customerInfo
      })
    }
  }, [socket, isConnected, projectId, selectedLanguage])

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !socket || !sessionId) return

    const userMessage: CareMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setAgentTyping(true)

    socket.emit('care_message', {
      sessionId,
      message: inputMessage,
      messageType: 'text'
    })

    setInputMessage('')
  }, [inputMessage, socket, sessionId])

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

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
      alert('Failed to start voice recording')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleVoiceMessage = async (audioBlob: Blob) => {
    if (!socket || !sessionId) return;

    const arrayBuffer = await audioBlob.arrayBuffer();

    const userMessage: CareMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: '[Voice Message]',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setAgentTyping(true)

    socket.emit('care_voice_message', {
      sessionId,
      audioBuffer: arrayBuffer
    })
  }

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  }

  const endSession = () => {
    if (socket && sessionId) {
      socket.emit('end_care_session', {
        sessionId,
        satisfactionRating: satisfaction,
        feedback
      })
    }
  }

  const getEmotionColor = (emotion?: string) => {
    const colors = {
      happy: 'text-green-500',
      sad: 'text-blue-500',
      angry: 'text-red-500',
      frustrated: 'text-orange-500',
      excited: 'text-purple-500',
      calm: 'text-blue-400',
      default: 'text-gray-500'
    }
    return colors[emotion as keyof typeof colors] || colors.default
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <audio ref={audioRef} autoPlay />
        <div className="flex flex-col flex-1">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-600" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI Customer Care
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              Get instant help from our AI-powered customer support
            </p>
            
            {/* Connection Status */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              
              {ttsEnabled && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  <SpeakerWaveIcon className="h-4 w-4" />
                  Voice Enabled
                </div>
              )}
              
              {!ttsEnabled && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  Text Only
                </div>
              )}
              
              {sessionStats && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  sessionStats.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {sessionStats.priority === 'high' ? 'Priority Support' : 'Standard Support'}
                </div>
              )}
            </div>
          </motion.div>

          {/* Language Selector */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center mb-6"
          >
            <LanguageSelector 
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
            />
          </motion.div>

          {/* Chat Interface */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Chat Messages */}
            <div className="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white ml-auto' 
                        : 'bg-white border border-gray-200 mr-auto shadow-sm'
                    }`}>
                      <p className={`text-sm ${message.type === 'user' ? 'text-white' : 'text-gray-800'}`}>
                        {message.content}
                      </p>
                      
                      {message.emotion && (
                        <div className={`mt-2 text-xs ${getEmotionColor(message.emotion.primaryEmotion)}`}>
                          {message.emotion.emotionIcon} {message.emotion.emotionDescription}
                        </div>
                      )}
                      
                      {message.audioUrl && (
                        <button
                          onClick={() => playAudio(message.audioUrl!)}
                          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <SpeakerWaveIcon className="h-4 w-4" />
                          Play Audio
                        </button>
                      )}
                      
                      <div className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Agent Typing Indicator */}
              {agentTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                      <span className="text-xs text-gray-500">Agent is typing...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type your message..."
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!isConnected || isLoading}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || !isConnected || isLoading}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                    >
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <button
                    onClick={handleToggleRecording}
                    disabled={!ttsEnabled}
                    className={`p-3 rounded-full transition-all duration-300 ${
                      isRecording 
                        ? 'bg-red-500 shadow-lg scale-110' 
                        : ttsEnabled 
                          ? 'bg-primary-500 hover:bg-primary-600' 
                          : 'bg-gray-400 cursor-not-allowed'
                    }`}
                    title={ttsEnabled ? 'Record voice message' : 'Voice features temporarily unavailable'}
                  >
                    <MicrophoneIcon className="h-6 w-6 text-white" />
                  </button>
                </motion.div>
                
                <button
                  onClick={() => setShowFeedback(true)}
                  className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                >
                  End Chat
                </button>
              </div>
              
              {sessionStats && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span>Messages: {sessionStats.messageCount}</span>
                  <span>Avg Response: {Math.round(sessionStats.avgResponseTime)}ms</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Feedback Modal */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-8 max-w-md w-full mx-4"
                >
                  <div className="text-center mb-6">
                    <HeartIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      How was your experience?
                    </h3>
                    <p className="text-gray-600">
                      Your feedback helps us improve our service
                    </p>
                  </div>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setSatisfaction(star)}
                        className={`p-1 ${satisfaction >= star ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                      >
                        <StarIcon className="h-8 w-8 fill-current" />
                      </button>
                    ))}
                  </div>

                  {/* Feedback Text */}
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us about your experience..."
                    className="w-full p-3 border border-gray-300 rounded-xl resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowFeedback(false)}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                    >
                      Skip
                    </button>
                    <button
                      onClick={endSession}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700"
                    >
                      Submit
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default CustomerCare 