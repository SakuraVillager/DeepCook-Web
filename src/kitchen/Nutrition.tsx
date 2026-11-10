import { useState } from 'react'
import type { Nutrition } from './community'
import { Flip, Modal } from './ui'

const nutrients = [
  { key: 'calories', name: '热量', unit: 'kcal' },
  { key: 'fat', name: '脂肪', unit: 'g' },
  { key: 'protein', name: '蛋白质', unit: 'g' },
  { key: 'carbs', name: '碳水', unit: 'g' },
  { key: 'fiber', name: '膳食纤维', unit: 'g' },
  { key: 'sodium', name: '钠', unit: 'mg' },
] as const

export function RecipeNutrition({
  nutrition,
}: {
  nutrition: Nutrition | null
}) {
  const [expanded, setExpanded] = useState(false)
  const note = nutrition
    ? 'App 内置示例，非本菜谱的实测营养值。'
    : '暂无营养数据，缺失项显示“无”。'
  return (
    <section className="k-nutrition" aria-labelledby="recipe-nutrition-title">
      <header>
        <h2 id="recipe-nutrition-title">每份营养</h2>
        <Flip onClick={() => setExpanded(true)}>查看全部 ↗</Flip>
      </header>
      <dl className="k-nutrition__summary">
        {nutrients.slice(0, 4).map(({ key, name, unit }) => (
          <div key={key}>
            <dt>{name}</dt>
            <dd>
              <b>{nutrition?.[key] ?? '无'}</b>
              {nutrition?.[key] != null && <span>{unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="k-fine">{note}</p>
      {expanded && (
        <Modal title="完整营养表" onClose={() => setExpanded(false)}>
          <p className="k-fine">{note}</p>
          <table className="k-nutrition__table">
            <caption className="sr-only">每份营养成分</caption>
            <thead>
              <tr>
                <th scope="col">营养素</th>
                <th scope="col">每份含量</th>
              </tr>
            </thead>
            <tbody>
              {nutrients.map(({ key, name, unit }) => (
                <tr key={key}>
                  <th scope="row">{name}</th>
                  <td>
                    {nutrition?.[key] == null
                      ? '无'
                      : `${nutrition[key]} ${unit}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="k-modal-actions">
            <Flip onClick={() => setExpanded(false)}>收起营养表 ↗</Flip>
          </div>
        </Modal>
      )}
    </section>
  )
}
