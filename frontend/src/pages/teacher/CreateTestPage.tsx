import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { testService } from '@/services/testService'
import { Test, QuestionType, TestStatus } from '@/types'
import { Plus, Trash2, Save } from 'lucide-react'

export default function CreateTestPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      duration_minutes: undefined,
      passing_score: 60,
      max_attempts: undefined,
      show_results: true,
      shuffle_questions: false,
      shuffle_options: false,
      status: TestStatus.DRAFT,
      questions: [
        {
          question_text: '',
          question_type: QuestionType.SINGLE_CHOICE,
          points: 1,
          order: 0,
          explanation: '',
          options: [
            { option_text: '', is_correct: false, order: 0, matching_pair: '' },
            { option_text: '', is_correct: false, order: 1, matching_pair: '' },
          ],
        },
      ],
    },
  })

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: 'questions',
  })

  const createTestMutation = useMutation({
    mutationFn: testService.createTest,
    onSuccess: (data) => {
      // eslint-disable-next-line no-console
      console.info('[tests] createTest success', { id: data.id })
      setSubmitError(null)
      navigate(`/teacher/tests/${data.id}`)
    },
    onError: (error: any) => {
      // eslint-disable-next-line no-console
      console.error('[tests] createTest failure', {
        status: error?.response?.status,
        detail: error?.response?.data,
        message: error?.message,
      })
      
      // Извлекаем детальное сообщение об ошибке
      let errorMessage = 'Не удалось создать тест. Пожалуйста, попробуйте снова.'
      
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail
        } else if (Array.isArray(error.response.data.detail)) {
          // Pydantic validation errors
          errorMessage = error.response.data.detail
            .map((err: any) => `${err.loc?.join(' → ')}: ${err.msg}`)
            .join('; ')
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setSubmitError(errorMessage)
      
      // Прокрутка к началу страницы для показа ошибки
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const onSubmit = (data: any) => {
    // eslint-disable-next-line no-console
    console.groupCollapsed('[tests] createTest submit')
    // eslint-disable-next-line no-console
    console.debug('raw form data', data)
    const cleanedData = {
      ...data,
      duration_minutes: data.duration_minutes === '' ? null : data.duration_minutes,
      max_attempts: data.max_attempts === '' ? null : data.max_attempts,
    };

    const processedData = {
      ...cleanedData,
      questions: (cleanedData.questions || []).map((question: any) => {
        const processedQuestion = { ...question };

        if (question.question_type === QuestionType.FILL_IN_BLANK) {
          const blanksSource = question.blanks_answers || {};
          const blanksArray = Object.keys(blanksSource)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => (blanksSource[key] ?? '').toString().trim())
            .filter((value) => value !== '');
          processedQuestion.correct_answer_text = blanksArray.join(', ');
        }

        delete processedQuestion.blanks_answers;

        const rawOptions = Array.isArray(question.options) ? question.options : [];
        const normalizedOptions = rawOptions.map((opt: any, optionIndex: number) => ({
          option_text: typeof opt.option_text === 'string' ? opt.option_text.trim() : '',
          matching_pair: typeof opt.matching_pair === 'string' ? opt.matching_pair.trim() : undefined,
          is_correct: !!opt.is_correct,
          order: optionIndex,
        }));

        let processedOptions: any[] = [];

        switch (question.question_type) {
          case QuestionType.SINGLE_CHOICE:
          case QuestionType.MULTIPLE_CHOICE:
            processedOptions = normalizedOptions
              .filter((opt) => opt.option_text !== '')
              .map((opt, optionIndex) => ({
                ...opt,
                order: optionIndex,
              }));
            // For single choice ensure exactly one correct flag persists
            if (question.question_type === QuestionType.SINGLE_CHOICE) {
              const hasAnyCorrect = processedOptions.some((o) => o.is_correct)
              if (!hasAnyCorrect && processedOptions.length > 0) {
                processedOptions = processedOptions.map((o, i) => ({ ...o, is_correct: i === 0 }))
              } else if (hasAnyCorrect) {
                // if multiple were marked, leave only the first
                let found = false
                processedOptions = processedOptions.map((o) => {
                  if (o.is_correct && !found) {
                    found = true
                    return o
                  }
                  return { ...o, is_correct: false }
                })
              }
            }
            break;
          case QuestionType.MATCHING:
            processedOptions = normalizedOptions
              .map((opt, optionIndex) => ({
                option_text: opt.option_text,
                matching_pair: opt.matching_pair,
                is_correct: false,
                order: optionIndex,
              }))
              .filter((opt) => opt.option_text !== '' && (opt.matching_pair ?? '') !== '');
            delete processedQuestion.correct_answer_text;
            break;
          case QuestionType.ORDERING:
            processedOptions = normalizedOptions
              .map((opt, optionIndex) => ({
                option_text: opt.option_text,
                matching_pair: undefined,
                is_correct: false,
                order: optionIndex + 1,
              }))
              .filter((opt) => opt.option_text !== '');
            break;
          default:
            processedOptions = [];
        }

        if (
          question.question_type === QuestionType.SINGLE_CHOICE ||
          question.question_type === QuestionType.MULTIPLE_CHOICE
        ) {
          processedQuestion.options = processedOptions;
        } else if (
          question.question_type === QuestionType.MATCHING ||
          question.question_type === QuestionType.ORDERING
        ) {
          processedQuestion.options = processedOptions;
        } else {
          processedQuestion.options = [];
        }

        return processedQuestion;
      }),
    };

    // eslint-disable-next-line no-console
    console.debug('processed payload', processedData)

    // Note: client-side validation disabled (server normalizes); keep UX simple

    createTestMutation.mutate(processedData, {
      onSettled: () => {
        // eslint-disable-next-line no-console
        console.groupEnd()
      },
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Создать новый тест</h1>

      {/* Error Message */}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Ошибка при создании теста</h3>
              <p className="mt-1 text-sm text-red-700">{submitError}</p>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="ml-auto flex-shrink-0 text-red-500 hover:text-red-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Test Info */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Информация о тесте</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">Название *</label>
              <input
                {...register('title', { required: 'Название обязательно' })}
                className="input"
                placeholder="Введите название теста"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="label">Описание</label>
              <textarea
                {...register('description')}
                className="input"
                rows={3}
                placeholder="Введите описание теста"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Длительность (минуты)</label>
                <input
                  type="number"
                  {...register('duration_minutes')}
                  className="input"
                  placeholder="Оставьте пустым для неограниченного"
                />
              </div>

              <div>
                <label className="label">Проходной балл (%)</label>
                <input
                  type="number"
                  {...register('passing_score', { min: 0, max: 100 })}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Макс. попыток</label>
                <input
                  type="number"
                  {...register('max_attempts')}
                  className="input"
                  placeholder="Оставьте пустым для неограниченного"
                />
              </div>

              <div>
                <label className="label">Статус</label>
                <select {...register('status')} className="input">
                  <option value={TestStatus.DRAFT}>Черновик</option>
                  <option value={TestStatus.PUBLISHED}>Опубликован</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" {...register('show_results')} className="rounded" />
                <span className="text-sm font-medium text-gray-700">Показывать результаты ученикам</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input type="checkbox" {...register('shuffle_questions')} className="rounded" />
                <span className="text-sm font-medium text-gray-700">Перемешивать вопросы</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input type="checkbox" {...register('shuffle_options')} className="rounded" />
                <span className="text-sm font-medium text-gray-700">Перемешивать варианты ответов</span>
              </label>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-xl font-semibold">Вопросы</h2>
          <button
            type="button"
            onClick={() =>
              appendQuestion({
                question_text: '',
                question_type: QuestionType.SINGLE_CHOICE,
                points: 1,
                order: questionFields.length,
                explanation: '',
                options: [
                  { option_text: '', is_correct: false, order: 0, matching_pair: '' },
                  { option_text: '', is_correct: false, order: 1, matching_pair: '' },
                ],
              })
            }
            className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus size={18} />
            <span>Добавить вопрос</span>
          </button>
        </div>

          <div className="space-y-6">
            {questionFields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <h3 className="font-medium">Вопрос {index + 1}</h3>
                  {questionFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="self-start text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Текст вопроса *</label>
                    <textarea
                      {...register(`questions.${index}.question_text`, {
                        required: 'Текст вопроса обязателен',
                      })}
                      className="input"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Тип вопроса</label>
                      <select
                        {...register(`questions.${index}.question_type`)}
                        className="input"
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
                        {...register(`questions.${index}.points`)}
                        className="input"
                      />
                    </div>
                  </div>

                  {/* Options for Single Choice and Multiple Choice */}
                  {(watch(`questions.${index}.question_type`) === QuestionType.SINGLE_CHOICE ||
                    watch(`questions.${index}.question_type`) === QuestionType.MULTIPLE_CHOICE) && (
                    <div>
                      <label className="label">
                        Варианты ответов
                        {watch(`questions.${index}.question_type`) === QuestionType.SINGLE_CHOICE && (
                          <span className="text-sm text-gray-500 ml-2">(отметьте один правильный)</span>
                        )}
                        {watch(`questions.${index}.question_type`) === QuestionType.MULTIPLE_CHOICE && (
                          <span className="text-sm text-gray-500 ml-2">(отметьте все правильные)</span>
                        )}
                      </label>
                      <div className="space-y-2">
                        {[0, 1, 2, 3].map((optIndex) => {
                          const isSingle = watch(`questions.${index}.question_type`) === QuestionType.SINGLE_CHOICE
                          const optionPath = `questions.${index}.options.${optIndex}.is_correct` as const
                          const checked = !!watch(optionPath)
                          return (
                            <div key={optIndex} className="flex items-center space-x-2">
                              {isSingle ? (
                                <input
                                  type="radio"
                                  name={`question_${index}_correct`}
                                  checked={checked}
                                  onChange={() => {
                                    ;[0,1,2,3].forEach((i) => {
                                      setValue(`questions.${index}.options.${i}.is_correct`, i === optIndex, { shouldDirty: true })
                                    })
                                  }}
                                  className="rounded"
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  {...register(optionPath)}
                                  className="rounded"
                                />
                              )}
                              <input
                                {...register(`questions.${index}.options.${optIndex}.option_text`)}
                                className="input flex-1"
                                placeholder={`Вариант ${optIndex + 1}`}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Options for True/False */}
                  {watch(`questions.${index}.question_type`) === QuestionType.TRUE_FALSE && (
                    <div>
                      <label className="label">Правильный ответ</label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value="true"
                            {...register(`questions.${index}.correct_answer_text`)}
                            className="rounded"
                          />
                          <span className="text-gray-700">Правда</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value="false"
                            {...register(`questions.${index}.correct_answer_text`)}
                            className="rounded"
                          />
                          <span className="text-gray-700">Ложь</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Correct answer for Short Answer */}
                  {watch(`questions.${index}.question_type`) === QuestionType.SHORT_ANSWER && (
                    <div>
                      <label className="label">Правильный ответ (для автопроверки)</label>
                      <input
                        {...register(`questions.${index}.correct_answer_text`)}
                        className="input"
                        placeholder="Введите правильный ответ"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Ответ ученика будет сравниваться с этим текстом (без учета регистра)
                      </p>
                    </div>
                  )}

                  {/* Note for Essay */}
                  {watch(`questions.${index}.question_type`) === QuestionType.ESSAY && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        📝 Вопрос типа "Эссе" требует ручной проверки преподавателем. 
                        Ученик сможет ввести развернутый текстовый ответ.
                      </p>
                    </div>
                  )}

                  {/* Numeric Answer */}
                  {watch(`questions.${index}.question_type`) === QuestionType.NUMERIC && (
                    <div className="space-y-3">
                      <div>
                        <label className="label">Правильный ответ (число)</label>
                        <input
                          type="number"
                          step="any"
                          {...register(`questions.${index}.correct_answer_text`)}
                          className="input"
                          placeholder="Например: 42 или 3.14"
                        />
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600">
                          💡 Можно указать точное число. Ответ ученика будет сравниваться с указанным значением.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Matching */}
                  {watch(`questions.${index}.question_type`) === QuestionType.MATCHING && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                        <p className="text-sm font-medium text-blue-900 mb-2">📋 Как работает "Соответствие":</p>
                        <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                          <li>Введите элементы в левую колонку (например: языки программирования)</li>
                          <li>Введите соответствующие элементы в правую колонку (например: их создатели)</li>
                          <li>Ученик увидит левую колонку и перемешанную правую колонку</li>
                          <li>Задача ученика - правильно сопоставить пары</li>
                        </ul>
                      </div>
                      
                      <div>
                        <label className="label mb-3">Укажите пары для сопоставления:</label>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-semibold text-sm text-gray-700 px-2">
                            <div>Левая колонка (элементы)</div>
                            <div>Правая колонка (соответствия)</div>
                          </div>
                          {[0, 1, 2, 3].map((pairIndex) => (
                            <div key={pairIndex} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <input
                                  {...register(`questions.${index}.options.${pairIndex}.matching_pair`)}
                                  className="input"
                                  placeholder={`Например: Python`}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400">→</span>
                                <input
                                  {...register(`questions.${index}.options.${pairIndex}.option_text`)}
                                  className="input flex-1"
                                  placeholder={`Например: Гвидо ван Россум`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800">
                          💡 Совет: Используйте понятные и однозначные формулировки. Правая колонка будет перемешана при показе студенту.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Fill in the Blank */}
                  {watch(`questions.${index}.question_type`) === QuestionType.FILL_IN_BLANK && (() => {
                    // Получаем текст вопроса и находим количество пропусков
                    const questionText = watch(`questions.${index}.question_text`) || '';
                    const blanksCount = (questionText.match(/_____/g) || []).length;
                    
                    return (
                      <div className="space-y-4">
                        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                          <p className="text-sm font-medium text-purple-900 mb-2">📝 Как работает "Заполнить пропуски":</p>
                          <ul className="text-xs text-purple-800 space-y-1 ml-4 list-disc">
                            <li>Используйте <code className="bg-purple-200 px-1 rounded">_____</code> (5 подчеркиваний) для обозначения пропусков</li>
                            <li>Ученик увидит поля ввода <strong>прямо в местах пропусков</strong></li>
                            <li>Для каждого пропуска укажите правильный ответ в отдельном поле ниже</li>
                          </ul>
                        </div>
                        
                        <div>
                          <label className="label">Текст с пропусками</label>
                          <textarea
                            {...register(`questions.${index}.question_text`)}
                            className="input"
                            rows={4}
                            placeholder="Например: Столица Франции — _____, столица Италии — _____, столица Германии — _____."
                          />
                          {blanksCount > 0 && (
                            <p className="text-xs text-gray-600 mt-1">
                              Найдено пропусков: <span className="font-semibold text-purple-600">{blanksCount}</span>
                            </p>
                          )}
                        </div>
                        
                        {blanksCount > 0 ? (
                          <div className="space-y-3">
                            <label className="label">Правильные ответы для каждого пропуска:</label>
                            <div className="space-y-2">
                              {Array.from({ length: blanksCount }).map((_, blankIndex) => (
                                <div key={blankIndex} className="flex items-center space-x-3">
                                  <span className="flex-shrink-0 w-24 text-sm font-medium text-gray-700">
                                    Пропуск {blankIndex + 1}:
                                  </span>
                                  <input
                                    {...register(`questions.${index}.blanks_answers.${blankIndex}`)}
                                    className="input flex-1"
                                    placeholder={`Например: ${blankIndex === 0 ? 'Париж' : blankIndex === 1 ? 'Рим' : 'Берлин'}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                              💡 Ответы будут проверяться в том же порядке, в котором идут пропуски в тексте
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-xs text-yellow-800">
                              ⚠️ Добавьте пропуски в текст, используя <code className="bg-yellow-200 px-1 rounded">_____</code> (5 подчеркиваний)
                            </p>
                          </div>
                        )}
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs text-green-800">
                            ✅ <span className="font-medium">Что увидит ученик:</span> Текст с полями ввода вместо подчеркиваний, где можно сразу вписать ответы
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ordering */}
                  {watch(`questions.${index}.question_type`) === QuestionType.ORDERING && (
                    <div className="space-y-3">
                      <label className="label">Элементы для упорядочивания (в правильном порядке)</label>
                      <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((orderIndex) => (
                          <div key={orderIndex} className="flex items-center space-x-2">
                            <span className="text-gray-500 font-medium w-6">{orderIndex + 1}.</span>
                            <input
                              {...register(`questions.${index}.options.${orderIndex}.option_text`)}
                              className="input flex-1"
                              placeholder={`Элемент ${orderIndex + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-800">
                          🔢 Укажите элементы в правильном порядке. Ученику они будут показаны в случайном порядке.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Code */}
                  {watch(`questions.${index}.question_type`) === QuestionType.CODE && (
                    <div className="space-y-3">
                      <div>
                        <label className="label">Язык программирования</label>
                        <select
                          {...register(`questions.${index}.code_language`)}
                          className="input"
                        >
                          <option value="python">Python</option>
                          <option value="javascript">JavaScript</option>
                          <option value="java">Java</option>
                          <option value="cpp">C++</option>
                          <option value="csharp">C#</option>
                          <option value="sql">SQL</option>
                          <option value="html">HTML/CSS</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Эталонный код (необязательно)</label>
                        <textarea
                          {...register(`questions.${index}.correct_answer_text`)}
                          className="input font-mono text-sm"
                          rows={6}
                          placeholder="// Введите пример правильного решения"
                        />
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                        <p className="text-xs text-indigo-800">
                          💻 Ученик получит редактор кода с подсветкой синтаксиса. Требует ручной проверки.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* File Upload */}
                  {watch(`questions.${index}.question_type`) === QuestionType.FILE_UPLOAD && (
                    <div className="space-y-3">
                      <div>
                        <label className="label">Допустимые форматы файлов</label>
                        <input
                          {...register(`questions.${index}.file_types`)}
                          className="input"
                          placeholder="Например: .pdf, .doc, .docx, .jpg, .png"
                        />
                      </div>
                      <div>
                        <label className="label">Максимальный размер (МБ)</label>
                        <input
                          type="number"
                          {...register(`questions.${index}.max_file_size`)}
                          className="input"
                          placeholder="Например: 10"
                          defaultValue={10}
                        />
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs text-red-800">
                          📎 Ученик сможет загрузить файл. Требует ручной проверки преподавателем.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label">Пояснение (необязательно)</label>
                    <textarea
                      {...register(`questions.${index}.explanation`)}
                      className="input"
                      rows={2}
                      placeholder="Объясните правильный ответ"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/teacher/tests')}
            className="btn btn-secondary w-full sm:w-auto"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={createTestMutation.isPending}
            className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Save size={18} />
            <span>{createTestMutation.isPending ? 'Создание...' : 'Создать тест'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

