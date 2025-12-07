import { useState, useEffect, useRef, useMemo, useCallback, type SyntheticEvent, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { testService } from '@/services/testService'
import { resultService } from '@/services/resultService'
import { QuestionType, TestStatus, Question as QuestionSchema } from '@/types'
import { Clock, Send } from 'lucide-react'
import { createPortal } from 'react-dom'
import MathText from '@/components/MathText'
import MathInput from '@/components/MathInput'

type NoticeModalConfig = {
  title: string
  message: string
  confirmLabel?: string
  onConfirm?: () => void
}

const logTestFlow = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.debug('[TakeTest]', ...args)
}

export default function TakeTestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [startedAt, setStartedAt] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [matchingShuffles, setMatchingShuffles] = useState<Record<number, { id: number; option_text: string; displayNumber: number }[]>>({})
  const [orderingShuffles, setOrderingShuffles] = useState<Record<number, QuestionSchema['options']>>({})
  const [orderingAnswers, setOrderingAnswers] = useState<Record<number, number[]>>({})
  const orderingDragRef = useRef<{ questionId: number; optionId: number } | null>(null)
  const [antiCheatNotice, setAntiCheatNotice] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const [isTestActive, setIsTestActive] = useState(false)
  const [fullscreenWarning, setFullscreenWarning] = useState(false)
  const [fullscreenViolations, setFullscreenViolations] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [noticeModal, setNoticeModal] = useState<NoticeModalConfig | null>(null)
  const [pendingSubmission, setPendingSubmission] = useState<any | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<number, string>>({})
  const [fileAnswers, setFileAnswers] = useState<Record<number, { file_name: string; file_type: string; file_size: number; file_content: string }>>({})
  const antiCheatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string) || '')
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
      reader.readAsDataURL(file)
    })
  }

  const queryClient = useQueryClient()

  const { data: test, isLoading } = useQuery({
    queryKey: ['test', id],
    queryFn: () => testService.getTest(Number(id)),
    enabled: !!id,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  })

  const { register, handleSubmit, setValue, watch, reset } = useForm<{
    answers: Array<Record<string, unknown>>
  }>({
    defaultValues: { answers: [] },
    shouldUnregister: false,
  })
  const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

  const handleFileSelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, qIndex: number, questionId?: number) => {
    const input = event.target
    const file = input.files?.item(0)

    if (!file) {
      setSelectedFiles((prev) => {
        const next = { ...prev }
        delete next[qIndex]
        return next
      })
      setFileAnswers((prev) => {
        const next = { ...prev }
        if (questionId !== undefined) delete next[questionId]
        return next
      })
      setValue(`answers.${qIndex}.file`, input.files, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setNoticeModal({
        title: 'Файл слишком большой',
        message: `Максимальный размер файла — ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))} МБ`,
      })
      input.value = ''
      setSelectedFiles((prev) => {
        const next = { ...prev }
        delete next[qIndex]
        return next
      })
      setFileAnswers((prev) => {
        const next = { ...prev }
        if (questionId !== undefined) delete next[questionId]
        return next
      })
      setValue(`answers.${qIndex}.file`, undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
      return
    }

    try {
      const file_content = await readFileAsBase64(file)
      setSelectedFiles((prev) => ({ ...prev, [qIndex]: file.name }))
      if (questionId !== undefined) {
        setFileAnswers((prev) => ({
          ...prev,
          [questionId]: {
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_content,
          },
        }))
      }
      setValue(`answers.${qIndex}.file`, input.files, { shouldDirty: true, shouldTouch: true, shouldValidate: true })

      // Если fullscreen сбросился при выборе файла, вернём его сразу
      if (!isFullscreenActive()) {
        requestFullscreen().catch(() => {
          // игнорируем — загрузка файла не должна блокироваться
        })
      }
    } catch {
      setNoticeModal({
        title: 'Не удалось прочитать файл',
        message: 'Попробуйте выбрать файл снова или другой файл.',
      })
      input.value = ''
      setSelectedFiles((prev) => {
        const next = { ...prev }
        delete next[qIndex]
        return next
      })
      setFileAnswers((prev) => {
        const next = { ...prev }
        if (questionId !== undefined) delete next[questionId]
        return next
      })
      setValue(`answers.${qIndex}.file`, undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    }
  }, [setNoticeModal, setValue])

  const applyOrderingValues = useCallback(
    (qIndex: number, questionId: number, optionIdsInOrder: number[]) => {
      optionIdsInOrder.forEach((optId, idx) => {
        setValue(`answers.${qIndex}.order.${optId}`, idx + 1, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
      })
    },
    [setValue]
  )

  const handleOrderingDragStart = useCallback((questionId: number, optionId: number) => {
    orderingDragRef.current = { questionId, optionId }
  }, [])

  const handleOrderingDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const handleOrderingDrop = useCallback(
    (qIndex: number, question: QuestionSchema, targetOptionId: number) => {
      const dragData = orderingDragRef.current
      orderingDragRef.current = null
      if (!dragData || dragData.questionId !== question.id) return
      const currentOrder =
        orderingAnswers[question.id!] ?? (orderingShuffles[question.id!] || question.options).map((o) => o.id!)
      const fromIdx = currentOrder.indexOf(dragData.optionId)
      const toIdx = currentOrder.indexOf(targetOptionId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
      const next = [...currentOrder]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, dragData.optionId)
      setOrderingAnswers((prev) => ({ ...prev, [question.id!]: next }))
      applyOrderingValues(qIndex, question.id!, next)
    },
    [applyOrderingValues, orderingAnswers, orderingShuffles]
  )

  // Start test on mount
  useEffect(() => {
    if (!test || isTestActive) return

    setNoticeModal(null)
    setPendingSubmission(null)

    if (test.status !== TestStatus.PUBLISHED) {
      setNoticeModal({
        title: 'Тест недоступен',
        message: 'Тест ещё не опубликован. Обратитесь к преподавателю.',
        confirmLabel: 'К списку тестов',
        onConfirm: () => navigate('/student/tests'),
      })
      return
    }

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
    const orderingInitial: Record<number, number[]> = {}
    test.questions
      .filter((q) => q.question_type === QuestionType.ORDERING)
      .forEach((q) => {
        const shuffled = [...q.options].sort(() => Math.random() - 0.5)
        orderingMap[q.id!] = shuffled
        orderingInitial[q.id!] = shuffled.map((opt) => opt.id!)
      })
    setOrderingShuffles(orderingMap)
    setOrderingAnswers(orderingInitial)
    setShowInstructions(true)
    setIsTestActive(false)
    setStartedAt('')
    setTimeLeft(null)
    setCurrentQuestionIndex(0)
    setFullscreenWarning(false)
  }, [test, navigate, isTestActive])

  useEffect(() => {
    if (!test) return
    test.questions
      .filter((q) => q.question_type === QuestionType.ORDERING)
      .forEach((q, qIndex) => {
        const seq = orderingAnswers[q.id!] ?? (orderingShuffles[q.id!] || q.options).map((o) => o.id!)
        seq.forEach((optId, idx) => {
          setValue(`answers.${qIndex}.order.${optId}`, idx + 1, { shouldValidate: false })
        })
      })
  }, [orderingAnswers, orderingShuffles, setValue, test])

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

  const startTestMutation = useMutation({
    mutationFn: async () => {
      if (!test) {
        throw new Error('Тест недоступен')
      }
      return resultService.startTest(test.id)
    },
    onSuccess: (data) => {
      setStartedAt(data.started_at)
      if (test?.duration_minutes) {
        setTimeLeft(test.duration_minutes * 60)
      } else {
        setTimeLeft(null)
      }
      setIsTestActive(true)
      setFullscreenViolations(0)
      setFullscreenWarning(false)
    },
    onError: (err: any) => {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      const message =
        detail ||
        (status === 403
          ? 'Тест не назначен вам или недоступен.'
          : 'Не удалось начать попытку. Попробуйте позже.')
      setNoticeModal({
        title: 'Не удалось начать тест',
        message,
        confirmLabel: 'Вернуться к тестам',
        onConfirm: () => {
          setShowInstructions(true)
          setIsTestActive(false)
          navigate('/student/tests')
        },
      })
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!startedAt) {
        throw new Error('Не удалось зафиксировать время начала теста. Обновите страницу и попробуйте снова.');
      }

      const answers = await Promise.all(sortedQuestions.map(async (question, index) => {
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
            const stored = question.id ? fileAnswers[question.id] : undefined

            if (stored) {
              answerData.file_name = stored.file_name
              answerData.file_type = stored.file_type
              answerData.file_size = stored.file_size
              answerData.file_content = stored.file_content
              break
            }

            let file: File | null = null

            if (rawAnswer.file instanceof FileList) {
              file = rawAnswer.file.item(0)
            } else if (Array.isArray(rawAnswer.file)) {
              file = rawAnswer.file[0] ?? null
            } else if (rawAnswer.file?.target instanceof HTMLInputElement) {
              file = rawAnswer.file.target.files?.item(0) ?? null
            } else if (rawAnswer.target instanceof HTMLInputElement) {
              file = rawAnswer.target.files?.item(0) ?? null
            }

            if (file) {
              answerData.file_name = file.name
              answerData.file_type = file.type
              answerData.file_size = file.size
              answerData.file_content = await readFileAsBase64(file)
              break
            }

            answerData.file_name = rawAnswer.file_name ?? null
            answerData.file_type = rawAnswer.file_type ?? null
            answerData.file_size = rawAnswer.file_size ?? null
            answerData.file_content = rawAnswer.file_content ?? null
            break
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
    onSuccess: async () => {
      await exitFullscreen()
      setIsTestActive(false)
      navigate('/student/results');
    },
    onError: async (err: any) => {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail

      // Best-effort check: if the backend still saved the attempt, treat it as success
      if (test?.id && startedAt) {
        try {
          const results = await resultService.getResults(test.id)
          const startedAtTs = new Date(startedAt).getTime()
          const recentAttempt = results.find((res) => new Date(res.completed_at).getTime() >= startedAtTs)

          if (recentAttempt) {
            await exitFullscreen()
            setIsTestActive(false)
            navigate('/student/results')
            return
          }
        } catch {
          // ignore fallback errors and show the original message
        }
      }

      // Secondary fallback: if there is any very recent attempt (last 5 minutes), assume success
      if (test?.id) {
        try {
          const results = await resultService.getResults(test.id)
          const now = Date.now()
          const freshAttempt = results.find((res) => now - new Date(res.completed_at).getTime() <= 5 * 60 * 1000)
          if (freshAttempt) {
            await exitFullscreen()
            setIsTestActive(false)
            navigate('/student/results')
            return
          }
        } catch {
          // ignore
        }
      }

      const message =
        detail ||
        (status === 400
          ? 'Проверьте корректность ответов и попробуйте снова.'
          : 'Не удалось отправить тест. Попробуйте позже.')
      setNoticeModal({
        title: 'Ошибка отправки',
        message,
      })
    }
  });

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

  const requestFullscreen = async () => {
    const element = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
      msRequestFullscreen?: () => Promise<void>
    }

    if (document.fullscreenEnabled && element.requestFullscreen) {
      await element.requestFullscreen()
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen()
    } else if (element.msRequestFullscreen) {
      await element.msRequestFullscreen()
    }
  }

  const isFullscreenActive = () => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
  }

  const exitFullscreen = async () => {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>
    }
    if (doc.fullscreenElement && doc.exitFullscreen) {
      await doc.exitFullscreen().catch(() => {})
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen().catch(() => {})
    }
  }

  const handleStartTest = async () => {
    if (!test || startTestMutation.isPending || !hasQuestions) return
    try {
      await queryClient.refetchQueries({ queryKey: ['test', id], type: 'active' })
    } catch {
      // ignore refetch errors, attempt will fail gracefully later
    }
    try {
      await requestFullscreen()
    } catch {
      // ignore fullscreen errors, still allow test to start
    } finally {
      setShowInstructions(false)
      startTestMutation.mutate()
    }
  }

  const triggerAntiCheatNotice = () => {
    setAntiCheatNotice(true)
    if (antiCheatTimeoutRef.current) {
      clearTimeout(antiCheatTimeoutRef.current)
    }
    antiCheatTimeoutRef.current = setTimeout(() => setAntiCheatNotice(false), 2500)
  }

  const handleProtectedEvent = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    triggerAntiCheatNotice()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'a'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        triggerAntiCheatNotice()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      if (antiCheatTimeoutRef.current) {
        clearTimeout(antiCheatTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null }
      const fullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement
      const isFullscreen = Boolean(fullscreenElement)
      if (!isFullscreen && isTestActive) {
        setFullscreenWarning(true)
        setFullscreenViolations((prev) => prev + 1)
      } else {
        setFullscreenWarning(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener)
    }
  }, [isTestActive])

  const handleReenterFullscreen = async () => {
    try {
      await requestFullscreen()
      setFullscreenWarning(false)
    } catch {
      // ignore
    }
  }

  const sortedQuestions = useMemo(() => {
    if (!test?.questions) return []
    return [...test.questions]
      .filter((q): q is QuestionSchema => Boolean(q))
      .sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return (a.id ?? 0) - (b.id ?? 0)
      })
  }, [test])
  const totalQuestions = sortedQuestions.length
  const hasQuestions = totalQuestions > 0
  const hasNextQuestion = currentQuestionIndex < totalQuestions - 1

  const handleFinalSubmit = useCallback((data: any) => {
    logTestFlow('handleFinalSubmit fired', {
      isTestActive,
      hasNextQuestion,
      currentQuestionIndex,
      totalQuestions,
    })
    if (!isTestActive) {
      setShowInstructions(true)
      return
    }

    if (hasNextQuestion) {
      logTestFlow('handleFinalSubmit detected remaining questions — auto advancing')
      handleNextQuestion()
      return
    }

    logTestFlow('Setting pending submission from handleFinalSubmit')
    setPendingSubmission(data)
  }, [isTestActive, hasNextQuestion, currentQuestionIndex, totalQuestions])

  useEffect(() => {
    if (!hasQuestions) {
      reset({ answers: [] })
      return
    }
    reset({
      answers: sortedQuestions.map(() => ({})),
    })
  }, [hasQuestions, sortedQuestions, reset])

  const handleNextQuestion = () => {
    if (!isTestActive || !hasQuestions) return
    setCurrentQuestionIndex((prev) => {
      const maxIndex = Math.max(totalQuestions - 1, 0)
      if (prev >= maxIndex) {
        return maxIndex
      }
      return prev + 1
    })
  }

  const handlePrevQuestion = () => {
    if (!isTestActive || totalQuestions <= 0) return
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0))
  }

  const handleNoticeConfirm = () => {
    if (!noticeModal) return
    const callback = noticeModal.onConfirm
    setNoticeModal(null)
    callback?.()
  }

  const handleConfirmSubmit = () => {
    if (!pendingSubmission) return

    // Если вышли из полноэкранного режима — попробуем вернуть, чтобы не блокировать отправку
    if (!isFullscreenActive()) {
      requestFullscreen().catch(() => {
        // игнорируем, чтобы всё равно попытаться отправить
      })
    }

    const missingFileQuestion = sortedQuestions.find((question, idx) => {
      if (question.question_type !== QuestionType.FILE_UPLOAD) return false
      const stored = question.id ? fileAnswers[question.id] : undefined
      const raw = pendingSubmission?.answers?.[idx]?.file
      return !stored && !raw
    })

    if (missingFileQuestion) {
      setNoticeModal({
        title: 'Требуется файл',
        message: 'Для вопроса с загрузкой файла нужно выбрать файл перед отправкой.',
      })
      setPendingSubmission(null)
      return
    }

    submitMutation.mutate(pendingSubmission)
    setPendingSubmission(null)
  }

  const handleCancelSubmit = () => {
    setPendingSubmission(null)
  }

  const portalRoot = typeof document !== 'undefined' ? document.body : null
  const renderPortal = (node: ReactNode) => (portalRoot ? createPortal(node, portalRoot) : null)

  const submitForm = useCallback((dataOverride?: any) => {
    logTestFlow('submitForm invoked via explicit action')
    if (dataOverride) {
      handleFinalSubmit(dataOverride)
      return
    }
    handleSubmit((formData) => handleFinalSubmit(formData))()
  }, [handleSubmit, handleFinalSubmit])

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || !isTestActive) {
      return
    }
    const target = event.target as HTMLElement
    const tagName = target.tagName?.toLowerCase()
    const isIgnoredTag = tagName === 'textarea' || tagName === 'button'
    if (isIgnoredTag || target.isContentEditable) {
      return
    }

    event.preventDefault()

    if (hasNextQuestion) {
      logTestFlow('Form keydown handled, moving to next question', {
        currentQuestionIndex,
        totalQuestions,
      })
      handleNextQuestion()
      return
    }

    logTestFlow('Form keydown on last question, triggering final submit')
    submitForm()
  }

  if (isLoading) {
    return <div className="text-center py-12">Загрузка теста...</div>
  }

  if (!test) {
    return <div className="text-center py-12">Тест не найден</div>
  }

  return (
    <div
      className="max-w-4xl mx-auto space-y-6"
      onCopy={handleProtectedEvent}
      onCut={handleProtectedEvent}
      onPaste={handleProtectedEvent}
      onContextMenu={handleProtectedEvent}
    >
      {showInstructions && renderPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900 text-center">Перед началом теста</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <p>Для защиты от списывания применяются следующие правила:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Тест проходит в полноэкранном режиме. Выход фиксируется автоматически.</li>
                <li>Копирование, вставка и контекстное меню отключены. Все попытки записываются.</li>
                <li>Вопросы показываются по одному. После ответа отображается следующий.</li>
              </ul>
              <p className="text-xs text-gray-500">
                При нарушениях преподаватель может назначить повторное прохождение в очном формате.
              </p>
              {!hasQuestions && (
                <p className="text-sm text-red-500">
                  В тесте пока нет вопросов. Обратитесь к преподавателю.
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={handleStartTest}
              disabled={startTestMutation.isPending || !test || !hasQuestions}
            >
              {startTestMutation.isPending ? 'Запуск...' : 'Начать тест в полноэкранном режиме'}
            </button>
          </div>
        </div>
      )}

      {noticeModal && renderPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">{noticeModal.title}</h3>
            <p className="text-sm text-gray-600">{noticeModal.message}</p>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={handleNoticeConfirm}
            >
              {noticeModal.confirmLabel || 'Понятно'}
            </button>
          </div>
        </div>
      )}

      {pendingSubmission && renderPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <h3 className="text-xl font-semibold text-gray-900">Подтверждение отправки</h3>
            <p className="text-sm text-gray-600">
              После отправки тест нельзя будет изменить. Убедитесь, что вы ответили на все вопросы.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handleCancelSubmit}
              >
                Проверить ответы
              </button>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={handleConfirmSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? 'Отправка...' : 'Отправить тест'}
              </button>
            </div>
          </div>
        </div>
      )}

      {antiCheatNotice && (
        <div className="fixed top-4 right-4 z-50 bg-black/80 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Копирование и вставка отключены во время прохождения теста
        </div>
      )}

      {fullscreenWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex flex-col gap-2 items-center">
          <p className="text-sm font-semibold">Обнаружен выход из полноэкранного режима (попыток: {fullscreenViolations})</p>
          <button
            type="button"
            className="btn btn-secondary text-sm bg-white text-red-700 hover:text-red-900"
            onClick={handleReenterFullscreen}
          >
            Вернуться в полноэкранный режим
          </button>
        </div>
      )}
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

      <form
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={handleFormKeyDown}
        className="space-y-6"
      >
        {!hasQuestions && (
          <div className="card text-center text-gray-500">
            <p>Этот тест пока не содержит вопросов. Обратитесь к преподавателю.</p>
          </div>
        )}

        {hasQuestions && (() => {
          const question = sortedQuestions[currentQuestionIndex]
          const qIndex = currentQuestionIndex
          if (!question) {
            return (
              <div className="card text-center text-gray-500">
                <p>Не удалось загрузить вопрос. Попробуйте обновить страницу.</p>
              </div>
            )
          }

          return (
            <div key={question.id ?? qIndex} className="card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex-1">
                  <span className="mr-2">{qIndex + 1}.</span>
                  <MathText text={question.question_text} />
                </h3>
                <span className="text-sm text-gray-500">
                  {question.points} {getPointsLabel(question.points)}
                </span>
              </div>

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
                      <span className="flex-1"><MathText text={option.option_text} /></span>
                    </label>
                  ))}
                </div>
              )}

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
                      <span className="flex-1"><MathText text={option.option_text} /></span>
                    </label>
                  ))}
                </div>
              )}

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
                      <span className="flex-1"><MathText text={option.label} /></span>
                    </label>
                  ))}
                </div>
              )}

              {question.question_type === QuestionType.SHORT_ANSWER && (
                <div className="space-y-2">
                  <MathInput
                    value={(watch('answers')?.[qIndex] as any)?.text ?? ''}
                    onChange={(latex) =>
                      setValue(`answers.${qIndex}.text`, latex, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
                    }
                    placeholder="Ваш ответ (текст или формула)"
                  />
                  <input type="hidden" {...register(`answers.${qIndex}.text`)} />
                </div>
              )}

              {question.question_type === QuestionType.ESSAY && (
                <textarea
                  {...register(`answers.${qIndex}.text`)}
                  className="input"
                  rows={6}
                  placeholder="Введите ваш развернутый ответ..."
                />
              )}

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

              {question.question_type === QuestionType.MATCHING && (() => {
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
              })()}

              {question.question_type === QuestionType.FILL_IN_BLANK && (() => {
                const parts = question.question_text.split('_____')
                const blanksCount = parts.length - 1

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
                )
              })()}

              {question.question_type === QuestionType.ORDERING && (() => {
                const orderIds =
                  orderingAnswers[question.id!] ?? (orderingShuffles[question.id!] || question.options).map((o) => o.id!)
                const orderedOptions = orderIds
                  .map((id) => question.options.find((o) => o.id === id))
                  .filter((o): o is QuestionSchema['options'][number] => Boolean(o))

                return (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 mb-2">Перетащите элементы в нужном порядке:</p>
                    <div className="space-y-2">
                      {orderedOptions.map((option, idx) => (
                        <div
                          key={option.id}
                          draggable
                          onDragStart={() => handleOrderingDragStart(question.id!, option.id!)}
                          onDragOver={handleOrderingDragOver}
                          onDrop={() => handleOrderingDrop(qIndex, question, option.id!)}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm cursor-move"
                        >
                          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 font-semibold">
                            {idx + 1}
                          </span>
                          <span className="flex-1"><MathText text={option.option_text} /></span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Просто перетащите карточки мышкой или пальцем, чтобы задать порядок.
                    </p>
                  </div>
                )
              })()}

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

              {question.question_type === QuestionType.FILE_UPLOAD && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      {...register(`answers.${qIndex}.file`, {
                        onChange: (event) => handleFileSelection(event as React.ChangeEvent<HTMLInputElement>, qIndex, question.id),
                      })}
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
                    {selectedFiles[qIndex] && (
                      <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded">
                        <span className="text-green-600">✓</span>
                        <span>Выбран файл: {selectedFiles[qIndex]}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Вопрос {Math.min(currentQuestionIndex + 1, totalQuestions)} из {totalQuestions || '?'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-secondary w-full sm:w-auto disabled:opacity-40"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0 || !isTestActive || !hasQuestions}
            >
              Назад
            </button>
            {hasNextQuestion ? (
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto disabled:opacity-40"
                onClick={handleNextQuestion}
                disabled={!isTestActive || !hasQuestions}
              >
                Следующий вопрос
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submitForm()}
                disabled={submitMutation.isPending || !startedAt || !isTestActive || !hasQuestions}
                className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Send size={18} />
                <span>{submitMutation.isPending ? 'Отправка...' : 'Отправить тест'}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

