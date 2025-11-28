import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { groupService, Group } from '@/services/groupService'
import { userService } from '@/services/userService'
import { UserRole } from '@/types'
import { Plus, Edit, Trash2, X, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function GroupsPage() {
  const qc = useQueryClient()
  const { data: groups, isLoading } = useQuery({ queryKey: ['groups'], queryFn: groupService.list })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [form, setForm] = useState<{ name: string; description?: string }>({ name: '', description: '' })

  useEffect(() => {
    if (editing) setForm({ name: editing.name, description: editing.description })
    else setForm({ name: '', description: '' })
  }, [editing])

  const createMutation = useMutation({
    mutationFn: () => groupService.create({ name: form.name.trim(), description: form.description?.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setIsModalOpen(false)
      setEditing(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => groupService.update(editing!.id, { name: form.name.trim(), description: form.description?.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setIsModalOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => groupService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })

  // Members management modal
  const [membersOpen, setMembersOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const { data: members } = useQuery({
    queryKey: ['group-members', selectedGroup?.id],
    queryFn: () => groupService.listMembers(selectedGroup!.id),
    enabled: !!selectedGroup?.id && membersOpen,
  })
  const { data: students } = useQuery({
    queryKey: ['students-verified'],
    queryFn: () => userService.getVerifiedStudents(),
    enabled: membersOpen,
  })
  const [studentSearch, setStudentSearch] = useState('')
  const addMemberMutation = useMutation({
    mutationFn: (studentId: number) => groupService.addMember(selectedGroup!.id, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', selectedGroup?.id] })
      setStudentSearch('')
    },
  })
  const removeMemberMutation = useMutation({
    mutationFn: (studentId: number) => groupService.removeMember(selectedGroup!.id, studentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-members', selectedGroup?.id] }),
  })
  const studentMap = useMemo(() => {
    const map: Record<number, { label: string }> = {}
    ;(students || []).forEach((u) => {
      map[u.id] = { label: `${u.full_name} (@${u.username})` }
    })
    return map
  }, [students])

  const memberIds = useMemo(() => new Set(members?.map((m) => m.student_id) || []), [members])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Группы</h1>
        <button
          className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          onClick={() => { setEditing(null); setIsModalOpen(true) }}
        >
          <Plus size={18} />
          <span>Создать группу</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Загрузка...</div>
      ) : !groups || groups.length === 0 ? (
        <div className="card text-center py-12">Пока нет групп</div>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => (
            <div key={g.id} className="card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">{g.name}</h3>
                  {g.description && <p className="text-gray-600 mt-1 break-words">{g.description}</p>}
                  <p className="text-xs text-gray-500 mt-2">ID: {g.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="p-2 text-gray-700 hover:bg-gray-100 rounded"
                    onClick={() => { setSelectedGroup(g); setMembersOpen(true) }}
                    title="Участники"
                  >
                    <Users size={18} />
                  </button>
                  <Link
                    to={`/teacher/groups/${g.id}`}
                    className="px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded"
                  >
                    Управление
                  </Link>
                  <Link
                    to={`/teacher/groups/${g.id}/analytics`}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Аналитика"
                  >
                    📊
                  </Link>
                  <button className="p-2 text-primary-600 hover:bg-primary-50 rounded" onClick={() => { setEditing(g); setIsModalOpen(true) }} title="Редактировать">
                    <Edit size={18} />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded" onClick={() => { if (confirm('Удалить группу?')) deleteMutation.mutate(g.id) }} title="Удалить">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{editing ? 'Редактировать группу' : 'Создать группу'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditing(null) }}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Название</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Описание</label>
                <textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button className="btn btn-secondary w-full sm:w-auto" onClick={() => { setIsModalOpen(false); setEditing(null) }}>Отмена</button>
              <button
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
                disabled={(editing ? updateMutation.isPending : createMutation.isPending) || !form.name.trim()}
              >
                {editing ? (updateMutation.isPending ? 'Сохранение...' : 'Сохранить') : (createMutation.isPending ? 'Создание...' : 'Создать')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {membersOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Участники группы: {selectedGroup.name}</h2>
              <button onClick={() => { setMembersOpen(false); setSelectedGroup(null); setStudentSearch('') }}><X size={18} /></button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-medium mb-3">Добавить ученика</h3>
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
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
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
                                {already ? 'Уже в группе' : addMemberMutation.isPending ? 'Добавление...' : 'Добавить'}
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium mb-2">Состав группы</h3>
                {!members ? (
                  <div className="text-gray-600">Загрузка...</div>
                ) : members.length === 0 ? (
                  <div className="text-gray-600">Пока нет участников</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                        <div className="text-sm">
                          <div className="font-medium">{studentMap[m.student_id]?.label || `ID ${m.student_id}`}</div>
                          <div className="text-xs text-gray-500">Добавлен: {new Date(m.created_at).toLocaleString('ru-RU')}</div>
                        </div>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded" onClick={() => removeMemberMutation.mutate(m.student_id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 text-right">
              <button className="btn btn-secondary" onClick={() => { setMembersOpen(false); setSelectedGroup(null); setStudentSearch('') }}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


