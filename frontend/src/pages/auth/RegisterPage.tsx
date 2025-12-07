import { useForm, Controller } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { authService } from '@/services/authService'
import { RegisterRequest, StudentGender, UserRole } from '@/types'

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'i',
  ґ: 'g',
  є: 'e',
}

const transliterateWord = (word: string): string => {
  const lower = word.toLowerCase()
  let result = ''
  for (const char of lower) {
    result += CYRILLIC_MAP[char] ?? char
  }
  result = result.replace(/[^a-z0-9]/g, '')
  if (result.endsWith('iy')) {
    return `${result.slice(0, -2)}y`
  }
  return result
}

const buildUsernameFromFullName = (fullName: string): string => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(transliterateWord)
    .filter(Boolean)

  if (!parts.length) {
    return ''
  }

  const [first, ...rest] = parts
  const camelRest = rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  let username = [first.toLowerCase(), ...camelRest].join('')

  if (username.length < 3) {
    username = username.padEnd(3, 'x')
  }

  if (username.length > 32) {
    username = username.slice(0, 32)
  }

  return username
}

const SCHOOL_OPTIONS = [
  { value: 'Гимназист', label: 'Гимназист', minClass: 1, maxClass: 10, letter: 'Г' },
  { value: 'Своя школа', label: 'Своя школа', minClass: 1, maxClass: 8, letter: 'СШ' },
  { value: 'Александровский лицей', label: 'Александровский лицей', minClass: 1, maxClass: 9, letter: 'АЛ' },
  { value: 'Терра', label: 'Терра', minClass: 1, maxClass: 7, letter: 'Т' },
  { value: 'Апрель', label: 'Апрель', minClass: 1, maxClass: 8, letter: 'А' },
]

const GENDER_OPTIONS = [
  { value: StudentGender.MALE, label: 'Мужской' },
  { value: StudentGender.FEMALE, label: 'Женский' },
]

type RegisterFormValues = Omit<RegisterRequest, 'gender' | 'date_of_birth' | 'school_name' | 'class_number'> & {
  gender?: StudentGender
  date_of_birth?: string
  school_name?: string
  class_number?: number
}

const FORM_STEPS: Array<{
  id: number
  title: string
  description: string
  fields: Array<keyof RegisterFormValues>
}> = [
  {
    id: 1,
    title: 'Учётные данные',
    description: 'Имя, логин и пароль',
    fields: ['full_name', 'username', 'email', 'password'],
  },
  {
    id: 2,
    title: 'Данные ученика',
    description: 'Пол и дата рождения',
    fields: ['gender', 'date_of_birth'],
  },
  {
    id: 3,
    title: 'Школа и класс',
    description: 'Выбор школы и класса',
    fields: ['school_name', 'class_number', 'class_letter'],
  },
  {
    id: 4,
    title: 'Контакты родителя',
    description: 'Телефон для связи',
    fields: ['phone'],
  },
]

const formatParentPhone = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) {
    return ''
  }

  let normalized = digitsOnly
  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`
  }
  if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`
  }
  normalized = normalized.slice(0, 11)

  const tail = normalized.slice(1)
  let formatted = '+7'

  if (!tail) {
    return formatted
  }

  formatted += ' ('
  formatted += tail.slice(0, Math.min(3, tail.length))
  if (tail.length >= 3) {
    formatted += ')'
  }

  if (tail.length > 3) {
    formatted += ` ${tail.slice(3, Math.min(6, tail.length))}`
  }

  if (tail.length > 6) {
    formatted += `-${tail.slice(6, Math.min(8, tail.length))}`
  }

  if (tail.length > 8) {
    formatted += `-${tail.slice(8, Math.min(10, tail.length))}`
  }

  return formatted.trim()
}

const getDigitsCount = (value: string) => value.replace(/\D/g, '').length

export default function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues & { acceptPolicy: boolean }>({
    defaultValues: {
      role: UserRole.STUDENT,
      phone: '',
      class_letter: '',
    },
  })
  const [isUsernameEdited, setIsUsernameEdited] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const fullNameValue = watch('full_name')
  const schoolValue = watch('school_name')
  const classLetterValue = watch('class_letter')
  const classNumberValue = watch('class_number')

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: () => {
      navigate('/login', { 
        state: { message: 'Регистрация успешна! Войдите в систему.' }
      })
    },
    onError: (error: any) => {
      console.error('Registration error:', error)
    },
  })

  const onSubmit = (data: RegisterFormValues) => {
    if (!data.gender || !data.date_of_birth || !data.school_name || !data.class_number || !data.class_letter) {
      return
    }

    const payload: RegisterRequest = {
      ...data,
      gender: data.gender,
      date_of_birth: data.date_of_birth,
      school_name: data.school_name,
      class_number: data.class_number,
      class_letter: data.class_letter,
    }

    registerMutation.mutate(payload)
  }

  useEffect(() => {
    if (!fullNameValue) {
      if (!isUsernameEdited) {
        setValue('username', '', { shouldValidate: true })
      }
      return
    }

    if (isUsernameEdited) {
      return
    }

    const suggestion = buildUsernameFromFullName(fullNameValue)
    if (suggestion) {
      setValue('username', suggestion, { shouldValidate: true })
    }
  }, [fullNameValue, isUsernameEdited, setValue])

  const selectedSchool = useMemo(
    () => SCHOOL_OPTIONS.find((school) => school.value === schoolValue),
    [schoolValue]
  )

  const availableClasses = useMemo(() => {
    if (!selectedSchool) {
      return []
    }
    return Array.from(
      { length: selectedSchool.maxClass - selectedSchool.minClass + 1 },
      (_, index) => selectedSchool.minClass + index
    )
  }, [selectedSchool])

  useEffect(() => {
    if (!selectedSchool) {
      if (classLetterValue) {
        setValue('class_letter', '', { shouldValidate: true })
      }
      if (typeof classNumberValue === 'number') {
        setValue('class_number', undefined, { shouldValidate: true })
      }
      return
    }

    if (classLetterValue !== selectedSchool.letter) {
      setValue('class_letter', selectedSchool.letter, { shouldValidate: true })
    }

    if (
      typeof classNumberValue === 'number' &&
      (classNumberValue < selectedSchool.minClass || classNumberValue > selectedSchool.maxClass)
    ) {
      setValue('class_number', undefined, { shouldValidate: true })
    }
  }, [selectedSchool, classLetterValue, classNumberValue, setValue])

  const handleNextStep = async () => {
    const step = FORM_STEPS[currentStep - 1]
    if (!step) return

    const isValid = await trigger(step.fields)
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, FORM_STEPS.length))
    }
  }

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const isLastStep = currentStep === FORM_STEPS.length

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="card space-y-8">
          <div className="space-y-3">
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Создать аккаунт
            </h2>
            <p className="text-center text-sm text-gray-500">
              Заполните данные ученика и родителя по шагам
            </p>
            <div className="flex items-center gap-2">
              {FORM_STEPS.map((step) => (
                <div key={step.id} className="flex-1">
                  <div
                    className={`h-2 rounded-full ${
                      step.id <= currentStep ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  />
                  <p
                    className={`mt-1 text-xs font-medium ${
                      step.id === currentStep ? 'text-primary-600' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="full_name" className="label">
                    Полное имя
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    {...register('full_name', { required: 'Введите полное имя' })}
                    className="input"
                    placeholder="Например, Шавков Дмитрий Вячеславович"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="username" className="label">
                    Имя пользователя
                  </label>
                  <input
                    id="username"
                    type="text"
                    {...register('username', {
                      required: 'Введите имя пользователя',
                      minLength: { value: 3, message: 'Минимум 3 символа' },
                      maxLength: { value: 32, message: 'Максимум 32 символа' },
                      onChange: () => setIsUsernameEdited(true),
                    })}
                    className="input"
                    placeholder="Будет предложено автоматически"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    {...register('email', {
                      required: 'Введите email',
                      pattern: { value: /^\S+@\S+$/i, message: 'Неверный формат email' },
                    })}
                    className="input"
                    placeholder="name@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="label">
                    Пароль
                  </label>
                  <input
                    id="password"
                    type="password"
                    {...register('password', {
                      required: 'Введите пароль',
                      minLength: { value: 6, message: 'Минимум 6 символов' },
                    })}
                    className="input"
                    placeholder="Минимум 6 символов"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="gender" className="label">
                    Пол ученика
                  </label>
                  <select
                    id="gender"
                    className="input"
                    {...register('gender', { required: 'Выберите пол ученика' })}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Выберите из списка
                    </option>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="date_of_birth" className="label">
                    Дата рождения
                  </label>
                  <input
                    id="date_of_birth"
                    type="date"
                    className="input"
                    {...register('date_of_birth', { required: 'Укажите дату рождения' })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {errors.date_of_birth && (
                    <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="school_name" className="label">
                    Школа
                  </label>
                  <select
                    id="school_name"
                    className="input"
                    {...register('school_name', { required: 'Выберите школу' })}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Выберите школу
                    </option>
                    {SCHOOL_OPTIONS.map((school) => (
                      <option key={school.value} value={school.value}>
                        {school.label}
                      </option>
                    ))}
                  </select>
                  {errors.school_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.school_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="class_number" className="label">
                    Класс
                  </label>
                  <select
                    id="class_number"
                    className="input"
                    disabled={!selectedSchool}
                    {...register('class_number', {
                      required: 'Выберите класс',
                      setValueAs: (value: string) => (value === '' ? undefined : Number(value)),
                      validate: (value) => {
                        if (!selectedSchool) {
                          return 'Сначала выберите школу'
                        }
                        if (!value) {
                          return 'Выберите класс'
                        }
                        if (value < selectedSchool.minClass || value > selectedSchool.maxClass) {
                          return `Доступны классы с ${selectedSchool.minClass} по ${selectedSchool.maxClass}`
                        }
                        return true
                      },
                    })}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {selectedSchool ? 'Выберите класс' : 'Сначала выберите школу'}
                    </option>
                    {availableClasses.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                  {errors.class_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.class_number.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="class_letter" className="label">
                    Буква класса
                  </label>
                  <input
                    id="class_letter"
                    type="text"
                    readOnly
                    {...register('class_letter', { required: 'Выберите школу' })}
                    className="input bg-gray-50"
                    placeholder="Появится после выбора школы"
                  />
                  {errors.class_letter && (
                    <p className="mt-1 text-sm text-red-600">{errors.class_letter.message}</p>
                  )}
                  {selectedSchool && (
                    <p className="mt-2 text-sm text-gray-500">
                      Для школы {selectedSchool.label} используется буква «{selectedSchool.letter}».
                    </p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="phone" className="label">
                    Телефон родителя
                  </label>
                  <Controller
                    name="phone"
                    control={control}
                    rules={{
                      required: 'Укажите номер родителя',
                      validate: (value) =>
                        value && getDigitsCount(value) === 11 ? true : 'Заполните номер полностью',
                    }}
                    render={({ field }) => (
                      <input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        className="input"
                        placeholder="+7 (___) ___-__-__"
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(formatParentPhone(event.target.value))}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    )}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Используется для связи с родителем. Формат автоматически приводится к единому виду.
                  </p>
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>
              </div>
            )}

            <input type="hidden" value={UserRole.STUDENT} {...register('role')} />

          <div className="space-y-3">
            <label className="inline-flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                {...register('acceptPolicy', { required: 'Необходимо согласие на обработку данных' })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                Согласен(на) с политикой обработки персональных данных (152-ФЗ) и подтверждаю передачу данных для регистрации.
              </span>
            </label>
            {errors.acceptPolicy && (
              <p className="text-sm text-red-600">{errors.acceptPolicy.message}</p>
            )}
          </div>

            {registerMutation.isError && (
              <div className="text-sm text-red-600 text-center">
                {registerMutation.error?.response?.data?.detail ||
                  registerMutation.error?.message ||
                  'Ошибка регистрации. Попробуйте еще раз.'}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary w-full sm:w-auto"
                  onClick={handlePreviousStep}
                  disabled={registerMutation.isPending}
                >
                  Назад
                </button>
              )}

              {!isLastStep && (
                <button
                  type="button"
                  className="btn btn-primary w-full sm:w-auto sm:ml-auto"
                  onClick={handleNextStep}
                >
                  Далее
                </button>
              )}

              {isLastStep && (
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="btn btn-primary w-full sm:w-auto sm:ml-auto"
                >
                  {registerMutation.isPending ? 'Создание аккаунта...' : 'Зарегистрироваться'}
                </button>
              )}
            </div>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700">
                Уже есть аккаунт? Войти
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

