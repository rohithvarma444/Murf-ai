import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

interface User {
  id: string
  email: string
  name: string
  company?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, company?: string) => Promise<void>
  logout: () => void
  updateProfile: (name?: string, company?: string) => Promise<void>
  setLoading: (loading: boolean) => void
  setUser: (user: User) => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      setUser: (user) => set({ user }),

      setToken: (token) => {
        set({ token })
        // Update API headers
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        } else {
          delete api.defaults.headers.common['Authorization']
        }
      },

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true })
          const response = await api.post('/auth/login', { email, password })
          const { user, token } = response.data
          
          set({ user, token, isLoading: false })
          
          // Set token in API headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (email: string, password: string, name: string, company?: string) => {
        try {
          set({ isLoading: true })
          const response = await api.post('/auth/register', { email, password, name, company })
          const { user, token } = response.data
          
          set({ user, token, isLoading: false })
          
          // Set token in API headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({ user: null, token: null })
        delete api.defaults.headers.common['Authorization']
      },

      updateProfile: async (name?: string, company?: string) => {
        try {
          const response = await api.put('/auth/me', { name, company })
          const { user } = response.data
          set({ user })
        } catch (error) {
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
) 