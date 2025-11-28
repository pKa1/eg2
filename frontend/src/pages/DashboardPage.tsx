import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { UserRole } from '@/types'
import { FileText, ClipboardList, Users, BarChart } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const getDashboardCards = () => {
    if (!user) return []

    if (user.role === UserRole.TEACHER || user.role === UserRole.ADMIN) {
      return [
        {
          title: 'Мои тесты',
          description: 'Создание и управление тестами',
          icon: FileText,
          action: () => navigate('/teacher/tests'),
          color: 'bg-blue-500',
        },
        {
          title: 'Создать новый тест',
          description: 'Создайте новый тест',
          icon: ClipboardList,
          action: () => navigate('/teacher/tests/create'),
          color: 'bg-green-500',
        },
      ]
    }

    if (user.role === UserRole.STUDENT) {
      return [
        {
          title: 'Мои тесты',
          description: 'Просмотр назначенных тестов',
          icon: ClipboardList,
          action: () => navigate('/student/tests'),
          color: 'bg-blue-500',
        },
        {
          title: 'Результаты',
          description: 'Просмотр результатов тестов',
          icon: BarChart,
          action: () => navigate('/student/results'),
          color: 'bg-green-500',
        },
      ]
    }

    if (user.role === UserRole.PARENT) {
      return [
        {
          title: 'Дети',
          description: 'Просмотр прогресса детей',
          icon: Users,
          action: () => navigate('/parent/dashboard'),
          color: 'bg-purple-500',
        },
      ]
    }

    return []
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Добро пожаловать, {user?.full_name}!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getDashboardCards().map((card, index) => {
          const Icon = card.icon
          return (
            <button
              key={index}
              onClick={card.action}
              className="card hover:shadow-lg transition-shadow text-left"
            >
              <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {card.title}
              </h3>
              <p className="text-gray-600">{card.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

