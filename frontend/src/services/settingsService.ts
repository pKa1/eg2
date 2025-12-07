import api from '@/lib/api'
import { GradeSettings } from '@/types'

class SettingsService {
  async getGradeSettings(): Promise<GradeSettings> {
    const response = await api.get<GradeSettings>('/settings/grades')
    return response.data
  }

  async updateGradeSettings(payload: GradeSettings): Promise<GradeSettings> {
    const response = await api.put<GradeSettings>('/settings/grades', payload)
    return response.data
  }
}

export const settingsService = new SettingsService()


