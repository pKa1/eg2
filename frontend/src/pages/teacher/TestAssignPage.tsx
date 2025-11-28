import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Users, BarChart, Trash2 } from 'lucide-react'

import { testService } from '@/services/testService'
import { groupService } from '@/services/groupService'
import { userService } from '@/services/userService'

export default function TestAssignPage() {
  const { id } = useParams<{ id: string }>()
  const testId = Number(id)
  const qc = useQueryClient()

  const { data: test, isLoading: isTestLoading } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => testService.getTest(testId),
    enabled: Number.isFinite(testId),
  })

  const { data: assignments } = useQuery({
    queryKey: ['testAssignments', testId],
    queryFn: () => testService.getTestAssignments(testId),
    enabled: Number.isFinite(testId),
  })

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupService.list })
  const { data: students } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => userService.getStudents(true),
  })

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [assignAllStudents, setAssignAllStudents] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [dueDate, setDueDate] = useState<string>('')

  const resetSelection = () => {
    setSelectedGroupIds([])
    setSelectedStudentIds([])
    setAssignAllStudents(false)
    setGroupSearch('')
    setStudentSearch('')
    setDueDate('')
  }

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]))
  }
  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]))
  }

  const filteredGroups = useMemo(() => {
    if (!groups) return []
    const query = groupSearch.trim().toLowerCase()
    if (!query) return groups
    return groups.filter((g) => {
      const name = g.name.toLowerCase()
      const description = (g.description || '').toLowerCase()
      return name.includes(query) || description.includes(query)
    })
  }, [groups, groupSearch])

  const filteredStudents = useMemo(() => {
    if (!students) return []
    const query = studentSearch.trim().toLowerCase()
    if (!query) return students
    return students.filter((s) => {
      const fullName = s.full_name?.toLowerCase() || ''
      const username = s.username?.toLowerCase() || ''
      const email = s.email?.toLowerCase() || ''
      return fullName.includes(query) || username.includes(query) || email.includes(query)
    })
  }, [students, studentSearch])

  const studentLookup = useMemo(() => {
    const map: Record<number, { label: string; email?: string }> = {}
    ;(students || []).forEach((s) => {
      map[s.id] = { label: `${s.full_name} (@${s.username})`, email: s.email }
    })
    return map
  }, [students])

  const assignMutation = useMutation({
    mutationFn: () =>
      testService.assignTestBulk(testId, {
        group_ids: selectedGroupIds,
        student_ids: selectedStudentIds,
        assign_all_students: assignAllStudents,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['testAssignments', testId] })
      alert(created.length ? `Назначено ${created.length} ученикам` : 'Все выбранные ученики уже имели доступ')
      resetSelection()
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Не удалось назначить тест')
    },
  })

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) => testService.deleteAssignment(assignmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['testAssignments', testId] }),
    onError: (err: any) => alert(err?.response?.data?.detail || 'Не удалось удалить назначение'),
  })

  if (!Number.isFinite(testId)) {
    return <div className="text-center py-12">Некорректный идентификатор теста</div>
  }

  if (isTestLoading || !test) {
    return <div className="text-center py-12">Загрузка теста...</div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to={`/teacher/tests/${id}`}
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={20} />
          <span>Назад к тесту</span>
        </Link>
        <Link
          to={`/teacher/tests/${id}/results`}
          className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <BarChart size={18} />
          <span>Результаты</span>
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">{test.title}</h1>
            {test.description && <p className="text-gray-600 mt-2">{test.description}</p>}
            <p className="text-xs text-gray-400 mt-2">
              Создан: {new Date(test.created_at).toLocaleString('ru-RU')} · Вопросов: {test.questions.length}
            </p>
          </div>
          <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-2 text-right">
            <p className="text-xs text-primary-700 uppercase">Назначений</p>
            <p className="text-2xl font-semibold text-primary-900">{assignments?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users size={20} />
              Настроить доступ
            </h2>
            {(selectedGroupIds.length > 0 || selectedStudentIds.length > 0 || assignAllStudents) && (
              <button className="text-sm text-primary-600" onClick={resetSelection}>
                Очистить выбор
              </button>
            )}
          </div>

          <label className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <input
              type="checkbox"
              className="rounded"
              checked={assignAllStudents}
              onChange={(e) => setAssignAllStudents(e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Назначить всем ученикам</p>
              <p className="text-xs text-gray-500">Будут выбраны все активные и подтверждённые ученики</p>
            </div>
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Группы</h3>
              <input
                className="input h-9 text-sm"
                placeholder="Поиск по названию"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
            {!groups ? (
              <div className="text-gray-500">Загрузка групп...</div>
            ) : groups.length === 0 ? (
              <div className="text-gray-500">У вас пока нет групп</div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-gray-500">Совпадений нет</div>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto divide-y">
                {filteredGroups.map((group) => (
                  <label key={group.id} className="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      {group.description && <p className="text-xs text-gray-500">{group.description}</p>}
                    </div>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedGroupIds.includes(group.id)}
                      onChange={() => toggleGroupSelection(group.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Ученики</h3>
              <div className="flex items-center gap-2 text-xs text-primary-600">
                <button onClick={() => setSelectedStudentIds(filteredStudents.map((s) => s.id))} disabled={!filteredStudents.length}>
                  Выбрать найденных
                </button>
                {selectedStudentIds.length > 0 && (
                  <button onClick={() => setSelectedStudentIds([])}>Очистить</button>
                )}
              </div>
            </div>
            {!students ? (
              <div className="text-gray-500">Загрузка списка учеников...</div>
            ) : students.length === 0 ? (
              <div className="text-gray-500">Подтверждённых учеников пока нет</div>
            ) : (
              <>
                <input
                  className="input w-full"
                  placeholder="Поиск по имени, логину или email"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto divide-y">
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Совпадений нет</div>
                  ) : (
                    filteredStudents.map((student) => (
                      <label key={student.id} className="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-semibold text-gray-900">{student.full_name}</p>
                          <p className="text-xs text-gray-500">@{student.username} · {student.email}</p>
                        </div>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                        />
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Дедлайн (опционально)</label>
              <input
                type="datetime-local"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="text-xs text-gray-500 flex items-end">
              Оставьте поле пустым, если не хотите ограничивать срок сдачи
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => assignMutation.mutate()}
              disabled={
                assignMutation.isPending ||
                (!assignAllStudents && selectedGroupIds.length === 0 && selectedStudentIds.length === 0)
              }
            >
              {assignMutation.isPending ? 'Назначение...' : 'Назначить тест'}
            </button>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Кто видит тест</h2>
            <p className="text-sm text-gray-500">{assignments?.length || 0} назначений</p>
          </div>

          {!assignments || assignments.length === 0 ? (
            <div className="text-gray-500">Назначений пока нет</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {studentLookup[assignment.student_id]?.label || `ID ${assignment.student_id}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      Дедлайн:{' '}
                      {assignment.due_date
                        ? new Date(assignment.due_date).toLocaleString('ru-RU')
                        : 'не задан'}
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


