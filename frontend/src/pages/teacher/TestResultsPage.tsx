import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { resultService } from '@/services/resultService'
import { Link as RLink } from 'react-router-dom'
import { ArrowLeft, Award, CheckCircle2, Users, AlertCircle, Clock } from 'lucide-react'
import { TestResultStatus } from '@/types'

export default function TestResultsPage() {
  const { id } = useParams<{ id: string }>()

  const { data: results, isLoading } = useQuery({
    queryKey: ['testResults', id],
    queryFn: () => resultService.getResults(Number(id)),
    enabled: !!id,
  })

  const stats = useMemo(() => {
    if (!results || results.length === 0) {
      return { total: 0, finalized: 0, pending: 0, passed: 0, passRate: 0, avgScore: 0 }
    }
    const total = results.length
    const pending = results.filter((r) => r.status === TestResultStatus.PENDING_MANUAL).length
    const finalizedList = results.filter((r) => r.status !== TestResultStatus.PENDING_MANUAL)
    const finalized = finalizedList.length
    const passed = finalizedList.filter((r) => r.is_passed).length
    const avgScore = finalized ? finalizedList.reduce((sum, r) => sum + r.score, 0) / finalized : 0
    return {
      total,
      finalized,
      pending,
      passed,
      passRate: finalized ? (passed / finalized) * 100 : 0,
      avgScore,
    }
  }, [results])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to={`/teacher/tests/${id}`}
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} />
        <span>Назад к тесту</span>
      </Link>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Результаты теста</h1>
        </div>

        {isLoading && <div className="text-center py-12">Загрузка результатов...</div>}

        {!isLoading && (!results || results.length === 0) && (
          <div className="text-center py-12 text-gray-600">Пока нет результатов</div>
        )}

        {!isLoading && results && results.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <div className="p-4 rounded-xl bg-primary-50 border border-primary-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-700">Всего попыток</p>
                    <p className="text-2xl font-semibold text-primary-900">{stats.total}</p>
                  </div>
                  <Users className="text-primary-400" size={32} />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-700">На проверке</p>
                    <p className="text-2xl font-semibold text-amber-900">{stats.pending}</p>
                  </div>
                  <Clock className="text-amber-400" size={32} />
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  {stats.pending > 0 ? 'Нужно выставить оценки' : 'Нет ожидающих попыток'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700">Зачёт</p>
                    <p className="text-2xl font-semibold text-green-900">{stats.passRate.toFixed(1)}%</p>
                  </div>
                  <CheckCircle2 className="text-green-400" size={32} />
                </div>
                <p className="text-xs text-green-700 mt-1">
                  {stats.finalized ? `${stats.passed} из ${stats.finalized} проверенных` : 'Нет завершённых попыток'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-700">Средний балл</p>
                    <p className="text-2xl font-semibold text-amber-900">
                      {stats.finalized ? stats.avgScore.toFixed(1) : '—'}%
                    </p>
                  </div>
                  <Award className="text-amber-400" size={32} />
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  {stats.finalized ? 'По завершённым попыткам' : 'Нет завершённых попыток'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {results.map((r) => {
                const isPending = r.status === TestResultStatus.PENDING_MANUAL
                const count = r.pending_answers_count
                const mod10 = count % 10
                const mod100 = count % 100
                const pendingText =
                  mod10 === 1 && mod100 !== 11
                    ? `${count} ответ`
                    : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
                      ? `${count} ответа`
                      : `${count} ответов`

                return (
                <div
                  key={r.id}
                  className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-primary-200 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-lg uppercase">
                      {(r.student_full_name || r.student_username || `ID${r.student_id}`)
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join('')}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {r.student_full_name || `ID ${r.student_id}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{r.student_username || 'unknown'} · ID {r.student_id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Попытка #{r.attempt_number} · {new Date(r.completed_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="text-right">
                      <p className={`text-2xl font-semibold ${isPending ? 'text-gray-400' : 'text-gray-900'}`}>
                        {isPending ? '—' : `${r.score.toFixed(1)}%`}
                      </p>
                      <p className="text-xs text-gray-500">{isPending ? 'Ожидает проверки' : 'Итоговый балл'}</p>
                      {isPending && (
                        <p className="text-xs text-gray-400 mt-1">Предварительно: {r.score.toFixed(1)}%</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        isPending
                          ? 'bg-amber-100 text-amber-800'
                          : r.is_passed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {isPending ? (
                        <>
                          <Clock size={14} />
                          На проверке · {pendingText}
                        </>
                      ) : r.is_passed ? (
                        <>
                          <CheckCircle2 size={14} />
                          Зачёт
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} />
                          Незачёт
                        </>
                      )}
                    </span>
                    <RLink
                      to={`/teacher/results/${r.id}`}
                      className="btn btn-secondary whitespace-nowrap w-full sm:w-auto text-center"
                    >
                      Подробнее
                    </RLink>
                  </div>
                </div>
              )})}
            </div>
          </>
        )}
      </div>
    </div>
  )
}


