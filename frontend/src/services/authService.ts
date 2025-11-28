import api from '@/lib/api'
import { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types'

export const authService = {
  async login(data: LoginRequest): Promise<TokenResponse> {
    const formData = new URLSearchParams()
    formData.append('username', data.username)
    formData.append('password', data.password)

    const response = await api.post<TokenResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    // Store tokens
    localStorage.setItem('access_token', response.data.access_token)
    localStorage.setItem('refresh_token', response.data.refresh_token)

    return response.data
  },

  async register(data: RegisterRequest): Promise<User> {
    const response = await api.post<User>('/auth/register', data)
    return response.data
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  async refreshToken(): Promise<TokenResponse> {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      throw new Error('Refresh token not found')
    }

    const response = await api.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    })

    // Store new tokens
    localStorage.setItem('access_token', response.data.access_token)
    localStorage.setItem('refresh_token', response.data.refresh_token)

    return response.data
  },

  logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },
}

