import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { testService } from '@/services/testService'
import { ArrowLeft, BarChart, Plus, Edit, Trash2, Save, Users, X } from 'lucide-react'
import { QuestionType, TestStatus, Test, Question, QuestionOption } from '@/types'
import { useState, useEffect } from 'react'

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>()
  
  const { data: test, isLoading } = useQuery({
    queryKey: ['test', id],
    queryFn: () => testService.getTest(Number(id)),
    enabled: !!id,
  })

  const qc = useQueryClient()

  const [form, setForm] = useState<Partial<Test>>({})

  useEffect(() => {
    if (test) {
      setForm({
        title: test.title,
        description: test.description,
        duration_minutes: test.duration_minutes,
        passing_score: test.passing_score,
        max_attempts: test.max_attempts,
        status: test.status,
      })
    }
  }, [test])

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Test>) => testService.updateTest(Number(id), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test', id] })
      qc.invalidateQueries({ queryKey: ['tests'] })
      alert('Тест обновлён')
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Не удалось сохранить изменения')
    },
  })

  const getQuestionTypeLabel = (type: QuestionType): string => {
    const labels: Record<QuestionType, string> = {
      [QuestionType.SINGLE_CHOICE]: 'Один правильный ответ',
      [QuestionType.MULTIPLE_CHOICE]: 'Несколько правильных ответов',
      [QuestionType.TRUE_FALSE]: 'Правда/Ложь',
      [QuestionType.SHORT_ANSWER]: 'Короткий ответ',
      [QuestionType.ESSAY]: 'Эссе',
      [QuestionType.MATCHING]: 'Соответствие',
      [QuestionType.FILL_IN_BLANK]: 'Заполнить пропуски',
      [QuestionType.ORDERING]: 'Упорядочивание',
      [QuestionType.NUMERIC]: 'Числовой ответ',
      [QuestionType.FILE_UPLOAD]: 'Загрузка файла',
      [QuestionType.CODE]: 'Код',
    }
    return labels[type] || type
  }

  const formatCorrectAnswer = (question: Question): string[] => {
    switch (question.question_type) {
      case QuestionType.SINGLE_CHOICE:
      case QuestionType.MULTIPLE_CHOICE:
        return question.options.filter((opt) => opt.is_correct).map((opt) => opt.option_text)
      case QuestionType.TRUE_FALSE:
        if (!question.correct_answer_text) return []
        return [
          question.correct_answer_text.toLowerCase() === 'true' ? 'Правда' : 'Ложь',
        ]
      case QuestionType.SHORT_ANSWER:
      case QuestionType.FILL_IN_BLANK:
      case QuestionType.NUMERIC:
        if (!question.correct_answer_text) return []
        return question.correct_answer_text
          .split(/[|;,\n]/)
          .map((part) => part.trim())
          .filter(Boolean)
      case QuestionType.MATCHING:
        return question.options.map((opt) =>
          `${opt.matching_pair || opt.option_text} → ${opt.option_text}`
        )
      case QuestionType.ORDERING:
        return [...question.options]
          .sort((a, b) => a.order - b.order)
          .map((opt, idx) => `${idx + 1}. ${opt.option_text}`)
      default:
        return []
    }
  }

  // Question editing state
  const [creating, setCreating] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [qForm, setQForm] = useState<Partial<Question>>({
    question_type: QuestionType.SINGLE_CHOICE,
    points: 1,
    order: 0,
  })

  const resetQForm = () => {
    setQForm({ question_type: QuestionType.SINGLE_CHOICE, points: 1, order: (test?.questions.length || 0) })
  }

  const addOption = () => {
    const opts = [...(qForm.options || [])]
    const nextOrder = (opts.length ? Math.max(...opts.map((o) => o.order || 0)) + 1 : 0)
    opts.push({ option_text: '', is_correct: false, order: nextOrder } as QuestionOption)
    setQForm((f) => ({ ...f, options: opts }))
  }

  const removeOption = (idx: number) => {
    const opts = [...(qForm.options || [])]
    opts.splice(idx, 1)
    setQForm((f) => ({ ...f, options: opts }))
  }

  const moveOption = (idx: number, dir: -1 | 1) => {
    const opts = [...(qForm.options || [])]
    const to = idx + dir
    if (to < 0 || to >= opts.length) return
    const tmp = opts[idx]
    opts[idx] = opts[to]
    opts[to] = tmp
    // resequence order 0..n-1
    const resequenced = opts.map((o, i) => ({ ...o, order: i }))
    setQForm((f) => ({ ...f, options: resequenced }))
  }

  const duplicateOption = (idx: number) => {
    const opts = [...(qForm.options || [])]
    const base = opts[idx]
    const copy = { ...base }
    delete (copy as any).id
    opts.splice(idx + 1, 0, copy as QuestionOption)
    const resequenced = opts.map((o, i) => ({ ...o, order: i }))
    setQForm((f) => ({ ...f, options: resequenced }))
  }

  const setSingleCorrect = (idx: number) => {
    setQForm((f) => ({
      ...f,
      options: (f.options || []).map((o, i) => ({ ...o, is_correct: i === idx })) as QuestionOption[],
    }))
  }

  const buildQuestionPayload = (): { error?: string; payload?: any } => {
    const base = {
      question_text: (qForm.question_text || '').trim(),
      question_type: qForm.question_type as QuestionType,
      points: qForm.points || 1,
      order: qForm.order ?? (test?.questions.length || 0),
      correct_answer_text: qForm.correct_answer_text || null,
      explanation: qForm.explanation || null,
    }

    if (!base.question_text) {
      return { error: 'Введите текст вопроса' }
    }

    const type = qForm.question_type as QuestionType
    const rawOpts = (qForm.options || []) as QuestionOption[]

    if (type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE) {
      const opts = rawOpts
        .map((o, i) => ({
          option_text: (o.option_text || '').trim(),
          is_correct: !!o.is_correct,
          order: i,
          matching_pair: o.matching_pair,
        }))
        .filter((o) => o.option_text !== '')

      if (opts.length < 2) return { error: 'Добавьте минимум два варианта с текстом' }
      const correctCount = opts.filter((o) => o.is_correct).length
      if (type === QuestionType.SINGLE_CHOICE && correctCount !== 1) {
        return { error: 'Отметьте ровно один правильный вариант' }
      }
      if (type === QuestionType.MULTIPLE_CHOICE && correctCount < 1) {
        return { error: 'Отметьте хотя бы один правильный вариант' }
      }
      return { payload: { ...base, options: opts } }
    }

    if (type === QuestionType.MATCHING) {
      const opts = rawOpts
        .map((o, i) => ({
          option_text: (o.option_text || '').trim(),
          matching_pair: (o.matching_pair || '').trim(),
          is_correct: false,
          order: i,
        }))
        .filter((o) => o.option_text && o.matching_pair)
      if (opts.length < 2) return { error: 'Для соответствия нужно минимум две пары' }
      return { payload: { ...base, options: opts } }
    }

    if (type === QuestionType.ORDERING) {
      const opts = rawOpts
        .map((o, i) => ({
          option_text: (o.option_text || '').trim(),
          matching_pair: undefined,
          is_correct: false,
          order: i + 1,
        }))
        .filter((o) => o.option_text)
      if (opts.length < 2) return { error: 'Для упорядочивания нужно минимум два элемента' }
      return { payload: { ...base, options: opts } }
    }

    // Types that don't use options
    return { payload: { ...base, options: [] } }
  }

  const createQuestionMutation = useMutation({
    mutationFn: (payload: any) => testService.createQuestion(Number(id), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test', id] })
      setCreating(false)
      resetQForm()
    },
    onError: (err: any) => alert(err?.response?.data?.detail || 'Не удалось добавить вопрос'),
  })

  const updateQuestionMutation = useMutation({
    mutationFn: (payload: any) => testService.updateQuestion(Number(id), editingId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test', id] })
      setEditingId(null)
      resetQForm()
    },
    onError: (err: any) => alert(err?.response?.data?.detail || 'Не удалось сохранить вопрос'),
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => testService.deleteQuestion(questionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['test', id] }),
    onError: (err: any) => alert(err?.response?.data?.detail || 'Не удалось удалить вопрос'),
  })

  if (isLoading) {
    return <div className="text-center py-12">Загрузка теста...</div>
  }

  if (!test) {
    return <div className="text-center py-12">Тест не найден</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/teacher/tests"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} />
        <span>Назад к тестам</span>
      </Link>

      <div className="card space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <label className="text-sm text-gray-600">Название</label>
              <input
                className="input mt-1"
                value={form.title || ''}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm text-gray-600">Описание</label>
              <textarea
                className="input mt-1"
                rows={3}
                value={form.description || ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="w-full lg:w-56">
            <label className="text-sm text-gray-600">Статус</label>
            <select
              className="input mt-1"
              value={form.status || TestStatus.DRAFT}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TestStatus }))}
            >
              <option value={TestStatus.DRAFT}>Черновик</option>
              <option value={TestStatus.PUBLISHED}>Опубликован</option>
              <option value={TestStatus.ARCHIVED}>Архивирован</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Длительность</p>
            <input
              type="number"
              min={1}
              className="input mt-1"
              value={form.duration_minutes ?? ''}
              placeholder="Без ограничений"
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
          <div>
            <p className="text-gray-500">Проходной балл</p>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="input mt-1"
              value={form.passing_score ?? 60}
              onChange={(e) => setForm((f) => ({ ...f, passing_score: Number(e.target.value) }))}
            />
          </div>
          <div>
            <p className="text-gray-500">Макс. попыток</p>
            <input
              type="number"
              min={1}
              className="input mt-1"
              value={form.max_attempts ?? ''}
              placeholder="Без ограничений"
              onChange={(e) => setForm((f) => ({ ...f, max_attempts: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
          <div>
            <p className="text-gray-500">Вопросов</p>
            <p className="font-medium">{test.questions.length}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
          <button
            className="btn btn-primary"
            onClick={async () => {
              const payload: any = {}
              if (form.title !== undefined) payload.title = String(form.title || '').trim()
              if (form.description !== undefined) payload.description = form.description === '' ? null : form.description
              if (form.duration_minutes !== undefined) payload.duration_minutes = form.duration_minutes === null || form.duration_minutes === undefined || form.duration_minutes === ('' as any) ? null : Number(form.duration_minutes)
              if (form.passing_score !== undefined && form.passing_score !== ('' as any)) payload.passing_score = Number(form.passing_score)
              if (form.max_attempts !== undefined) payload.max_attempts = form.max_attempts === null || form.max_attempts === undefined || form.max_attempts === ('' as any) ? null : Number(form.max_attempts)
              if (form.status !== undefined) payload.status = form.status
              try {
                await updateMutation.mutateAsync(payload)
              } catch (err) {
                // Fallback: refetch and verify if update actually applied (handles refresh race cases)
                const refreshed = await qc.fetchQuery({ queryKey: ['test', id], queryFn: () => testService.getTest(Number(id)) })
                if (payload.status && refreshed.status === payload.status) {
                  alert('Статус обновлён')
                  return
                }
                alert((err as any)?.response?.data?.detail || 'Не удалось сохранить изменения')
              }
            }}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <Link
            to={`/teacher/tests/${id}/assign`}
            className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Users size={18} />
            <span>Назначить</span>
          </Link>
          <Link
            to={`/teacher/tests/${id}/results`}
            className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <BarChart size={18} />
            <span>Результаты</span>
          </Link>
        </div>
      </div>

      {/* Questions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Вопросы</h2>
          {!creating && editingId === null && (
            <button className="btn btn-primary flex items-center gap-2" onClick={() => { setCreating(true); resetQForm() }}>
              <Plus size={18} />
              <span>Добавить вопрос</span>
            </button>
          )}
        </div>
        
        {/* Create / Edit form with the SAME UX as CreateTestPage */}
        {(creating || editingId !== null) && (
          <div className="mb-6 border border-gray-200 rounded-lg p-4">
            <div className="space-y-4">
              <div>
                <label className="label">Текст вопроса *</label>
                <textarea
                  className="input"
                  rows={2}
                  value={qForm.question_text || ''}
                  onChange={(e) => setQForm((f) => ({ ...f, question_text: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Тип вопроса</label>
                  <select
                    className="input"
                    value={(qForm.question_type as any) || QuestionType.SINGLE_CHOICE}
                    onChange={(e) => setQForm((f) => ({ ...f, question_type: e.target.value as unknown as QuestionType }))}
                  >
                    <optgroup label="Выбор ответа">
                      <option value={QuestionType.SINGLE_CHOICE}>Один правильный ответ</option>
                      <option value={QuestionType.MULTIPLE_CHOICE}>Несколько правильных ответов</option>
                      <option value={QuestionType.TRUE_FALSE}>Правда/Ложь</option>
                    </optgroup>
                    <optgroup label="Текстовый ответ">
                      <option value={QuestionType.SHORT_ANSWER}>Короткий ответ</option>
                      <option value={QuestionType.ESSAY}>Эссе</option>
                      <option value={QuestionType.CODE}>Код (программирование)</option>
                    </optgroup>
                    <optgroup label="Специальные типы">
                      <option value={QuestionType.NUMERIC}>Числовой ответ</option>
                      <option value={QuestionType.MATCHING}>Соответствие</option>
                      <option value={QuestionType.FILL_IN_BLANK}>Заполнить пропуски</option>
                      <option value={QuestionType.ORDERING}>Упорядочивание</option>
                      <option value={QuestionType.FILE_UPLOAD}>Загрузка файла</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="label">Баллы</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input"
                    value={qForm.points ?? 1}
                    onChange={(e) => setQForm((f) => ({ ...f, points: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {(qForm.question_type === QuestionType.SINGLE_CHOICE || qForm.question_type === QuestionType.MULTIPLE_CHOICE) && (
                <div>
                  <label className="label">
                    Варианты ответов
                    {qForm.question_type === QuestionType.SINGLE_CHOICE && (
                      <span className="text-sm text-gray-500 ml-2">(отметьте один правильный)</span>
                    )}
                    {qForm.question_type === QuestionType.MULTIPLE_CHOICE && (
                      <span className="text-sm text-gray-500 ml-2">(отметьте все правильные)</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    {(() => {
                      const ensureFour = () => {
                        const arr = [...(qForm.options || [])]
                        while (arr.length < 4) arr.push({ option_text: '', is_correct: false, order: arr.length } as any)
                        return arr.slice(0, 4)
                      }
                      const opts = ensureFour()
                      return opts.map((opt, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          {qForm.question_type === QuestionType.SINGLE_CHOICE ? (
                            <input
                              type="radio"
                              name="correct_single"
                              checked={!!opt.is_correct}
                              onChange={() => setSingleCorrect(idx)}
                              className="rounded"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={!!opt.is_correct}
                              onChange={(e) => {
                                const arr = ensureFour()
                                arr[idx] = { ...arr[idx], is_correct: e.target.checked }
                                setQForm((f) => ({ ...f, options: arr as any }))
                              }}
                              className="rounded"
                            />
                          )}
                          <input
                            className="input flex-1"
                            placeholder={`Вариант ${idx + 1}`}
                            value={opt.option_text || ''}
                            onChange={(e) => {
                              const arr = ensureFour()
                              arr[idx] = { ...arr[idx], option_text: e.target.value }
                              setQForm((f) => ({ ...f, options: arr as any }))
                            }}
                          />
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}

              {qForm.question_type === QuestionType.TRUE_FALSE && (
                <div>
                  <label className="label">Правильный ответ</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="radio" checked={(qForm.correct_answer_text || '').toLowerCase() === 'true'} onChange={() => setQForm((f) => ({ ...f, correct_answer_text: 'true' }))} className="rounded" />
                      <span className="text-gray-700">Правда</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="radio" checked={(qForm.correct_answer_text || '').toLowerCase() === 'false'} onChange={() => setQForm((f) => ({ ...f, correct_answer_text: 'false' }))} className="rounded" />
                      <span className="text-gray-700">Ложь</span>
                    </label>
                  </div>
                </div>
              )}

              {qForm.question_type === QuestionType.SHORT_ANSWER && (
                <div>
                  <label className="label">Правильный ответ (для автопроверки)</label>
                  <input className="input" value={qForm.correct_answer_text || ''} onChange={(e) => setQForm((f) => ({ ...f, correct_answer_text: e.target.value }))} />
                </div>
              )}

              {qForm.question_type === QuestionType.NUMERIC && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Правильный ответ (число)</label>
                    <input type="number" step="any" className="input" value={qForm.correct_answer_text || ''} onChange={(e) => setQForm((f) => ({ ...f, correct_answer_text: e.target.value }))} />
                  </div>
                </div>
              )}

              {qForm.question_type === QuestionType.MATCHING && (
                <div className="space-y-3">
                  <label className="label mb-2">Укажите пары для сопоставления:</label>
                  {(() => {
                    const arr = [...(qForm.options || [])]
                    while (arr.length < 4) arr.push({ option_text: '', matching_pair: '', order: arr.length } as any)
                    return arr.slice(0, 4).map((opt, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-3">
                        <input className="input" placeholder="Левая часть" value={opt.matching_pair || ''} onChange={(e) => { const a=[...arr]; a[idx]={...a[idx], matching_pair:e.target.value}; setQForm((f)=>({ ...f, options:a as any })) }} />
                        <input className="input" placeholder="Правая часть" value={opt.option_text || ''} onChange={(e) => { const a=[...arr]; a[idx]={...a[idx], option_text:e.target.value}; setQForm((f)=>({ ...f, options:a as any })) }} />
                      </div>
                    ))
                  })()}
                </div>
              )}

              {qForm.question_type === QuestionType.ORDERING && (
                <div className="space-y-2">
                  <label className="label">Элементы для упорядочивания (в правильном порядке)</label>
                  {(() => {
                    const arr = [...(qForm.options || [])]
                    while (arr.length < 5) arr.push({ option_text: '', order: arr.length + 1 } as any)
                    return arr.slice(0, 5).map((opt, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-gray-500 font-medium w-6">{idx + 1}.</span>
                        <input className="input flex-1" placeholder={`Элемент ${idx + 1}`} value={opt.option_text || ''} onChange={(e) => { const a=[...arr]; a[idx]={...a[idx], option_text:e.target.value}; setQForm((f)=>({ ...f, options:a as any })) }} />
                      </div>
                    ))
                  })()}
                </div>
              )}

              <div>
                <label className="label">Пояснение (необязательно)</label>
                <textarea className="input" rows={2} placeholder="Объясните правильный ответ" value={qForm.explanation || ''} onChange={(e) => setQForm((f) => ({ ...f, explanation: e.target.value }))} />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {creating ? (
                  <button
                    className="btn btn-primary flex items-center gap-2"
                    onClick={() => {
                      const { error, payload } = buildQuestionPayload()
                      if (error) {
                        alert(error)
                        return
                      }
                      createQuestionMutation.mutate(payload!)
                    }}
                    disabled={createQuestionMutation.isPending}
                  >
                    <Save size={18} /> {createQuestionMutation.isPending ? 'Сохранение...' : 'Сохранить вопрос'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary flex items-center gap-2"
                    onClick={() => {
                      const { error, payload } = buildQuestionPayload()
                      if (error) {
                        alert(error)
                        return
                      }
                      updateQuestionMutation.mutate(payload!)
                    }}
                    disabled={updateQuestionMutation.isPending}
                  >
                    <Save size={18} /> {updateQuestionMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                )}
                <button className="btn btn-secondary flex items-center gap-2" onClick={() => { setCreating(false); setEditingId(null); resetQForm() }}>
                  <X size={18} /> Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {test.questions.map((question, index) => (
            <div key={question.id} className="border-b border-gray-200 pb-6 last:border-0">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-gray-900">
                  {index + 1}. {question.question_text}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{question.points} {question.points === 1 ? 'балл' : 'баллов'}</span>
                  <button
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                    title="Редактировать"
                    onClick={() => {
                      setEditingId(question.id!)
                      setCreating(false)
                      setQForm({
                        id: question.id,
                        question_text: question.question_text,
                        question_type: question.question_type as any,
                        points: question.points,
                        order: question.order,
                        correct_answer_text: question.correct_answer_text || '',
                        explanation: question.explanation || '',
                        options: (question.options || []).map((o) => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct, order: o.order, matching_pair: o.matching_pair })) as any,
                      })
                    }}
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Удалить"
                    onClick={() => {
                      if (confirm('Удалить вопрос?')) deleteQuestionMutation.mutate(question.id!)
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-3">
                Тип: {getQuestionTypeLabel(question.question_type as QuestionType)}
              </p>

              {question.options.length > 0 && (
                <div className="space-y-2 ml-4">
                  {question.options.map((option, optIndex) => (
                    <div
                      key={option.id}
                      className={`flex items-center space-x-2 p-2 rounded ${
                        option.is_correct ? 'bg-green-50' : ''
                      }`}
                    >
                      <span className="text-sm">{String.fromCharCode(65 + optIndex)}.</span>
                      <span className="text-sm">{option.option_text}</span>
                      {option.is_correct && (
                        <span className="text-xs text-green-600 font-medium">✓ Правильный</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {question.explanation && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Пояснение:</span> {question.explanation}
                  </p>
                </div>
              )}

          {(() => {
            const answers = formatCorrectAnswer(question as Question)
            if (!answers.length) return null
            return (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm font-semibold text-green-800 mb-1">Правильный ответ:</p>
                <ul className="text-sm text-green-900 list-disc ml-5 space-y-1">
                  {answers.map((answer, idx) => (
                    <li key={idx}>{answer}</li>
                  ))}
                </ul>
              </div>
            )
          })()}
            </div>
          ))}
        </div>
      </div>


    </div>
  )
}

