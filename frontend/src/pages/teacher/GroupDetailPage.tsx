import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { groupService } from '@/services/groupService'
import { userService } from '@/services/userService'
import { ArrowLeft, Users, Edit3, Trash2 } from 'lucide-react'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const groupId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: group, isLoading: isGroupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupService.get(groupId),
    enabled: Number.isFinite(groupId),
  })

  const { data: members } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => groupService.listMembers(groupId),
    enabled: Number.isFinite(groupId),
  })

  const { data: students } = useQuery({
    queryKey: ['students-verified'],
    queryFn: () => userService.getVerifiedStudents(),
  })

  const [form, setForm] = useState({ name: '', description: '' })
  useEffect(() => {
    if (group) {
      setForm({ name: group.name, description: group.description || '' })
    }
  }, [group])

  const updateMutation = useMutation({
    mutationFn: () => groupService.update(groupId, { name: form.name.trim(), description: form.description.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => groupService.remove(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      navigate('/teacher/groups')
    },
  })

  const memberIds = useMemo(() => new Set(members?.map((m) => m.student_id) || []), [members])

  const [studentSearch, setStudentSearch] = useState('')
  const addMemberMutation = useMutation({
    mutationFn: (studentId: number) => groupService.addMember(groupId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
  })
  const removeMemberMutation = useMutation({
    mutationFn: (studentId: number) => groupService.removeMember(groupId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
  })

  const studentMap = useMemo(() => {
    const map: Record<number, { label: string }> = {}
    ;(students || []).forEach((s) => {
      map[s.id] = { label: `${s.full_name} (@${s.username})` }
    })
    return map
  }, [students])

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

  if (!groupId || isNaN(groupId)) {
    return <div className="text-center py-12">Некорректный идентификатор группы</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link to="/teacher/groups" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} />
        <span>Назад к списку групп</span>
      </Link>

      <div className="card">
        {isGroupLoading || !group ? (
          <div className="text-center py-8 text-gray-500">Загрузка данных группы...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
                {group.description && <p className="text-gray-600 mt-1">{group.description}</p>}
                <p className="text-sm text-gray-400 mt-1">Создана: {new Date(group.created_at).toLocaleString('ru-RU')}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !form.name.trim()}
                >
                  <Edit3 size={18} />
                  <span>{updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </button>
                <button
                  className="btn btn-secondary flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50 w-full sm:w-auto"
                  onClick={() => {
                    if (window.confirm('Удалить эту группу?')) deleteMutation.mutate()
                  }}
                >
                  <Trash2 size={18} />
                  <span>Удалить</span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Название</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Описание</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <Users size={18} />
                {members?.length || 0} участников
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Добавить ученика</h2>
          {!students ? (
            <div className="text-gray-600">Загрузка списка учеников...</div>
          ) : students.length === 0 ? (
            <div className="text-gray-600">Нет подтверждённых учеников</div>
          ) : (
            <div className="space-y-3">
              <input
                className="input w-full"
                placeholder="Поиск по имени, логину или email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {filteredStudents.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">Ничего не найдено</div>
                ) : (
                  filteredStudents.map((s) => {
                    const already = memberIds.has(s.id)
                    return (
                      <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{s.full_name}</p>
                          <p className="text-xs text-gray-500">@{s.username} · {s.email}</p>
                        </div>
                        <button
                          className="btn btn-primary text-sm"
                          onClick={() => addMemberMutation.mutate(s.id)}
                          disabled={already || addMemberMutation.isPending}
                        >
                          {already ? 'Уже в группе' : 'Добавить'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Состав группы</h2>
          {!members ? (
            <div className="text-gray-600">Загрузка...</div>
          ) : members.length === 0 ? (
            <div className="text-gray-600">Пока нет участников</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{studentMap[m.student_id]?.label || `ID ${m.student_id}`}</p>
                    <p className="text-xs text-gray-500">Добавлен: {new Date(m.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                  <button
                    className="btn btn-secondary text-sm"
                    onClick={() => removeMemberMutation.mutate(m.student_id)}
                  >
                    Удалить
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


