import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { testService } from '@/services/testService'
import { resultService } from '@/services/resultService'
import { QuestionType, TestStatus, Question as QuestionSchema } from '@/types'
import { Clock, Send } from 'lucide-react'

export default function TakeTestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [startedAt, setStartedAt] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [matchingShuffles, setMatchingShuffles] = useState<Record<number, { id: number; option_text: string; displayNumber: number }[]>>({})
  const [orderingShuffles, setOrderingShuffles] = useState<Record<number, QuestionSchema['options']>>({})

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string) || '')
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
      reader.readAsDataURL(file)
    })
  }

  const { data: test, isLoading } = useQuery({
    queryKey: ['test', id],
    queryFn: () => testService.getTest(Number(id)),
    enabled: !!id,
  })

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      answers: test?.questions.map((q) => ({
        question_id: q.id,
        answer_data: {},
      })),
    },
  })

  // Start test on mount
  useEffect(() => {
    if (!test) return

    // Block taking unpublished tests defensively (UX) even if backend rejects later
    if (test.status !== TestStatus.PUBLISHED) {
      alert('Тест еще не опубликован. Обратитесь к преподавателю.')
      navigate('/student/tests')
      return
    }

    // Precompute shuffled options for MATCHING questions once per test load
    const shuffles: Record<number, { id: number; option_text: string; displayNumber: number }[]> = {}
    test.questions
      .filter((q) => q.question_type === QuestionType.MATCHING)
      .forEach((q) => {
        const shuffled = q.options
          .filter((opt) => opt.option_text)
          .map((opt) => ({ id: opt.id!, option_text: opt.option_text }))
          .sort(() => Math.random() - 0.5)
          .map((opt, idx) => ({ ...opt, displayNumber: idx + 1 }))
        shuffles[q.id!] = shuffled
      })
    setMatchingShuffles(shuffles)

    const orderingMap: Record<number, QuestionSchema['options']> = {}
    test.questions
      .filter((q) => q.question_type === QuestionType.ORDERING)
      .forEach((q) => {
        const shuffled = [...q.options].sort(() => Math.random() - 0.5)
        orderingMap[q.id!] = shuffled
      })
    setOrderingShuffles(orderingMap)

    resultService
      .startTest(test.id)
      .then((data) => {
        setStartedAt(data.started_at)
        if (test.duration_minutes) {
          setTimeLeft(test.duration_minutes * 60) // Convert to seconds
        }
      })
      .catch((err: any) => {
        const status = err?.response?.status
        const detail = err?.response?.data?.detail
        const message =
          detail ||
          (status === 403
            ? 'Тест не назначен вам или недоступен.'
            : 'Не удалось начать попытку. Попробуйте позже.')
        alert(message)
        navigate('/student/tests')
      })
  }, [test])

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          // Auto-submit when time runs out
          handleSubmit(onSubmit)()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const submitMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!startedAt) {
        throw new Error('Не удалось зафиксировать время начала теста. Обновите страницу и попробуйте снова.');
      }

      const answers = await Promise.all(test!.questions.map(async (question, index) => {
        const rawAnswer = formData?.answers?.[index] || {};
        const answerData: Record<string, unknown> = {};

        switch (question.question_type) {
          case QuestionType.SINGLE_CHOICE: {
            const selected = rawAnswer.selected_option_id;
            const parsed = selected !== undefined && selected !== null ? Number(selected) : null;
            answerData.selected_option_id = Number.isFinite(parsed) ? parsed : null;
            break;
          }
          case QuestionType.MULTIPLE_CHOICE: {
            const rawSelected = rawAnswer.selected_option_ids;
            const selectedIds: number[] = [];

            if (Array.isArray(rawSelected)) {
              rawSelected.forEach((value) => {
                if (typeof value !== 'string' && typeof value !== 'number') {
                  return;
                }
                const parsed = Number(value);
                if (Number.isFinite(parsed)) {
                  selectedIds.push(parsed);
                }
              });
            } else if (rawSelected && typeof rawSelected === 'object') {
              Object.values(rawSelected).forEach((value) => {
                if (typeof value !== 'string' && typeof value !== 'number') {
                  return;
                }
                const parsed = Number(value);
                if (Number.isFinite(parsed)) {
                  selectedIds.push(parsed);
                }
              });
            }

            answerData.selected_option_ids = Array.from(new Set(selectedIds));
            break;
          }
          case QuestionType.TRUE_FALSE: {
            answerData.value = rawAnswer.value ?? null;
            break;
          }
          case QuestionType.SHORT_ANSWER:
          case QuestionType.ESSAY: {
            answerData.text = (rawAnswer.text ?? '').toString();
            break;
          }
          case QuestionType.MATCHING: {
            const matches: Record<string, number> = {};
            const rawMatches = rawAnswer.matches || {};
            Object.entries(rawMatches).forEach(([optionId, selectedId]) => {
              const parsedSelected = Number(selectedId);
              const parsedKey = Number(optionId);
              if (Number.isFinite(parsedSelected) && Number.isFinite(parsedKey)) {
                matches[parsedKey] = parsedSelected;
              }
            });
            answerData.matches = matches;
            break;
          }
          case QuestionType.FILL_IN_BLANK: {
            const blanksSource = rawAnswer.blanks || {};
            const blanks = Object.keys(blanksSource)
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => (blanksSource[key] ?? '').toString().trim());
            answerData.blanks = blanks;
            break;
          }
          case QuestionType.ORDERING: {
            const orderSource = rawAnswer.order || {};
            const order: Record<string, number> = {};
            Object.entries(orderSource).forEach(([optionId, position]) => {
              const parsedPosition = Number(position);
              const parsedKey = Number(optionId);
              if (Number.isFinite(parsedPosition) && Number.isFinite(parsedKey)) {
                order[parsedKey] = parsedPosition;
              }
            });
            answerData.order = order;
            break;
          }
          case QuestionType.NUMERIC: {
            const value = rawAnswer.number_value;
            if (value === '' || value === undefined || value === null) {
              answerData.number_value = null;
            } else {
              const parsed = Number(value);
              answerData.number_value = Number.isFinite(parsed) ? parsed : null;
            }
            break;
          }
          case QuestionType.CODE: {
            answerData.code = (rawAnswer.code ?? '').toString();
            break;
          }
          case QuestionType.FILE_UPLOAD: {
            const file = rawAnswer.file?.[0];
            if (file) {
              answerData.file_name = file.name;
              answerData.file_type = file.type;
              answerData.file_size = file.size;
              answerData.file_content = await readFileAsBase64(file);
            }
            break;
          }
          default:
            break;
        }

        return {
          question_id: question.id!,
          answer_data: answerData,
        };
      }));

      return resultService.submitTest(test!.id, startedAt, answers);
    },
    onSuccess: () => {
      navigate('/student/results');
    },
    onError: (err: any) => {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      const message =
        detail ||
        (status === 400
          ? 'Проверьте корректность ответов и попробуйте снова.'
          : 'Не удалось отправить тест. Попробуйте позже.')
      alert(message)
    }
  });

  const onSubmit = (data: any) => {
    if (window.confirm('Вы уверены, что хотите отправить тест? После отправки изменения будут невозможны.')) {
      submitMutation.mutate(data)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Загрузка теста...</div>
  }

  if (!test) {
    return <div className="text-center py-12">Тест не найден</div>
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPointsLabel = (points: number) => {
    const lastDigit = points % 10
    const lastTwoDigits = points % 100
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return 'баллов'
    }
    if (lastDigit === 1) {
      return 'балл'
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'балла'
    }
    return 'баллов'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
            {test.description && (
              <p className="text-gray-600 mt-2">{test.description}</p>
            )}
          </div>
          {timeLeft !== null && (
            <div className="inline-flex items-center gap-2 text-lg font-semibold bg-gray-50 border border-gray-200 rounded-full px-4 py-2">
              <Clock size={20} />
              <span className={timeLeft < 300 ? 'text-red-600' : 'text-gray-900'}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {test.questions.map((question, qIndex) => (
          <div key={question.id} className="card">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex-1">
                {qIndex + 1}. {question.question_text}
              </h3>
              <span className="text-sm text-gray-500">
                {question.points} {getPointsLabel(question.points)}
              </span>
            </div>

            {/* Single Choice */}
            {question.question_type === QuestionType.SINGLE_CHOICE && (
              <div className="space-y-3">
                {question.options.map((option) => (
                  <label key={option.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      {...register(`answers.${qIndex}.selected_option_id`)}
                      value={option.id}
                      className="text-primary-600"
                    />
                    <span>{option.option_text}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Multiple Choice */}
            {question.question_type === QuestionType.MULTIPLE_CHOICE && (
              <div className="space-y-3">
                {question.options.map((option, optIndex) => (
                  <label key={option.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`answers.${qIndex}.selected_option_ids.${optIndex}`)}
                      value={option.id}
                      className="rounded text-primary-600"
                    />
                    <span>{option.option_text}</span>
                  </label>
                ))}
              </div>
            )}

            {/* True/False */}
            {question.question_type === QuestionType.TRUE_FALSE && (
              <div className="space-y-3">
                {[
                  { value: 'True', label: 'Правда' },
                  { value: 'False', label: 'Ложь' }
                ].map((option) => (
                  <label key={option.value} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      {...register(`answers.${qIndex}.value`)}
                      value={option.value}
                      className="text-primary-600"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {question.question_type === QuestionType.SHORT_ANSWER && (
              <input
                {...register(`answers.${qIndex}.text`)}
                className="input"
                placeholder="Ваш ответ"
              />
            )}

            {/* Essay */}
            {question.question_type === QuestionType.ESSAY && (
              <textarea
                {...register(`answers.${qIndex}.text`)}
                className="input"
                rows={6}
                placeholder="Введите ваш развернутый ответ..."
              />
            )}

            {/* Numeric */}
            {question.question_type === QuestionType.NUMERIC && (
              <div>
                <input
                  type="number"
                  step="any"
                  {...register(`answers.${qIndex}.number_value`)}
                  className="input"
                  placeholder="Введите число (например: 3.14)"
                />
              </div>
            )}

            {/* Matching */}
            {question.question_type === QuestionType.MATCHING && (
              (() => {
                const leftItems = question.options.filter((opt) => opt.matching_pair || opt.option_text)
                const shuffledOptions = matchingShuffles[question.id!] || []

                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-4">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Задание:</span> Для каждого элемента слева выберите соответствующий вариант из списка справа.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="bg-gray-100 px-3 py-2 rounded-t font-semibold text-sm text-gray-700">
                          📋 Элементы:
                        </div>
                        {leftItems.map((option, idx) => (
                          <div key={option.id} className="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-sm">
                            <div className="font-medium text-gray-900 mb-3">
                              <span className="inline-block w-8 h-8 bg-blue-500 text-white rounded-full text-center leading-8 mr-2">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              {option.matching_pair || option.option_text}
                            </div>
                            <div className="mt-2">
                              <label className="text-xs text-gray-600 mb-1 block">Выберите соответствие:</label>
                              <select
                                {...register(`answers.${qIndex}.matches.${option.id}`)}
                                className="input text-sm w-full"
                              >
                                <option value="">-- Выберите вариант --</option>
                                {shuffledOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.displayNumber}. {opt.option_text}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="bg-gray-100 px-3 py-2 rounded-t font-semibold text-sm text-gray-700">
                          🎯 Варианты для сопоставления:
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-3 italic">
                            Доступные варианты:
                          </p>
                          <div className="space-y-2">
                            {shuffledOptions.map((option) => (
                              <div
                                key={option.id}
                                className="p-3 bg-white border-l-4 border-green-400 rounded shadow-sm hover:shadow-md transition-shadow"
                              >
                                <span className="inline-block w-6 h-6 bg-green-500 text-white rounded text-center text-sm leading-6 mr-2">
                                  {option.displayNumber}
                                </span>
                                <span className="font-medium text-gray-800">
                                  {option.option_text}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 italic bg-yellow-50 border border-yellow-200 rounded p-2">
                          💡 <span className="font-medium">Подсказка:</span> В выпадающем списке слева вы увидите номер и текст каждого варианта
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()
            )}

            {/* Fill in the Blank */}
            {question.question_type === QuestionType.FILL_IN_BLANK && (() => {
              // Разбиваем текст на части по пропускам (_____) 
              const parts = question.question_text.split('_____');
              const blanksCount = parts.length - 1;
              
              return (
                <div className="space-y-3">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-base text-gray-900 leading-relaxed">
                      {parts.map((part, index) => (
                        <span key={index}>
                          {part}
                          {index < parts.length - 1 && (
                            <input
                              {...register(`answers.${qIndex}.blanks.${index}`)}
                              type="text"
                              className="inline-block mx-1 px-3 py-1 border-b-2 border-blue-400 bg-white focus:border-blue-600 focus:outline-none text-blue-700 font-medium min-w-[120px] max-w-[200px]"
                              placeholder={`пропуск ${index + 1}`}
                              style={{ width: '150px' }}
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
                    <span>💡</span>
                    <span>
                      <span className="font-medium">Подсказка:</span> Заполните {blanksCount} {blanksCount === 1 ? 'пропуск' : blanksCount <= 4 ? 'пропуска' : 'пропусков'} прямо в тексте
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Ordering */}
            {question.question_type === QuestionType.ORDERING && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">Расставьте элементы в правильном порядке (перетащите или укажите порядковые номера):</p>
                {(orderingShuffles[question.id!] || question.options).map((option, idx) => (
                  <div key={option.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input
                      type="number"
                      min="1"
                      max={question.options.length}
                      {...register(`answers.${qIndex}.order.${option.id}`)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                      placeholder={`${idx + 1}`}
                    />
                    <span className="flex-1">{option.option_text}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-500">Введите числа от 1 до {question.options.length} для установки порядка</p>
              </div>
            )}

            {/* Code */}
            {question.question_type === QuestionType.CODE && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Язык программирования:</span> Python, JavaScript, или другой
                </div>
                <textarea
                  {...register(`answers.${qIndex}.code`)}
                  className="input font-mono text-sm"
                  rows={10}
                  placeholder="// Введите ваш код здесь&#10;function example() {&#10;  return 'Hello World';&#10;}"
                  style={{ fontFamily: 'monospace' }}
                />
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>💡</span>
                  <span>Используйте Tab для отступов, ваш код будет проверен преподавателем</span>
                </div>
              </div>
            )}

            {/* File Upload */}
            {question.question_type === QuestionType.FILE_UPLOAD && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    {...register(`answers.${qIndex}.file`)}
                    className="hidden"
                    id={`file-${qIndex}`}
                  />
                  <label
                    htmlFor={`file-${qIndex}`}
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600">
                      Нажмите для выбора файла или перетащите сюда
                    </span>
                    <span className="text-xs text-gray-500">
                      Допустимые форматы: PDF, DOC, DOCX, JPG, PNG (макс. 10MB)
                    </span>
                  </label>
                </div>
                <div className="text-sm text-gray-600">
                  {watch(`answers.${qIndex}.file`)?.[0]?.name && (
                    <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded">
                      <span className="text-green-600">✓</span>
                      <span>Выбран файл: {watch(`answers.${qIndex}.file`)?.[0]?.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitMutation.isPending || !startedAt}
            className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Send size={18} />
            <span>{submitMutation.isPending ? 'Отправка...' : 'Отправить тест'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

