// User types
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
}

export enum StudentGender {
  MALE = 'male',
  FEMALE = 'female',
}

export interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  avatar_url?: string
  phone?: string
  gender?: StudentGender
  date_of_birth?: string
  school_name?: string
  class_number?: number
  class_letter?: string
  created_at: string
  last_login?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  full_name: string
  password: string
  role: UserRole
  phone: string
  gender: StudentGender
  date_of_birth: string
  school_name: string
  class_number: number
  class_letter: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// Test types
export enum TestStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum QuestionType {
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
  ESSAY = 'essay',
  MATCHING = 'matching',
  FILL_IN_BLANK = 'fill_in_blank',
  ORDERING = 'ordering',
  NUMERIC = 'numeric',
  FILE_UPLOAD = 'file_upload',
  CODE = 'code',
}

export enum TestResultStatus {
  AUTO_COMPLETED = 'auto_completed',
  PENDING_MANUAL = 'pending_manual',
  COMPLETED = 'completed',
}

export interface QuestionOption {
  id?: number
  option_text: string
  is_correct: boolean
  order: number
  matching_pair?: string
}

export interface Question {
  id?: number
  question_text: string
  question_type: QuestionType
  points: number
  order: number
  correct_answer_text?: string
  explanation?: string
  options: QuestionOption[]
}

// Create payload types (frontend → backend)
export interface QuestionOptionCreate {
  option_text: string
  is_correct: boolean
  order: number
  matching_pair?: string
}

export interface QuestionCreatePayload {
  question_text: string
  question_type: QuestionType
  points: number
  order: number
  correct_answer_text?: string
  explanation?: string
  options: QuestionOptionCreate[]
}

export interface TestCreatePayload {
  title: string
  description?: string
  duration_minutes?: number | null
  passing_score: number
  max_attempts?: number | null
  show_results: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  status: TestStatus
  questions: QuestionCreatePayload[]
}

export interface Test {
  id: number
  title: string
  description?: string
  duration_minutes?: number
  passing_score: number
  max_attempts?: number
  show_results: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  status: TestStatus
  creator_id: number
  created_at: string
  updated_at?: string
  questions: Question[]
}

export interface TestListItem {
  id: number
  title: string
  description?: string
  status: TestStatus
  creator_id: number
  created_at: string
  questions_count: number
}

export interface TestAssignment {
  id: number
  test_id: number
  student_id: number
  assigned_by_id?: number
  due_date?: string
  created_at: string
}

// Result types
export interface Answer {
  id?: number
  question_id: number
  answer_data: Record<string, any>
  is_correct?: boolean
  points_earned?: number
  teacher_comment?: string
}

export interface TestResult {
  id: number
  test_id: number
  student_id: number
  student_full_name?: string
  student_username?: string
  score: number
  points_earned: number
  points_total: number
  is_passed: boolean
  status: TestResultStatus
  pending_answers_count: number
  started_at: string
  completed_at: string
  time_spent_minutes?: number
  attempt_number: number
  answers: Answer[]
}

export interface TestResultListItem {
  id: number
  test_id: number
  test_title?: string
  student_id: number
  student_full_name?: string
  student_username?: string
  score: number
  is_passed: boolean
  status: TestResultStatus
  completed_at: string
  attempt_number: number
  pending_answers_count: number
}

// Settings
export interface GradeSettings {
  grade3_min: number
  grade4_min: number
  grade5_min: number
}

