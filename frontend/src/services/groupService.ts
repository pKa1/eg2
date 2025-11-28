import api from '@/lib/api'

export interface GroupPayload {
  name: string
  description?: string
}

export interface Group {
  id: number
  name: string
  description?: string
  creator_id: number
  created_at: string
}

export interface GroupMembership {
  id: number
  group_id: number
  student_id: number
  added_by_id?: number
  created_at: string
}

export const groupService = {
  async list(): Promise<Group[]> {
    const res = await api.get<Group[]>('/groups/')
    return res.data
  },

  async get(id: number): Promise<Group> {
    const res = await api.get<Group>(`/groups/${id}`)
    return res.data
  },

  async create(data: GroupPayload): Promise<Group> {
    const res = await api.post<Group>('/groups/', data)
    return res.data
  },

  async update(id: number, data: Partial<GroupPayload>): Promise<Group> {
    const res = await api.patch<Group>(`/groups/${id}`, data)
    return res.data
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/groups/${id}`)
  },

  async listMembers(groupId: number): Promise<GroupMembership[]> {
    const res = await api.get<GroupMembership[]>(`/groups/${groupId}/members`)
    return res.data
  },

  async addMember(groupId: number, studentId: number): Promise<GroupMembership> {
    const res = await api.post<GroupMembership>(`/groups/${groupId}/members`, {
      group_id: groupId,
      student_id: studentId,
    })
    return res.data
  },

  async removeMember(groupId: number, studentId: number): Promise<void> {
    await api.delete(`/groups/${groupId}/members/${studentId}`)
  },

  async assignTestToGroup(testId: number, groupId: number, dueDate?: string): Promise<any> {
    const params: Record<string, any> = { group_id: groupId }
    if (dueDate) params['due_date'] = dueDate
    const res = await api.post(`/tests/${testId}/assign-group`, null, { params })
    return res.data
  },
}


