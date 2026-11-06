type ChapterLabelProps = {
  index: string
  title: string
  heat: string
}

export function ChapterLabel({ index, title, heat }: ChapterLabelProps) {
  return (
    <div className="chapter-label">
      <span className="chapter-label__title label"><span>{index}</span> / {title}</span>
      <span className="heat-tag">{heat}</span>
    </div>
  )
}
