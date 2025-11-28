import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

// Function to refresh token
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh_token')
  
  if (!refreshToken) {
    return null
  }
  
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
      refresh_token: refreshToken,
    })
    
    const { access_token, refresh_token: new_refresh_token } = response.data
    
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', new_refresh_token)
    
    return access_token
  } catch (error) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    return null
  }
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // If 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            return api(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const newAccessToken = await refreshAccessToken()
        
        if (newAccessToken) {
          // Update the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          }
          
          processQueue(null)
          return api(originalRequest)
        } else {
          // Refresh failed, logout
          processQueue(new Error('Token refresh failed'))
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch (refreshError) {
        processQueue(refreshError as Error)
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export default api

