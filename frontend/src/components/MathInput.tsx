import { useEffect, useRef } from 'react'
import 'mathlive'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any
    }
  }
}

type MathInputProps = {
  value: string
  onChange: (latex: string) => void
  placeholder?: string
}

export default function MathInput({ value, onChange, placeholder }: MathInputProps) {
  const ref = useRef<any>(null)

  // Sync incoming value to math-field
  useEffect(() => {
    if (ref.current && typeof ref.current.setValue === 'function') {
      ref.current.setValue(value ?? '', { silenceNotifications: true })
    }
  }, [value])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleInput = () => {
      try {
        const latex = el.getValue ? el.getValue('latex') : el.value
        onChange(latex ?? '')
      } catch {
        onChange('')
      }
    }
    el.addEventListener('input', handleInput)
    return () => {
      el.removeEventListener('input', handleInput)
    }
  }, [onChange])

  // SSR fallback
  if (typeof window === 'undefined') {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    )
  }

  return (
    <div className="border border-gray-300 rounded-lg p-2 focus-within:ring-2 focus-within:ring-primary-500 bg-white">
      <math-field
        ref={ref}
        value={value}
        placeholder={placeholder}
        virtual-keyboard-mode="manual"
        style={{ width: '100%', minHeight: '48px' }}
      />
    </div>
  )
}


