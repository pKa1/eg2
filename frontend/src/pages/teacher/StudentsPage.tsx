import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { userService } from '@/services/userService'
import { Users, Search } from 'lucide-react'

export default function TeacherStudentsPage() {
  const { data: students, isLoading } = useQuery({
    queryKey: ['teacher-students'],
    queryFn: () => userService.getStudents(),
  })

  const [search, setSearch] = useState('')
  const [showOnlyVerified, setShowOnlyVerified] = useState(false)

  const filtered = useMemo(() => {
    if (!students) return []
    return students.filter((student) => {
      if (showOnlyVerified && !student.is_verified) return false
      const query = search.trim().toLowerCase()
      if (!query) return true
      return (
        student.full_name.toLowerCase().includes(query) ||
        student.username.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      )
    })
  }, [students, search, showOnlyVerified])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ученики</h1>
          <p className="text-gray-500">Все подтверждённые аккаунты учащихся</p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" className="rounded" checked={showOnlyVerified} onChange={(e) => setShowOnlyVerified(e.target.checked)} />
            Только подтверждённые
          </label>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Поиск по имени, логину или email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">Загрузка списка учеников...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Ученики не найдены</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((student) => (
              <Link
                to={`/teacher/students/${student.id}`}
                key={student.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-primary-200 transition-colors flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
                    {student.full_name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{student.full_name}</p>
                    <p className="text-sm text-gray-500">@{student.username}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Email: {student.email}</p>
                  {student.phone && <p>Телефон: {student.phone}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full font-semibold ${student.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {student.is_verified ? 'Подтверждён' : 'Не подтверждён'}
                  </span>
                  <span className={`px-2 py-1 rounded-full font-semibold ${student.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    {student.is_active ? 'Активен' : 'Заблокирован'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Последний вход: {student.last_login ? new Date(student.last_login).toLocaleString('ru-RU') : 'Никогда'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


