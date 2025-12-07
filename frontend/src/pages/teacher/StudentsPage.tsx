import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { userService } from '@/services/userService'
import { Users, Search, Filter, RefreshCcw, Download } from 'lucide-react'
import { utils, writeFile } from 'xlsx'
import { StudentGender } from '@/types'

type FilterState = {
  verification: 'all' | 'verified' | 'unverified'
  status: 'all' | 'active' | 'inactive'
  gender: 'all' | StudentGender
  school: 'all' | string
  classNumber: 'all' | string
  hasPhone: boolean
}

export default function TeacherStudentsPage() {
  const { data: students, isLoading } = useQuery({
    queryKey: ['teacher-students'],
    queryFn: () => userService.getStudents(),
  })

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    verification: 'all',
    status: 'all',
    gender: 'all',
    school: 'all',
    classNumber: 'all',
    hasPhone: false,
  })

  const stats = useMemo(() => {
    if (!students || students.length === 0) {
      return { total: 0, verified: 0, unverified: 0, active: 0, inactive: 0 }
    }
    return students.reduce(
      (acc, student) => {
        acc.total += 1
        if (student.is_verified) acc.verified += 1
        else acc.unverified += 1
        if (student.is_active) acc.active += 1
        else acc.inactive += 1
        return acc
      },
      { total: 0, verified: 0, unverified: 0, active: 0, inactive: 0 }
    )
  }, [students])

  const schoolOptions = useMemo(() => {
    if (!students) return []
    const set = new Set<string>()
    students.forEach((student) => {
      if (student.school_name) {
        set.add(student.school_name)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [students])

  const classOptions = useMemo(() => {
    if (!students) return []
    const set = new Set<number>()
    students.forEach((student) => {
      if (student.class_number) {
        set.add(student.class_number)
      }
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [students])

  const handleSelectChange = (name: keyof FilterState) => (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({
      ...prev,
      hasPhone: event.target.checked,
    }))
  }

  const resetFilters = () => {
    setFilters({
      verification: 'all',
      status: 'all',
      gender: 'all',
      school: 'all',
      classNumber: 'all',
      hasPhone: false,
    })
    setSearch('')
  }

  const handleExport = () => {
    if (!filtered.length) return
    const rows = filtered.map((student, index) => ({
      '№': index + 1,
      'ФИО': student.full_name,
      'Логин': student.username,
      'Email': student.email,
      'Телефон': student.phone || '',
      'Пол':
        student.gender === StudentGender.MALE
          ? 'Мужской'
          : student.gender === StudentGender.FEMALE
            ? 'Женский'
            : '',
      'Дата рождения': student.date_of_birth
        ? new Date(student.date_of_birth).toLocaleDateString('ru-RU')
        : '',
      'Школа': student.school_name || '',
      'Класс': student.class_number
        ? `${student.class_number}${student.class_letter ? ` ${student.class_letter}` : ''}`
        : '',
      'Подтверждён': student.is_verified ? 'Да' : 'Нет',
      'Активен': student.is_active ? 'Да' : 'Нет',
      'Дата регистрации': new Date(student.created_at).toLocaleDateString('ru-RU'),
      'Последний вход': student.last_login
        ? new Date(student.last_login).toLocaleString('ru-RU')
        : '',
    }))

    const worksheet = utils.json_to_sheet(rows)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Ученики')
    writeFile(workbook, `students-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const filtered = useMemo(() => {
    if (!students) return []
    return students.filter((student) => {
      const query = search.trim().toLowerCase()
      if (query) {
        const haystack = [
          student.full_name,
          student.username,
          student.email,
          student.phone,
          student.school_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }

      if (filters.verification === 'verified' && !student.is_verified) return false
      if (filters.verification === 'unverified' && student.is_verified) return false
      if (filters.status === 'active' && !student.is_active) return false
      if (filters.status === 'inactive' && student.is_active) return false
      if (filters.gender !== 'all' && student.gender !== filters.gender) return false
      if (filters.school !== 'all' && student.school_name !== filters.school) return false
      if (
        filters.classNumber !== 'all' &&
        student.class_number !== Number(filters.classNumber)
      ) {
        return false
      }
      if (filters.hasPhone && !student.phone) return false
      return true
    })
  }, [students, search, filters])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ученики</h1>
          <p className="text-gray-500">Вся база учеников с быстрым поиском и фильтрами</p>
        </div>
        <div className="flex flex-col text-sm text-gray-500">
          <span className="font-medium text-gray-700">{stats.total} всего</span>
          <span>
            {stats.verified} подтверждены · {stats.active} активны
          </span>
        </div>
      </div>

      <div className="card space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Поиск по имени, логину, email, школе или телефону"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn btn-secondary flex items-center justify-center gap-2"
              onClick={resetFilters}
            >
              <RefreshCcw size={16} />
              Сбросить
            </button>
            <button
              type="button"
              className="btn btn-primary flex items-center justify-center gap-2"
              onClick={handleExport}
              disabled={!filtered.length}
            >
              <Download size={16} />
              Экспорт в Excel
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Filter size={16} />
          <span>Отбор по любым параметрам ученика</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label text-sm">Подтверждение</label>
            <select
              className="input"
              value={filters.verification}
              onChange={handleSelectChange('verification')}
            >
              <option value="all">Все</option>
              <option value="verified">Только подтверждённые</option>
              <option value="unverified">Без подтверждения</option>
            </select>
          </div>
          <div>
            <label className="label text-sm">Статус</label>
            <select
              className="input"
              value={filters.status}
              onChange={handleSelectChange('status')}
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Заблокированные</option>
            </select>
          </div>
          <div>
            <label className="label text-sm">Пол</label>
            <select
              className="input"
              value={filters.gender}
              onChange={handleSelectChange('gender')}
            >
              <option value="all">Любой</option>
              <option value={StudentGender.MALE}>Мужской</option>
              <option value={StudentGender.FEMALE}>Женский</option>
            </select>
          </div>
          <div>
            <label className="label text-sm">Школа</label>
            <select
              className="input"
              value={filters.school}
              onChange={handleSelectChange('school')}
            >
              <option value="all">Все школы</option>
              {schoolOptions.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-sm">Класс</label>
            <select
              className="input"
              value={filters.classNumber}
              onChange={handleSelectChange('classNumber')}
            >
              <option value="all">Все классы</option>
              {classOptions.map((grade) => (
                <option key={grade} value={String(grade)}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <label className="label text-sm flex items-center gap-3">
            <input
              type="checkbox"
              className="rounded"
              checked={filters.hasPhone}
              onChange={handleCheckboxChange}
            />
            Только с телефоном родителя
          </label>
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
                  <p>
                    Телефон:{' '}
                    {student.phone ? (
                      <span className="font-medium">{student.phone}</span>
                    ) : (
                      <span className="text-gray-400">не указан</span>
                    )}
                  </p>
                  <p>
                    Школа:{' '}
                    {student.school_name ? (
                      <span className="font-medium">{student.school_name}</span>
                    ) : (
                      <span className="text-gray-400">не указана</span>
                    )}
                  </p>
                  <p>
                    Класс:{' '}
                    {student.class_number ? (
                      <span className="font-medium">
                        {student.class_number}
                        {student.class_letter ? ` «${student.class_letter}»` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">не указан</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full font-semibold ${student.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {student.is_verified ? 'Подтверждён' : 'Не подтверждён'}
                  </span>
                  <span className={`px-2 py-1 rounded-full font-semibold ${student.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    {student.is_active ? 'Активен' : 'Заблокирован'}
                  </span>
                </div>
                <div className="flex flex-col text-xs text-gray-400 gap-1">
                  <span>
                    Последний вход:{' '}
                    {student.last_login ? new Date(student.last_login).toLocaleString('ru-RU') : 'ещё не входил'}
                  </span>
                  {student.gender && (
                    <span>
                      Пол:{' '}
                      {student.gender === StudentGender.MALE ? 'Мужской' : 'Женский'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


