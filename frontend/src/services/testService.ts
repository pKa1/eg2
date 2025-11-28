import api from '@/lib/api'
import { Test, TestListItem, TestAssignment, TestCreatePayload, Question, QuestionCreate } from '@/types'

export const testService = {
  async getTests(): Promise<TestListItem[]> {
    const response = await api.get<TestListItem[]>('/tests/')
    return response.data
  },

  async getTest(id: number): Promise<Test> {
    const response = await api.get<Test>(`/tests/${id}`)
    return response.data
  },

  async createTest(data: TestCreatePayload): Promise<Test> {
    // Debug log: payload snapshot
    // Note: remove or lower to debug in production if needed
    // eslint-disable-next-line no-console
    console.groupCollapsed('[tests] createTest request')
    // eslint-disable-next-line no-console
    console.debug('payload', data)
    try {
      const response = await api.post<Test>('/tests/', data)
      // eslint-disable-next-line no-console
      console.debug('response status', response.status)
      // eslint-disable-next-line no-console
      console.groupEnd()
      return response.data
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('[tests] createTest error', {
        status: error?.response?.status,
        detail: error?.response?.data,
        message: error?.message,
      })
      // eslint-disable-next-line no-console
      console.groupEnd()
      throw error
    }
  },

  async updateTest(id: number, data: Partial<Test>): Promise<Test> {
    const response = await api.patch<Test>(`/tests/${id}`, data)
    return response.data
  },

  async deleteTest(id: number): Promise<void> {
    await api.delete(`/tests/${id}`)
  },

  async assignTest(testId: number, studentId: number, dueDate?: string): Promise<TestAssignment> {
    const response = await api.post<TestAssignment>(`/tests/${testId}/assign`, {
      test_id: testId,
      student_id: studentId,
      due_date: dueDate,
    })
    return response.data
  },

  async assignTestBulk(
    testId: number,
    payload: { student_ids?: number[]; group_ids?: number[]; assign_all_students?: boolean; due_date?: string }
  ): Promise<TestAssignment[]> {
    const response = await api.post<TestAssignment[]>(`/tests/${testId}/assign-bulk`, payload)
    return response.data
  },

  async getTestAssignments(testId: number): Promise<TestAssignment[]> {
    const response = await api.get<TestAssignment[]>(`/tests/${testId}/assignments`)
    return response.data
  },

  async deleteAssignment(assignmentId: number): Promise<void> {
    await api.delete(`/tests/assignments/${assignmentId}`)
  },

  // Questions CRUD
  async createQuestion(testId: number, data: QuestionCreate): Promise<Question> {
    const response = await api.post<Question>(`/tests/${testId}/questions`, data)
    return response.data
  },

  async updateQuestion(testId: number, questionId: number, data: Partial<QuestionCreate>): Promise<Question> {
    const response = await api.patch<Question>(`/tests/${testId}/questions/${questionId}`, data)
    return response.data
  },

  async deleteQuestion(questionId: number): Promise<void> {
    await api.delete(`/tests/questions/${questionId}`)
  },
}

