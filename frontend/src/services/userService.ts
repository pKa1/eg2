import api from '@/lib/api'
import { User, UserRole } from '@/types'

export const userService = {
  async getUsers(role?: UserRole, is_verified?: boolean): Promise<User[]> {
    const params = new URLSearchParams()
    if (role) params.append('role', role)
    if (typeof is_verified === 'boolean') params.append('is_verified', String(is_verified))
    const qs = params.toString()
    const response = await api.get<User[]>(`/users/${qs ? `?${qs}` : ''}`)
    return response.data
  },

  async getUser(id: number): Promise<User> {
    const response = await api.get<User>(`/users/${id}`)
    return response.data
  },

  async createUser(data: Partial<User> & { password: string }): Promise<User> {
    const response = await api.post<User>('/users/', data)
    return response.data
  },

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, data)
    return response.data
  },

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/users/${id}`)
  },

  async getParentChildren(parentId: number): Promise<User[]> {
    const response = await api.get<User[]>(`/users/parent/${parentId}/children`)
    return response.data
  },

  async getStudents(is_verified?: boolean): Promise<User[]> {
    const params = new URLSearchParams()
    if (typeof is_verified === 'boolean') params.append('is_verified', String(is_verified))
    const qs = params.toString()
    const response = await api.get<User[]>(`/users/students/all${qs ? `?${qs}` : ''}`)
    return response.data
  },

  async getVerifiedStudents(): Promise<User[]> {
    const response = await api.get<User[]>('/users/students/verified')
    return response.data
  },

  async createParentChild(parentId: number, childId: number): Promise<any> {
    const response = await api.post('/users/parent-child', {
      parent_id: parentId,
      child_id: childId,
    })
    return response.data
  },
}

