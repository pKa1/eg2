import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

export default function GroupAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const [testId, setTestId] = useState<number | ''>('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['group-analytics', id, testId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (testId) params.append('test_id', String(testId))
      const res = await api.get(`/groups/${id}/analytics${params.toString() ? `?${params.toString()}` : ''}`)
      return res.data as { count: number; avg_score: number; pass_rate: number; test_title?: string | null }
    },
    enabled: !!id,
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/teacher/groups"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} />
        <span>Назад к группам</span>
      </Link>

      <div className="card space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Аналитика группы</h1>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label">Фильтр по тесту (ID)</label>
            <input className="input" type="number" value={testId} onChange={(e) => setTestId(e.target.value ? Number(e.target.value) : '')} placeholder="Например: 7" />
          </div>
          <div className="flex items-end">
            <button className="btn btn-secondary w-full sm:w-auto" onClick={() => refetch()}>Обновить</button>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-12">Загрузка аналитики...</div>
        ) : !data ? (
          <div className="text-center py-12 text-gray-600">Нет данных</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-gray-500">Работ сдано</p>
              <p className="text-2xl font-bold">{data.count}</p>
            </div>
            <div>
              <p className="text-gray-500">Средняя оценка</p>
              <p className="text-2xl font-bold">{data.avg_score.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-gray-500">Доля зачёта</p>
              <p className="text-2xl font-bold">{data.pass_rate.toFixed(1)}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


