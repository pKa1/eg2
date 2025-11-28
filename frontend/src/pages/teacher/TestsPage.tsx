import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { testService } from '@/services/testService'
import { Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { TestStatus } from '@/types'

export default function TeacherTestsPage() {
  const { data: tests, isLoading } = useQuery({
    queryKey: ['tests'],
    queryFn: testService.getTests,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })

  const getStatusBadge = (status: TestStatus) => {
    const styles = {
      [TestStatus.DRAFT]: 'bg-gray-200 text-gray-800',
      [TestStatus.PUBLISHED]: 'bg-green-200 text-green-800',
      [TestStatus.ARCHIVED]: 'bg-red-200 text-red-800',
    }

    const labels = {
      [TestStatus.DRAFT]: 'Черновик',
      [TestStatus.PUBLISHED]: 'Опубликован',
      [TestStatus.ARCHIVED]: 'Архивирован',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  if (isLoading) {
    return <div className="text-center py-12">Загрузка тестов...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Мои тесты</h1>
        <Link
          to="/teacher/tests/create"
          className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={20} />
          <span>Создать тест</span>
        </Link>
      </div>

      {tests && tests.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">Вы еще не создали ни одного теста.</p>
          <Link to="/teacher/tests/create" className="btn btn-primary">
            Создать первый тест
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {tests?.map((test) => (
            <div key={test.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 break-words">{test.title}</h3>
                    {getStatusBadge(test.status)}
                  </div>
                  {test.description && (
                    <p className="text-gray-600 mb-3 break-words">{test.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <span>
                      {test.questions_count}{' '}
                      {test.questions_count === 1
                        ? 'вопрос'
                        : test.questions_count < 5
                          ? 'вопроса'
                          : 'вопросов'}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>Создан {new Date(test.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Link
                    to={`/teacher/tests/${test.id}`}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="Просмотр"
                  >
                    <Eye size={20} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

