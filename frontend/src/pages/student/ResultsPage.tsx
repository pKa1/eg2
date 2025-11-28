import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { resultService } from '@/services/resultService'
import { testService } from '@/services/testService'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { TestResultStatus } from '@/types'

export default function StudentResultsPage() {
  const { data: results, isLoading } = useQuery({
    queryKey: ['studentResults'],
    queryFn: () => resultService.getResults(),
  })

  const [testTitles, setTestTitles] = useState<Record<number, string>>({})

  const pluralizeAnswers = (count: number) => {
    const mod10 = count % 10
    const mod100 = count % 100
    if (count === 0) return 'нет ответов'
    if (mod10 === 1 && mod100 !== 11) return `${count} ответ`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} ответа`
    return `${count} ответов`
  }

  useEffect(() => {
    if (!results || results.length === 0) return
    const uniqueIds = Array.from(new Set(results.map((r) => r.test_id)))
    let cancelled = false
    Promise.all(uniqueIds.map((id) => testService.getTest(id).then((t) => [id, t.title] as const).catch(() => [id, `Тест #${id}`] as const)))
      .then((pairs) => {
        if (cancelled) return
        const map: Record<number, string> = {}
        pairs.forEach(([id, title]) => { map[id] = title })
        setTestTitles(map)
      })
    return () => { cancelled = true }
  }, [results])

  if (isLoading) {
    return <div className="text-center py-12">Загрузка результатов...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Мои результаты</h1>

      {results && results.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Вы ещё не прошли ни одного теста.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results?.map((result) => {
            const isPending = result.status === TestResultStatus.PENDING_MANUAL

            return (
            <div key={result.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {testTitles[result.test_id] || `Тест #${result.test_id}`}
                    </h3>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Clock size={20} />
                        <span className="text-sm font-medium">Проверяется преподавателем</span>
                      </span>
                    ) : result.is_passed ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle size={20} />
                        <span className="text-sm font-medium">Зачёт</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <XCircle size={20} />
                        <span className="text-sm font-medium">Незачёт</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <span>Оценка: {isPending ? '—' : `${result.score.toFixed(1)}%`}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Попытка {result.attempt_number}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{new Date(result.completed_at).toLocaleDateString('ru-RU')}</span>
                  </div>

                  {isPending && (
                    <p className="text-sm text-amber-700 mt-2">
                      Ждёт проверки: {pluralizeAnswers(result.pending_answers_count)}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <div className={`text-3xl font-bold ${isPending ? 'text-gray-300' : 'text-primary-600'}`}>
                    {isPending ? '—' : `${result.score.toFixed(0)}%`}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isPending ? 'Итог появится после проверки' : 'Итоговый результат'}
                  </p>
                  {isPending && (
                    <p className="text-xs text-gray-400 mt-1">Предварительно: {result.score.toFixed(1)}%</p>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

