import type { CSSProperties, MouseEventHandler } from 'react'

type LetterLinkProps = {
  text: string
  href?: string
  className?: string
  download?: boolean | string
  target?: string
  rel?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  ariaLabel?: string
  arrow?: boolean
}

export function LetterLink({
  text,
  href,
  className = '',
  download,
  target,
  rel,
  onClick,
  ariaLabel,
  arrow = false,
}: LetterLinkProps) {
  const chars = Array.from(text)

  return (
    <a
      className={`letter-link ${className}`.trim()}
      href={href}
      download={download}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={ariaLabel ?? text}
    >
      <span className="sr-only">{text}</span>
      <span className="letter-link__chars" aria-hidden="true">
        {chars.map((char, index) => (
          <span
            className="letter"
            key={`${char}-${index}`}
            style={{ '--i': index } as CSSProperties}
          >
            <span className="letter__track">
              <span>{char === ' ' ? ' ' : char}</span>
              <span>{char === ' ' ? ' ' : char}</span>
            </span>
          </span>
        ))}
      </span>
      {arrow && <span className="arrow" aria-hidden="true" />}
    </a>
  )
}
