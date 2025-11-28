import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { authService } from '@/services/authService'
import { RegisterRequest, UserRole } from '@/types'

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

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterRequest>({
    defaultValues: {
      role: UserRole.STUDENT,
    },
  })
  const [isUsernameEdited, setIsUsernameEdited] = useState(false)
  const fullNameValue = watch('full_name')

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

  const onSubmit = (data: RegisterRequest) => {
    registerMutation.mutate(data)
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="card space-y-6">
          <div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Создать аккаунт
            </h2>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
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
                  pattern: { value: /^\S+@\S+$/i, message: 'Неверный формат email' }
                })}
                className="input"
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
                  minLength: { value: 6, message: 'Минимум 6 символов' }
                })}
                className="input"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Телефон (необязательно)
              </label>
              <input
                id="phone"
                type="tel"
                {...register('phone')}
                className="input"
              />
            </div>
          </div>

          <input type="hidden" value={UserRole.STUDENT} {...register('role')} />

          {registerMutation.isError && (
            <div className="text-sm text-red-600 text-center">
              {registerMutation.error?.response?.data?.detail || 
               registerMutation.error?.message || 
               'Ошибка регистрации. Попробуйте еще раз.'}
            </div>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full btn btn-primary"
          >
            {registerMutation.isPending ? 'Создание аккаунта...' : 'Зарегистрироваться'}
          </button>

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

