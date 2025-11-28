import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'
import { LoginRequest } from '@/types'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>()
  const [successMessage, setSuccessMessage] = useState<string>('')

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message)
      // Clear the message from location state
      window.history.replaceState({}, document.title)
    }
  }, [location])

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async () => {
      const user = await authService.getCurrentUser()
      setUser(user)
      navigate('/')
    },
  })

  const onSubmit = (data: LoginRequest) => {
    loginMutation.mutate(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="card space-y-6">
          <div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Вход в платформу тестирования
            </h2>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
            <div>
              <label htmlFor="username" className="label">
                Email или имя пользователя
              </label>
              <input
                id="username"
                type="text"
                {...register('username', { required: 'Введите email или имя пользователя' })}
                className="input"
                placeholder="student@demo.com или demo_student"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                {...register('password', { required: 'Введите пароль' })}
                className="input"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          {successMessage && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded text-center">
              {successMessage}
            </div>
          )}

          {loginMutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded text-center">
              {(() => {
                const detail = (loginMutation as any).error?.response?.data?.detail as string | undefined
                if (detail && /не подтвержден/i.test(detail)) {
                  return 'Ваш аккаунт пока не подтвержден администратором. Пожалуйста, свяжитесь с преподавателем или администратором.'
                }
                return detail || (loginMutation as any).error?.message || 'Неверное имя пользователя или пароль'
              })()}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full btn btn-primary"
          >
            {loginMutation.isPending ? 'Вход...' : 'Войти'}
          </button>

          <div className="text-center">
            <Link to="/register" className="text-sm text-primary-600 hover:text-primary-700">
              Нет аккаунта? Зарегистрироваться
            </Link>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

