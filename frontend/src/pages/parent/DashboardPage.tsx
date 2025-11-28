import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { userService } from '@/services/userService'
import { resultService } from '@/services/resultService'
import { User } from 'lucide-react'

export default function ParentDashboardPage() {
  const { user } = useAuthStore()

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['parentChildren', user?.id],
    queryFn: () => userService.getParentChildren(user!.id),
    enabled: !!user,
  })

  if (loadingChildren) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Мои дети</h1>

      {children && children.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No children linked to your account yet.</p>
          <p className="text-sm text-gray-500 mt-2">
            Contact an administrator to link student accounts.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {children?.map((child) => (
            <div key={child.id} className="card">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="text-primary-600" size={24} />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1 break-words">
                    {child.full_name}
                  </h3>
                  <p className="text-gray-600 mb-4 break-words">{child.email}</p>
                  
                  {/* Could show recent test results here */}
                  <div className="text-sm text-gray-500">
                    <p>Детальные результаты будут добавлены позже.</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

