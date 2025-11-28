import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { UserRole } from '@/types'
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  LogOut, 
  ClipboardList,
  BarChart,
  Menu,
  X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isDesktop, setIsDesktop] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(isDesktop)
  const touchStartX = useRef<number | null>(null)
  const touchCurrentX = useRef<number | null>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getRoleLabel = (role: UserRole) => {
    const roleLabels = {
      [UserRole.ADMIN]: 'Администратор',
      [UserRole.TEACHER]: 'Преподаватель',
      [UserRole.STUDENT]: 'Ученик',
      [UserRole.PARENT]: 'Родитель',
    }
    return roleLabels[role] || role
  }

  const getNavigationLinks = () => {
    if (!user) return []

    const links = [
      { to: '/', label: 'Панель управления', icon: LayoutDashboard },
    ]

    if (user.role === UserRole.TEACHER || user.role === UserRole.ADMIN) {
      links.push(
        { to: '/teacher/tests', label: 'Мои тесты', icon: FileText },
        { to: '/teacher/groups', label: 'Группы', icon: Users },
        { to: '/teacher/students', label: 'Ученики', icon: Users },
      )
    }

    if (user.role === UserRole.STUDENT) {
      links.push(
        { to: '/student/tests', label: 'Мои тесты', icon: ClipboardList },
        { to: '/student/results', label: 'Результаты', icon: BarChart }
      )
    }

    if (user.role === UserRole.PARENT) {
      links.push({ to: '/parent/dashboard', label: 'Дети', icon: Users })
    }

    if (user.role === UserRole.ADMIN) {
      links.push({ to: '/admin/users', label: 'Управление пользователями', icon: Users })
    }

    return links
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const matches = 'matches' in event ? event.matches : event?.matches ?? mediaQuery.matches
      setIsDesktop(matches)
      setIsSidebarOpen(matches)
    }

    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (isDesktop) {
      document.body.classList.remove('overflow-hidden')
      return
    }
    if (isSidebarOpen) {
      document.body.classList.add('overflow-hidden')
    } else {
      document.body.classList.remove('overflow-hidden')
    }
    return () => document.body.classList.remove('overflow-hidden')
  }, [isSidebarOpen, isDesktop])

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktop) return
    touchStartX.current = event.touches[0].clientX
    touchCurrentX.current = event.touches[0].clientX
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktop) return
    touchCurrentX.current = event.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (isDesktop) return
    if (touchStartX.current === null || touchCurrentX.current === null) return

    const deltaX = touchCurrentX.current - touchStartX.current
    const swipeThreshold = 60

    if (!isSidebarOpen && touchStartX.current < 40 && deltaX > swipeThreshold) {
      setIsSidebarOpen(true)
    } else if (isSidebarOpen && deltaX < -swipeThreshold) {
      setIsSidebarOpen(false)
    }

    touchStartX.current = null
    touchCurrentX.current = null
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  aria-label={isSidebarOpen ? 'Скрыть меню' : 'Открыть меню'}
                >
                  {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              )}
              <div className="flex-1 flex items-center justify-start min-w-0">
                <Link to="/" className="text-2xl font-bold text-primary-600 truncate">
                  Платформа тестирования
                </Link>
              </div>
            </div>

            <div className="hidden lg:flex flex-1 items-center justify-end space-x-4">
              {user && (
                <>
                  <div className="text-sm text-right max-w-xs truncate">
                    <p className="font-medium text-gray-900 truncate">{user.full_name}</p>
                    <p className="text-gray-500 truncate">{getRoleLabel(user.role)}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn btn-secondary flex items-center space-x-2"
                  >
                    <LogOut size={18} />
                    <span>Выход</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        {user && (
          <>
            <div
              className={`fixed inset-0 bg-black/40 z-30 transition-opacity lg:hidden ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside
              className={`fixed z-40 inset-y-0 left-0 w-72 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-sm ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <nav className="p-4 space-y-2 overflow-y-auto h-full">
                {!isDesktop && user && (
                  <div className="mb-4 border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{getRoleLabel(user.role)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsSidebarOpen(false)
                        handleLogout()
                      }}
                      className="btn btn-secondary text-sm whitespace-nowrap"
                    >
                      <LogOut size={16} className="mr-1" />
                      Выход
                    </button>
                  </div>
                )}
                {getNavigationLinks().map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => {
                        if (!isDesktop) setIsSidebarOpen(false)
                      }}
                      className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Icon size={20} className="text-gray-600" />
                      <span className="font-medium text-gray-700">{link.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main
          className="flex-1 bg-gray-50"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

