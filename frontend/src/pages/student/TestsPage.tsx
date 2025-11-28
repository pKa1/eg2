import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { testService } from '@/services/testService'
import { Clock, FileText, PlayCircle } from 'lucide-react'

export default function StudentTestsPage() {
  const { data: tests, isLoading } = useQuery({
    queryKey: ['studentTests'],
    queryFn: testService.getTests,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })

  if (isLoading) {
    return <div className="text-center py-12">Загрузка тестов...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Доступные тесты</h1>

      {tests && tests.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Пока нет доступных тестов.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {tests?.map((test) => (
            <div key={test.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 break-words">{test.title}</h3>
                  {test.description && (
                    <p className="text-gray-600 mb-4 break-words">{test.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <FileText size={16} />
                      <span>{test.questions_count} {test.questions_count === 1 ? 'вопрос' : test.questions_count < 5 ? 'вопроса' : 'вопросов'}</span>
                    </span>
                    {test.duration_minutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={16} />
                        <span>{test.duration_minutes} мин.</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <Link
                  to={`/student/tests/${test.id}/take`}
                  className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <PlayCircle size={18} />
                  <span>Начать</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

