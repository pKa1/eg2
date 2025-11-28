import React from 'react'

type ErrorBoundaryState = { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // TODO: send to logging service
    // console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-lg w-full card text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Произошла ошибка</h2>
            <p className="text-gray-600 mb-4">Попробуйте обновить страницу или вернуться позже.</p>
            <div className="flex justify-center space-x-3">
              <button className="btn btn-secondary" onClick={() => history.back()}>Назад</button>
              <button className="btn btn-primary" onClick={this.handleReload}>Обновить</button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}


