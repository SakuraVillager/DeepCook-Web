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
    ? nutrition.note
    : '营养数据为大致估算，仅供饮食参考；实际数值随食材、份量和烹饪方式变化。'
  const basis = nutrition?.basis === 'recipe' ? '整道菜' : '每份'
  return (
    <section className="k-nutrition" aria-labelledby="recipe-nutrition-title">
      <header>
        <h2 id="recipe-nutrition-title">{basis}营养估算</h2>
        <Flip onClick={() => setExpanded(true)}>查看全部 ↗</Flip>
      </header>
      <dl className="k-nutrition__summary">
        {nutrients.slice(0, 4).map(({ key, name, unit }) => (
          <div key={key}>
            <dt>{name}</dt>
            <dd>
              <b>{nutrition?.[key] ?? '—'}</b>
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
            <caption className="sr-only">{basis}营养成分估算</caption>
            <thead>
              <tr>
                <th scope="col">营养素</th>
                <th scope="col">{basis}含量</th>
              </tr>
            </thead>
            <tbody>
              {nutrients.map(({ key, name, unit }) => (
                <tr key={key}>
                  <th scope="row">{name}</th>
                  <td>
                    {nutrition?.[key] == null
                      ? '—'
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
