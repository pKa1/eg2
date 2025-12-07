import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { userService } from '@/services/userService'
import { resultService } from '@/services/resultService'
import { ArrowLeft, Mail, Phone, UserCircle, Clock, Calendar, GraduationCap, BookOpen } from 'lucide-react'
import { StudentGender, TestResultStatus } from '@/types'

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const qc = useQueryClient()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => userService.getUser(studentId),
    enabled: Number.isFinite(studentId),
  })

  const { data: results } = useQuery({
    queryKey: ['student-results', studentId],
    queryFn: () => resultService.getResults(undefined, studentId),
    enabled: Number.isFinite(studentId),
  })

  const stats = useMemo(() => {
    if (!results || results.length === 0) {
      return { attempts: 0, passes: 0, passRate: 0, pending: 0, finalized: 0 }
    }
    const attempts = results.length
    const pending = results.filter((r) => r.status === TestResultStatus.PENDING_MANUAL).length
    const finalizedList = results.filter((r) => r.status !== TestResultStatus.PENDING_MANUAL)
    const passes = finalizedList.filter((r) => r.is_passed).length
    return {
      attempts,
      passes,
      passRate: finalizedList.length ? (passes / finalizedList.length) * 100 : 0,
      pending,
      finalized: finalizedList.length,
    }
  }, [results])

  if (!studentId || isNaN(studentId)) {
    return <div className="text-center py-12">Некорректный идентификатор ученика</div>
  }

  if (isLoading || !student) {
    return <div className="text-center py-12">Загрузка профиля ученика...</div>
  }

  const genderText =
    student.gender === StudentGender.MALE
      ? 'Мужской'
      : student.gender === StudentGender.FEMALE
        ? 'Женский'
        : 'не указан'
  const birthDateText = student.date_of_birth
    ? new Date(student.date_of_birth).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'не указана'
  const schoolText = student.school_name || 'не указана'
  const classText = student.class_number
    ? `${student.class_number}${student.class_letter ? ` «${student.class_letter}»` : ''}`
    : 'не указан'

  const profileDetails = [
    { label: 'Пол', value: genderText, Icon: UserCircle },
    { label: 'Дата рождения', value: birthDateText, Icon: Calendar },
    { label: 'Школа', value: schoolText, Icon: GraduationCap },
    { label: 'Класс', value: classText, Icon: BookOpen },
  ]

  return (
    <div className="space-y-6">
      <Link to="/teacher/students" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} />
        <span>Назад к ученикам</span>
      </Link>

      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-2xl">
              {student.full_name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{student.full_name}</h1>
              <p className="text-gray-500">@{student.username}</p>
              <p className="text-xs text-gray-400 mt-1">ID {student.id} · Зарегистрирован: {new Date(student.created_at).toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${student.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {student.is_verified ? 'Подтверждён' : 'Не подтверждён'}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${student.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
              {student.is_active ? 'Активен' : 'Заблокирован'}
            </span>
          </div>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-3">
          <div className="flex items-center gap-3 text-gray-700">
            <Mail className="text-gray-500" size={20} />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium">{student.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <Phone className="text-gray-500" size={20} />
            <div>
              <p className="text-xs text-gray-500">Телефон</p>
              <p className="font-medium">{student.phone || 'не указан'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <UserCircle className="text-gray-500" size={20} />
            <div>
              <p className="text-xs text-gray-500">Последний вход</p>
              <p className="font-medium">{student.last_login ? new Date(student.last_login).toLocaleString('ru-RU') : 'ещё не входил'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Подробная информация</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {profileDetails.map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-3 text-gray-700">
              <Icon className="text-gray-500" size={20} />
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-100">
          <p className="text-sm text-primary-700">Попыток всего</p>
          <p className="text-2xl font-semibold text-primary-900">{stats.attempts}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-sm text-amber-700">На проверке</p>
          <p className="text-2xl font-semibold text-amber-900">{stats.pending}</p>
        </div>
        <div className="p-4 rounded-xl bg-green-50 border border-green-100">
          <p className="text-sm text-green-700">Зачётов</p>
          <p className="text-2xl font-semibold text-green-900">{stats.passes}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-sm text-amber-700">Процент зачётов</p>
          <p className="text-2xl font-semibold text-amber-900">
            {stats.finalized ? stats.passRate.toFixed(1) : '—'}%
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">История тестов</h2>
        {!results || results.length === 0 ? (
          <div className="text-gray-500">Пока нет попыток</div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => {
              const isPending = result.status === TestResultStatus.PENDING_MANUAL
              const count = result.pending_answers_count
              const mod10 = count % 10
              const mod100 = count % 100
              const pendingText =
                mod10 === 1 && mod100 !== 11
                  ? `${count} ответ`
                  : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
                    ? `${count} ответа`
                    : `${count} ответов`

              return (
              <div key={result.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border border-gray-200 rounded-lg p-4">
                <div>
                <p className="text-sm text-gray-500">
                    {result.test_title || `Тест ID ${result.test_id}`} · Попытка #{result.attempt_number}
                  </p>
                  <p className={`text-lg font-semibold ${isPending ? 'text-gray-400' : 'text-gray-900'}`}>
                    {isPending ? '—%' : `${result.score.toFixed(1)}%`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(result.completed_at).toLocaleString('ru-RU')}
                  </p>
                  {isPending && (
                    <p className="text-xs text-amber-700 mt-1">Ждёт проверки: {pendingText}</p>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isPending
                        ? 'bg-amber-100 text-amber-800'
                        : result.is_passed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isPending ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        На проверке
                      </span>
                    ) : result.is_passed ? 'Зачёт' : 'Незачёт'}
                  </span>
                  <Link to={`/teacher/results/${result.id}`} className="btn btn-secondary text-sm text-center w-full sm:w-auto">
                    Подробнее
                  </Link>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}


