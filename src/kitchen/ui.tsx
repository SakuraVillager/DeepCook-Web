import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { assetUrl } from './domain'

export function RollingText({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="letter-link__chars">
      {Array.from(text).map((char, i) => (
        <span className="letter" key={i} style={{ '--i': i } as CSSProperties}>
          <span className="letter__track">
            <span>{char === ' ' ? '\u00a0' : char}</span>
            <span>{char === ' ' ? '\u00a0' : char}</span>
          </span>
        </span>
      ))}
    </span>
  )
}

export function Flip({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: string }) {
  return (
    <button
      type="button"
      {...props}
      className={`letter-link k-flip ${className}`}
      aria-label={props['aria-label'] ?? children}
    >
      <span aria-hidden="true" className="letter-link__chars">
        {Array.from(children).map((char, i) => (
          <span
            className="letter"
            key={i}
            style={{ '--i': i } as CSSProperties}
          >
            <span className="letter__track">
              <span>{char === ' ' ? '\u00a0' : char}</span>
              <span>{char === ' ' ? '\u00a0' : char}</span>
            </span>
          </span>
        ))}
      </span>
    </button>
  )
}
export function Star({ active = false }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      aria-hidden="true"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
    </svg>
  )
}
export function Photo({
  path,
  alt,
  className = '',
  eager = false,
}: {
  path?: string | null
  alt: string
  className?: string
  eager?: boolean
}) {
  const src = assetUrl(path)
  return (
    <div className={`k-photo ${className}`}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          onError={(e) => {
            e.currentTarget.hidden = true
          }}
        />
      ) : null}
      <span className="k-photo__empty" aria-hidden="true">
        炊<span>DEEPCOOK</span>
      </span>
    </div>
  )
}
export function Heading({
  index,
  en,
  title,
  children,
}: {
  index: string
  en: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="k-heading">
      <div className="k-eyebrow label">
        <span>
          {index} / {en}
        </span>
        <span>THE ONLINE EDITION</span>
      </div>
      <div className="k-heading__row">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}
export function Empty({
  title = '还没有这道菜。',
  text = '换个关键词，或放宽筛选再试试。',
  children,
}: {
  title?: string
  text?: string
  children?: ReactNode
}) {
  return (
    <div className="k-empty">
      <span className="k-empty__mark" aria-hidden="true">
        炊
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    el?.showModal()
    return () => el?.close()
  }, [])
  return (
    <dialog
      className="k-modal"
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="modal-title"
    >
      <header>
        <h2 id="modal-title">{title}</h2>
        <button onClick={onClose} className="k-icon" aria-label="关闭">
          ×
        </button>
      </header>
      {children}
    </dialog>
  )
}
