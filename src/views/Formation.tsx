import { useState } from 'react'
import { useStore, absentSet, placedSet } from '../store'
import { useHelpers } from '../helpers'

export default function Formation() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const rehearsals = useStore((s) => s.rehearsals)
  const members = useStore((s) => s.members)
  const formationLogs = useStore((s) => s.formationLogs)
  const assignCell = useStore((s) => s.assignCell)
  const shrinkVenue = useStore((s) => s.shrinkVenue)
  const addFormationChange = useStore((s) => s.addFormationChange)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const { nameOf } = useHelpers()

  const editable = role === 'leader'
  const list = programs.filter((p) => p.stage !== 'archived' && p.stage !== 'signup')
  const [pid, setPid] = useState(list[0]?.id ?? '')
  const program = programs.find((p) => p.id === pid) ?? list[0]
  const [selected, setSelected] = useState<string | null>(null)
  const [cols, setCols] = useState('6')
  const [fcSeg, setFcSeg] = useState('')
  const [fcDesc, setFcDesc] = useState('')

  if (!program) return <div className="card">暂无可编排走位的节目（节目需进入排练阶段）。</div>

  const { rows, cols: nCols, cells, changes } = program.formation
  const absent = absentSet(rehearsals, program.id)
  const placed = placedSet(program)
  const unplaced = program.memberIds.filter((id) => !placed.has(id))
  const frontAbsentCells: string[] = []
  cells[0]?.forEach((c) => { if (c && absent.has(c)) frontAbsentCells.push(c) })

  const clickCell = (r: number, c: number) => {
    if (!editable) return
    const cur = cells[r][c]
    if (selected) {
      assignCell(program.id, r, c, selected) // 放置（原有队员自动回待安置）
      setSelected(null)
    } else if (cur) {
      assignCell(program.id, r, c, null) // 撤下
    }
  }

  return (
    <div>
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>走位编排</h3>
          <select className="inp" style={{ width: 'auto' }} value={program.id} onChange={(e) => setPid(e.target.value)}>
            {list.map((p) => <option key={p.id} value={p.id}>《{p.title}》</option>)}
          </select>
          <span className="muted">{rows}排 × {nCols}列 · 已就位 {placed.size}/{program.memberIds.length} 人</span>
        </div>

        <div className="legend">
          <span><i style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}></i>已就位</span>
          <span><i style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }}></i>最近排练缺席/请假（影响站位）</span>
          <span><i style={{ background: '#fdf3dd', border: '1px solid var(--gold)' }}></i>前排区域</span>
          <span><i style={{ background: '#fff', border: '1px dashed var(--line)' }}></i>空位</span>
        </div>

        {frontAbsentCells.length > 0 && (
          <div className="alert red">
            前排成员 {frontAbsentCells.map(nameOf).join('、')} 最近排练{absent.get(frontAbsentCells[0]) === 'leave' ? '请假' : '缺席'}，
            其站位已标红闪烁——请安排替补队员或调整队形。
          </div>
        )}

        <div className="stage-dir">———— 观众席方向（第1排为前排）————</div>
        <div className="formation-grid" style={{ gridTemplateColumns: `repeat(${nCols}, 1fr)` }}>
          {cells.map((row, r) => row.map((cell, c) => {
            const st = cell ? absent.get(cell) : undefined
            const cls = [
              'fcell',
              cell ? 'filled' : '',
              r === 0 ? 'front' : '',
              st === 'absent' ? 'absent' : st === 'leave' ? 'leave' : '',
            ].join(' ')
            return (
              <div key={`${r}-${c}`} className={cls} onClick={() => clickCell(r, c)}
                style={cell === currentMemberId && role === 'member' ? { outline: '3px solid var(--blue)' } : undefined}>
                {cell ? (
                  <>
                    <span>{nameOf(cell)}</span>
                    <span className="pos">
                      {r === 0 ? '前排' : `第${r + 1}排`}·{c + 1}号位
                      {st === 'absent' ? ' · 缺席!' : st === 'leave' ? ' · 请假' : ''}
                    </span>
                  </>
                ) : (
                  <span className="pos">{selected ? '点击放置' : `${r + 1}排${c + 1}列`}</span>
                )}
              </div>
            )
          }))}
        </div>

        {editable && (
          <div className="mt12">
            <h3 style={{ fontSize: 15 }}>待安置队员 {selected ? `（已选中：${nameOf(selected)}，点击空位放置）` : '（点击选中后放到空位）'}</h3>
            <div className="unplaced">
              {unplaced.length === 0 && <span className="muted">全部队员已就位</span>}
              {unplaced.map((id) => (
                <button key={id} className="chip"
                  style={selected === id ? { background: 'var(--blue)', color: '#fff' } : undefined}
                  onClick={() => setSelected(selected === id ? null : id)}>
                  {nameOf(id)}{absent.has(id) ? '（缺席）' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h3>队形变化</h3>
          {changes.map((fc) => (
            <div className="mb8" key={fc.id}>
              <span className="badge brand">{fc.atSegment}</span> {fc.desc}
            </div>
          ))}
          {editable && (
            <div className="mt8">
              <div className="form-row">
                <label className="fld">所在分段
                  <select className="inp" value={fcSeg} onChange={(e) => setFcSeg(e.target.value)}>
                    <option value="">选择分段…</option>
                    {program.segments.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </label>
                <label className="fld">变化说明<input className="inp" value={fcDesc} onChange={(e) => setFcDesc(e.target.value)} placeholder="如：横排变两列纵队" /></label>
              </div>
              <button className="btn" disabled={!fcSeg || !fcDesc.trim()} onClick={() => {
                addFormationChange(program.id, fcSeg, fcDesc.trim()); setFcSeg(''); setFcDesc('')
              }}>添加队形变化</button>
            </div>
          )}

          {editable && (
            <div className="mt12" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
              <h3 style={{ fontSize: 15 }}>演出场地缩小 <span className="sub">文化站通知舞台变窄时压缩列数</span></h3>
              <div className="row">
                <span className="muted">当前 {nCols} 列 →</span>
                <input className="inp" style={{ width: 90 }} type="number" min={1} max={nCols - 1} value={cols} onChange={(e) => setCols(e.target.value)} />
                <span className="muted">列</span>
                <button className="btn danger" onClick={() => shrinkVenue(program.id, cols)}>压缩队形</button>
              </div>
              <div className="muted mt8">被裁掉列上的队员会进入「待安置」，并自动生成走位调整记录与通知。</div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>走位调整记录</h3>
          {formationLogs.filter((l) => l.programId === program.id).length === 0 && <div className="muted">暂无调整记录。</div>}
          {formationLogs.filter((l) => l.programId === program.id).map((l) => (
            <div className="notice" key={l.id}>
              {l.text}
              <div className="meta">{l.at}</div>
            </div>
          ))}
          <h3 className="mt12">队员可排练时间参考</h3>
          <table className="tbl">
            <tbody>
              {program.memberIds.map((id) => {
                const m = members.find((x) => x.id === id)!
                return (
                  <tr key={id}>
                    <td><b>{m.name}</b></td>
                    <td style={{ fontSize: 13 }}>{m.availableSlots.join('、')}</td>
                    <td>{absent.has(id) ? <span className="badge red">最近{absent.get(id) === 'leave' ? '请假' : '缺席'}</span> : <span className="badge green">正常</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
