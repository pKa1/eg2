import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { userService } from '@/services/userService'
import { User, UserRole } from '@/types'
import { Plus, Edit, Trash2, X } from 'lucide-react'

export default function AdminUsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const queryClient = useQueryClient()

  const [filterRole, setFilterRole] = useState<UserRole | ''>('')
  const [filterUnverified, setFilterUnverified] = useState<boolean>(false)
  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ['users', filterRole, filterUnverified],
    queryFn: () => userService.getUsers(filterRole || undefined, filterUnverified ? false : undefined),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsModalOpen(false)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsModalOpen(false)
      setEditingUser(null)
      reset()
    },
  })

  const onSubmit = (data: any) => {
    if (editingUser) {
      const payload: Partial<User> = {
        full_name: data.full_name,
        username: data.username,
        email: data.email,
        role: data.role,
        phone: data.phone,
        // password optional: send only if filled
      } as any
    
      if (data.password) {
        (payload as any).password = data.password
      }
      updateMutation.mutate({ id: editingUser.id, data: payload })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Загрузка пользователей...</div>
  }

  if (isError) {
    const message = (error as any)?.response?.data?.detail || 'Failed to load users. Make sure you are logged in as admin.'
    return (
      <div className="card p-6 text-center">
        <p className="text-red-600">{message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Управление пользователями</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={20} />
          <span>Добавить пользователя</span>
        </button>
      </div>

      <div className="card">
        <div className="grid gap-4 md:grid-cols-3 items-end">
          <div>
            <label className="label">Роль</label>
            <select className="input" value={filterRole} onChange={(e) => setFilterRole((e.target.value || '') as any)}>
              <option value="">Все</option>
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.TEACHER}>Teacher</option>
              <option value={UserRole.STUDENT}>Student</option>
              <option value={UserRole.PARENT}>Parent</option>
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="rounded" checked={filterUnverified} onChange={(e) => setFilterUnverified(e.target.checked)} />
              <span>Только неподтверждённые</span>
            </label>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Имя
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Роль
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users?.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                  <div className="text-sm text-gray-500">@{user.username}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 capitalize">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.is_verified ? 'Подтверждён' : 'Не подтверждён'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {!user.is_verified && (
                    <button
                      onClick={() => updateMutation.mutate({ id: user.id, data: { is_verified: true } as any })}
                      className="text-green-600 hover:text-green-900 mr-4"
                      title="Approve"
                    >
                      Подтвердить
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingUser(user)
                      setIsModalOpen(true)
                      setValue('full_name', user.full_name)
                      setValue('username', user.username)
                      setValue('email', user.email)
                      setValue('role', user.role)
                      setValue('phone', (user as any).phone || '')
                    }}
                    className="text-primary-600 hover:text-primary-900"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900 ml-4"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingUser ? 'Редактировать пользователя' : 'Создать пользователя'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingUser(null); }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Полное имя</label>
                <input
                  {...register('full_name', { required: true })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Имя пользователя</label>
                <input
                  {...register('username', { required: true })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  {...register('email', { required: true })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Пароль</label>
                <input
                  type="password"
                  {...register('password')}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Роль</label>
                <select {...register('role', { required: true })} className="input">
                  <option value={UserRole.TEACHER}>Преподаватель</option>
                  <option value={UserRole.STUDENT}>Ученик</option>
                  <option value={UserRole.PARENT}>Родитель</option>
                  <option value={UserRole.ADMIN}>Админ</option>
                </select>
              </div>

              <div>
                <label className="label">Телефон (опционально)</label>
                <input {...register('phone')} className="input" />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-6">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingUser(null) }}
                  className="btn btn-secondary w-full sm:w-auto"
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto">
                  {editingUser ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

