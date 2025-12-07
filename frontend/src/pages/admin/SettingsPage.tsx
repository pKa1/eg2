import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { settingsService } from '@/services/settingsService'
import { GradeSettings } from '@/types'
import { useEffect } from 'react'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['gradeSettings'],
    queryFn: settingsService.getGradeSettings,
  })

  const { register, handleSubmit, reset } = useForm<GradeSettings>({
    defaultValues: { grade3_min: 33, grade4_min: 66, grade5_min: 85 },
  })

  useEffect(() => {
    if (data) {
      reset(data)
    }
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: (payload: GradeSettings) => settingsService.updateGradeSettings(payload),
    onSuccess: (updated) => {
      reset(updated)
      qc.invalidateQueries({ queryKey: ['gradeSettings'] })
      alert('Настройки оценивания сохранены')
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Не удалось сохранить настройки')
    },
  })

  const onSubmit = (values: GradeSettings) => {
    mutation.mutate(values)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки оценивания</h1>
        <p className="text-sm text-gray-600">Настройте, какой процент результата соответствует 3, 4 и 5.</p>
        {data && (
          <div className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <span className="font-medium text-gray-900">Текущие пороги:</span>{' '}
            3 — от {data.grade3_min}% · 4 — от {data.grade4_min}% · 5 — от {data.grade5_min}%
          </div>
        )}
      </div>

      <div className="card">
        {isLoading ? (
          <p>Загрузка...</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Оценка 3, от (%)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  className="input"
                  {...register('grade3_min', { valueAsNumber: true })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Оценка 4, от (%)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  className="input"
                  {...register('grade4_min', { valueAsNumber: true })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Оценка 5, от (%)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  className="input"
                  {...register('grade5_min', { valueAsNumber: true })}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">Пороги должны возрастать: 3 ≤ 4 ≤ 5.</p>
            <button type="submit" className="btn btn-primary" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}


