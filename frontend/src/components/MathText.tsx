import katex from 'katex'
import 'katex/dist/katex.min.css'

type MathTextProps = {
  text?: string | null
  display?: boolean
  className?: string
}

export default function MathText({ text, display = false, className }: MathTextProps) {
  if (!text) return null
  let html = text
  try {
    html = katex.renderToString(text, {
      displayMode: display,
      throwOnError: false,
      strict: 'warn',
      macros: {
        '\\ce': '\\mathrm{#1}', // простая подстановка для химии, можно расширить
      },
    })
  } catch (e) {
    // Fallback: показываем исходный текст
    html = text
  }
  return (
    <span
      className={`${display ? 'block' : 'inline'} ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}


