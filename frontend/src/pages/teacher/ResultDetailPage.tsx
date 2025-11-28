import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { resultService } from '@/services/resultService'
import { testService } from '@/services/testService'
import { ArrowLeft, Clock } from 'lucide-react'
import { QuestionType, TestResultStatus } from '@/types'

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: result, isLoading } = useQuery({
    queryKey: ['result', id],
    queryFn: () => resultService.getResult(Number(id)),
    enabled: !!id,
  })

  const { data: test } = useQuery({
    queryKey: ['testForResult', result?.test_id],
    queryFn: () => testService.getTest(result!.test_id),
    enabled: !!result?.test_id,
  })

  const gradeMutation = useMutation({
    mutationFn: ({ answerId, isCorrect, points, comment }: { answerId: number; isCorrect: boolean; points: number; comment?: string }) =>
      resultService.gradeAnswer(answerId, isCorrect, points, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['result', id] })
    },
    onError: (err: any) => alert(err?.response?.data?.detail || 'Не удалось обновить оценку'),
  })

  const renderAnswer = (q: any, a: any) => {
    const type = q.question_type as QuestionType
    const ad = a.answer_data || {}
    switch (type) {
      case QuestionType.SINGLE_CHOICE: {
        const selected = ad.selected_option_id
        const opt = q.options.find((o: any) => o.id === selected)
        return opt ? `${opt.option_text} (ID ${selected})` : '—'
      }
      case QuestionType.MULTIPLE_CHOICE: {
        const selectedIds: number[] = ad.selected_option_ids || []
        const texts = q.options.filter((o: any) => selectedIds.includes(o.id)).map((o: any) => o.option_text)
        return texts.length ? texts.join(', ') : '—'
      }
      case QuestionType.TRUE_FALSE: {
        const v = ad.value
        return v === 'True' || v === true ? 'Правда' : v === 'False' || v === false ? 'Ложь' : '—'
      }
      case QuestionType.SHORT_ANSWER:
      case QuestionType.ESSAY:
      case QuestionType.CODE: {
        return ad.text || ad.code || '—'
      }
      case QuestionType.NUMERIC: {
        return ad.number_value !== undefined && ad.number_value !== null ? String(ad.number_value) : '—'
      }
      case QuestionType.MATCHING: {
        const matches = ad.matches || {}
        const lines = Object.entries(matches).map(([leftId, rightId]) => {
          const left = q.options.find((o: any) => o.id === Number(leftId))
          const right = q.options.find((o: any) => o.id === Number(rightId))
          return `${left?.matching_pair || left?.option_text} → ${right?.option_text}`
        })
        return lines.length ? lines.join('; ') : '—'
      }
      case QuestionType.FILL_IN_BLANK: {
        const blanks: string[] = ad.blanks || []
        return blanks.length ? blanks.join(' | ') : '—'
      }
      case QuestionType.ORDERING: {
        const order = ad.order || {}
        const lines = Object.entries(order).map(([optionId, pos]) => {
          const opt = q.options.find((o: any) => o.id === Number(optionId))
          return `${opt?.option_text} → ${pos}`
        })
        return lines.length ? lines.join('; ') : '—'
      }
      case QuestionType.FILE_UPLOAD: {
        return ad.file_name ? `${ad.file_name} (${ad.file_type}, ${ad.file_size} bytes)` : '—'
      }
      default:
        return '—'
    }
  }

  const formatPendingText = (count: number) => {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return `${count} ответ`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} ответа`
    return `${count} ответов`
  }

  if (isLoading || !result) {
    return <div className="text-center py-12">Загрузка результата...</div>
  }

  const isPending = result.status === TestResultStatus.PENDING_MANUAL
  const studentDisplayName = result.student_full_name || `ID ${result.student_id}`
  const studentHandle = result.student_username ? `@${result.student_username}` : `Студент ID ${result.student_id}`
  const initials = (result.student_full_name || result.student_username || `${result.student_id}`)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'ST'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to={`/teacher/tests/${result.test_id}/results`}
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} />
        <span>Назад к результатам</span>
      </Link>

      <div className="card space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-xl">
              {initials}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{studentDisplayName}</p>
              <p className="text-sm text-gray-500">{studentHandle} · ID {result.student_id}</p>
              <p className="text-xs text-gray-400">Попытка #{result.attempt_number} · {new Date(result.completed_at).toLocaleString('ru-RU')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
            <div className="p-3 rounded-lg bg-primary-50 border border-primary-100 text-center">
              <p className="text-xs text-primary-700 uppercase tracking-wide">Оценка</p>
              <p className={`text-2xl font-semibold ${isPending ? 'text-gray-400' : 'text-primary-900'}`}>
                {isPending ? '—%' : `${result.score.toFixed(1)}%`}
              </p>
              <p className="text-xs text-primary-700">
                {isPending ? 'Итог появится после проверки' : `${result.points_earned} / ${result.points_total} баллов`}
              </p>
              {isPending && (
                <p className="text-xs text-gray-500 mt-1">Предварительно: {result.score.toFixed(1)}%</p>
              )}
            </div>
            <div
              className={`p-3 rounded-lg border text-center ${
                isPending
                  ? 'bg-amber-50 border-amber-100 text-amber-800'
                  : result.is_passed
                    ? 'bg-green-50 border-green-100 text-green-800'
                    : 'bg-red-50 border-red-100 text-red-700'
              }`}
            >
              <p className="text-xs uppercase tracking-wide">
                {isPending ? 'На проверке' : result.is_passed ? 'Зачёт' : 'Незачёт'}
              </p>
              <p className="text-xl font-semibold mt-1">
                {isPending ? <Clock size={24} className="mx-auto" /> : result.is_passed ? '✅' : '⚠️'}
              </p>
              <p className="text-xs text-gray-600">
                {isPending
                  ? `Нужно проверить ${formatPendingText(result.pending_answers_count)}`
                  : result.time_spent_minutes !== null
                    ? `${result.time_spent_minutes} мин.`
                    : 'Без ограничения'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Ответы по вопросам</h2>
        {isPending && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            В этой попытке осталось проверить {formatPendingText(result.pending_answers_count)}. После выставления оценок статус обновится автоматически.
          </div>
        )}
        {!test ? (
          <div className="text-gray-600">Загрузка теста...</div>
        ) : (
          <div className="space-y-6">
            {test.questions.map((q: any, idx: number) => {
              const a = (result.answers || []).find((x: any) => x.question_id === q.id)
              return (
                <div key={q.id} className="border-b border-gray-200 pb-6 last:border-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{idx + 1}. {q.question_text}</h3>
                    <span className="text-sm text-gray-500">{q.points} балл(ов)</span>
                  </div>
                  <div className="text-sm text-gray-700 mb-2">
                    <span className="text-gray-500">Ответ ученика: </span>
                    <span className="font-medium">{a ? renderAnswer(q, a) : '—'}</span>
                  </div>
                  {a && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <span className="text-sm text-gray-600">Оценка: {a.points_earned} / {q.points}</span>
                      {a.is_correct === true && <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Верно</span>}
                      {a.is_correct === false && <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Неверно</span>}
                      {a.is_correct === null && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            className="btn btn-secondary w-full sm:w-auto"
                            onClick={() => gradeMutation.mutate({ answerId: a.id, isCorrect: true, points: q.points })}
                          >
                            Зачесть
                          </button>
                          <button
                            className="btn btn-secondary w-full sm:w-auto"
                            onClick={() => gradeMutation.mutate({ answerId: a.id, isCorrect: false, points: 0 })}
                          >
                            Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


