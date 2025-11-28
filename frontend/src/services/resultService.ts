import api from '@/lib/api'
import { TestResult, TestResultListItem, Answer } from '@/types'

export const resultService = {
  async startTest(testId: number): Promise<{ started_at: string }> {
    const response = await api.post<{ message: string; test_id: number; started_at: string }>(
      '/results/start',
      { test_id: testId }
    )
    return { started_at: response.data.started_at }
  },

  async submitTest(testId: number, startedAt: string, answers: Answer[]): Promise<TestResult> {
    const response = await api.post<TestResult>('/results/submit', {
      test_id: testId,
      started_at: startedAt,
      answers: answers,
    })
    return response.data
  },

  async getResults(testId?: number, studentId?: number): Promise<TestResultListItem[]> {
    const params = new URLSearchParams()
    if (testId) params.append('test_id', testId.toString())
    if (studentId) params.append('student_id', studentId.toString())

    const response = await api.get<TestResultListItem[]>(`/results/?${params.toString()}`)
    return response.data
  },

  async getResult(id: number): Promise<TestResult> {
    const response = await api.get<TestResult>(`/results/${id}`)
    return response.data
  },

  async gradeAnswer(
    answerId: number,
    isCorrect: boolean,
    pointsEarned: number,
    teacherComment?: string
  ): Promise<Answer> {
    const response = await api.post<Answer>('/results/grade-answer', {
      answer_id: answerId,
      is_correct: isCorrect,
      points_earned: pointsEarned,
      teacher_comment: teacherComment,
    })
    return response.data
  },
}

