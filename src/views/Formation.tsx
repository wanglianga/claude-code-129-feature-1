import { useState } from 'react'
import { useStore, absentSet, placedSet, activeSubs, riskySubs, type SubCandidate } from '../store'
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
  const rankSubstitutes = useStore((s) => s.rankSubstitutes)
  const confirmSubstitute = useStore((s) => s.confirmSubstitute)
  const cancelSubstitute = useStore((s) => s.cancelSubstitute)
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

  // 临时替位面板状态
  const [subAbsent, setSubAbsent] = useState('')
  const [subPick, setSubPick] = useState('')
  const [subReason, setSubReason] = useState('演出前一天家中临时有事请假')
  const [confirming, setConfirming] = useState(false)

  if (!program) return <div className="card">暂无可编排走位的节目（节目需进入排练阶段）。</div>

  const { rows, cols: nCols, cells, changes } = program.formation
  const absent = absentSet(rehearsals, program.id)
  const placed = placedSet(program)
  const unplaced = program.memberIds.filter((id) => !placed.has(id))
  const subs = activeSubs(program)
  const risks = riskySubs(program)
  const subByMember = new Map(subs.map((x) => [x.subMemberId, x]))
  const frontAbsentCells: string[] = []
  cells[0]?.forEach((c) => { if (c && absent.has(c) && !subByMember.has(c)) frontAbsentCells.push(c) })

  const placedAbsent = [...placed].filter((id) => absent.has(id))
  const candidates: SubCandidate[] = subAbsent ? rankSubstitutes(program.id, subAbsent) : []
  const picked = candidates.find((c) => c.memberId === subPick)
  // 重点排练名单（合并各替位记录）
  const focusIds = Array.from(new Set(subs.flatMap((x) => x.focusMemberIds)))
  const affectedChanges = changes.filter((c) => c.affectedBySub)
  const riskIds = new Set(risks.map((x) => x.id))
  const riskChangeNames = changes.filter((c) => c.affectedBySub && riskIds.has(c.affectedBySub)).map((c) => c.atSegment)

  const doConfirm = () => {
    if (!subAbsent || !subPick) return
    const err = confirmSubstitute(program.id, subAbsent, subPick, subReason)
    if (err) { alert(err); return }
    setSubAbsent(''); setSubPick(''); setSubReason('演出前一天家中临时有事请假'); setConfirming(false)
  }

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
      {risks.length > 0 && (
        <div className="alert red sub-risk">
          ⚠ 替位风险持续提示：{risks.map((x) => nameOf(x.subMemberId)).join('、')} 未参加最后一次排练
          （{risks[0].lastRehearsalDate}），新走位{riskChangeNames.length > 0 && `与「${riskChangeNames.join('」「')}」`}不熟练，
          演出前务必补排，并在演出当天再次核对到场。
        </div>
      )}

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>走位编排</h3>
          <select className="inp" style={{ width: 'auto' }} value={program.id} onChange={(e) => setPid(e.target.value)}>
            {list.map((p) => <option key={p.id} value={p.id}>《{p.title}》</option>)}
          </select>
          <span className="muted">{rows}排 × {nCols}列 · 已就位 {placed.size}/{program.memberIds.length} 人{subs.length > 0 && ` · 替位 ${subs.length} 处`}</span>
        </div>

        <div className="legend">
          <span><i style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}></i>已就位</span>
          <span><i style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }}></i>最近排练缺席/请假（影响站位）</span>
          <span><i style={{ background: '#fdf3dd', border: '1px solid var(--gold)' }}></i>前排区域</span>
          <span><i style={{ background: 'var(--purple-soft)', border: '1px solid var(--purple)' }}></i>临时替位站位</span>
          <span><i style={{ background: '#fff', border: '1px dashed var(--line)' }}></i>空位</span>
        </div>

        {frontAbsentCells.length > 0 && (
          <div className="alert red">
            前排成员 {frontAbsentCells.map(nameOf).join('、')} 最近排练{absent.get(frontAbsentCells[0]) === 'leave' ? '请假' : '缺席'}，
            其站位已标红闪烁——请在下方安排{editable ? '临时替位' : '替位'}或调整队形。
          </div>
        )}

        <div className="stage-dir">———— 观众席方向（第1排为前排）————</div>
        <div className="formation-grid" style={{ gridTemplateColumns: `repeat(${nCols}, 1fr)` }}>
          {cells.map((row, r) => row.map((cell, c) => {
            const st = cell ? absent.get(cell) : undefined
            const isSub = cell ? subByMember.has(cell) : false
            const cls = [
              'fcell',
              cell ? 'filled' : '',
              r === 0 ? 'front' : '',
              isSub ? 'subcell' : (st === 'absent' ? 'absent' : st === 'leave' ? 'leave' : ''),
            ].join(' ')
            return (
              <div key={`${r}-${c}`} className={cls} onClick={() => clickCell(r, c)}
                style={cell === currentMemberId && role === 'member' ? { outline: '3px solid var(--blue)' } : undefined}>
                {isSub && <span className="subtag">替</span>}
                {cell ? (
                  <>
                    <span>{nameOf(cell)}</span>
                    <span className="pos">
                      {r === 0 ? '前排' : `第${r + 1}排`}·{c + 1}号位
                      {isSub ? ' · 临时替位' : st === 'absent' ? ' · 缺席!' : st === 'leave' ? ' · 请假' : ''}
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

      {/* ===== 临时替位（演出前一天前排请假） ===== */}
      <div className="card sub-panel">
        <h3>
          临时替位走位
          <span className="sub">演出前一天前排队员请假：按身高、熟练度、排练出勤推荐替位，确认后自动更新走位图、队形变化与各方演出清单</span>
        </h3>

        {subs.length > 0 && (
          <div className="mb8">
            {subs.map((x) => (
              <div key={x.id} className={`notice ${!x.attendedLastRehearsal ? 'urgent' : ''}`}>
                <div>
                  <b>{nameOf(x.subMemberId)}</b> 顶替 <b>{nameOf(x.absentMemberId)}</b>
                  <span className="badge purple" style={{ marginLeft: 8 }}>
                    {x.row === 0 ? '前排' : `第${x.row + 1}排`}{x.col + 1}号位
                  </span>
                  {!x.attendedLastRehearsal && <span className="badge red" style={{ marginLeft: 6 }}>未参加最后排练·风险</span>}
                  {x.attendedLastRehearsal && <span className="badge green" style={{ marginLeft: 6 }}>参加了最后排练</span>}
                </div>
                <div className="meta">
                  {x.reason} · 确认于 {x.confirmedAt} · 最后排练 {x.lastRehearsalDate}
                  {x.affectedChangeIds.length > 0 && ` · 受影响队形变化 ${x.affectedChangeIds.length} 处`}
                </div>
                {editable && (
                  <button className="btn sm danger mt8" onClick={() => {
                    if (confirm(`撤销替位后 ${nameOf(x.absentMemberId)} 将恢复原站位，确定？`)) cancelSubstitute(program.id, x.id)
                  }}>撤销替位（恢复原站位）</button>
                )}
              </div>
            ))}
          </div>
        )}

        {editable ? (
          <>
            {placedAbsent.length === 0 && subs.length === 0 && (
              <div className="muted">当前队形中没有最近排练请假/缺席的队员。若演出前有人请假，先在「排练签到」登记，即可在此安排替位。</div>
            )}
            {(placedAbsent.length > 0 || confirming) && (
              <div className="sub-form">
                <label className="fld">请假/缺席队员（其站位将被顶替）
                  <select className="inp" value={subAbsent} onChange={(e) => {
                    setSubAbsent(e.target.value); setSubPick(''); setConfirming(false)
                  }}>
                    <option value="">请选择…</option>
                    {placedAbsent.map((id) => (
                      <option key={id} value={id}>
                        {nameOf(id)}（{cells[0]?.includes(id) ? '前排' : '后排'}·{absent.get(id) === 'leave' ? '请假' : '缺席'}）
                      </option>
                    ))}
                  </select>
                </label>

                {subAbsent && (
                  <>
                    <div className="muted mt8">
                      系统按「身高接近（25%）＋ 动作熟练度（40%）＋ 排练出勤率（35%）」综合评分推荐：
                    </div>
                    {candidates.length === 0 && <div className="alert gold mt8">暂无可推荐的候补队员（未占位且未被其他替位占用的队员为空）。</div>}
                    <table className="tbl mt8">
                      <thead>
                        <tr><th>推荐</th><th>队员</th><th>身高匹配</th><th>熟练度</th><th>排练出勤</th><th>最后一次排练</th><th>综合评分</th></tr>
                      </thead>
                      <tbody>
                        {candidates.map((cand, i) => {
                          const absentMember = members.find((m) => m.id === subAbsent)!
                          return (
                            <tr key={cand.memberId}
                              style={subPick === cand.memberId ? { background: 'var(--purple-soft)' } : undefined}
                              onClick={() => { setSubPick(cand.memberId); setConfirming(false) }} className="cand-row">
                              <td>
                                <input type="radio" checked={subPick === cand.memberId} readOnly style={{ width: 16, height: 16 }} />
                                {i === 0 && <span className="badge purple" style={{ marginLeft: 6 }}>系统推荐</span>}
                              </td>
                              <td><b>{nameOf(cand.memberId)}</b></td>
                              <td>{cand.heightCm}cm（差 {cand.heightDiff}cm，请假者 {absentMember.heightCm}cm）</td>
                              <td><span className="stars">{'★'.repeat(cand.proficiency)}{'☆'.repeat(5 - cand.proficiency)}</span></td>
                              <td>{cand.total === 0 ? '无记录' : `${cand.presents}/${cand.total} 场（${Math.round(cand.attendance * 100)}%）`}</td>
                              <td>{cand.attendedLast ? <span className="badge green">出勤</span> : <span className="badge red">未参加</span>}</td>
                              <td><b>{Math.round(cand.score)}</b> 分</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <label className="fld mt8">请假原因（写入替位记录与演出清单）
                      <input className="inp" value={subReason} onChange={(e) => setSubReason(e.target.value)} />
                    </label>

                    {!confirming ? (
                      <button className="btn primary" disabled={!subPick}
                        onClick={() => setConfirming(true)}>
                        确认替位安排
                      </button>
                    ) : (
                      <div className="alert gold">
                        <div style={{ marginBottom: 8 }}>
                          请最终确认：<b>{picked && nameOf(picked.memberId)}</b> 将顶替 <b>{nameOf(subAbsent)}</b>。
                          确认后系统会：① 更新走位图（标「替」）；② 自动标记受影响的队形变化；
                          ③ 生成重点排练名单；④ 通知替位队员、服装负责人（备候补服装）、音响师更新演出清单。
                          {picked && !picked.attendedLast && ' 该队员未参加最后一次排练，队长端将持续提示风险。'}
                        </div>
                        <div className="row">
                          <button className="btn primary" onClick={doConfirm}>最终确认，下发更新</button>
                          <button className="btn" onClick={() => setConfirming(false)}>再想想</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="muted">替位由队长确认安排；确认后排练队员、服装负责人、音响师都会在通知中心收到更新后的演出清单。</div>
        )}
      </div>

      {/* ===== 替位确认后：新走位相关产出 ===== */}
      {(subs.length > 0) && (
        <div className="card">
          <h3>替位后重点排练名单 <span className="sub">新走位图见上方（紫色「替」位）</span></h3>
          <div className="unplaced">
            {focusIds.map((id) => (
              <span key={id} className="chip" style={subByMember.has(id)
                ? { background: 'var(--purple)', borderColor: 'var(--purple)', color: '#fff', cursor: 'default' }
                : { cursor: 'default' }}>
                {nameOf(id)}{subByMember.has(id) ? '（替位）' : ''}
              </span>
            ))}
          </div>
          {affectedChanges.length > 0 && (
            <div className="mt12">
              <b>需重点合练的队形变化（已自动标记）：</b>
              {affectedChanges.map((fc) => (
                <div className="mb8" key={fc.id}>
                  <span className="badge red">受替位影响</span>
                  <span className="badge brand" style={{ marginLeft: 6 }}>{fc.atSegment}</span> {fc.desc}
                </div>
              ))}
            </div>
          )}
          {risks.length > 0 && role === 'leader' && (
            <div className="alert red mt8">
              {risks.map((x) => nameOf(x.subMemberId)).join('、')} 未参加最后一次排练（{risks[0].lastRehearsalDate}），
              演出前检查（演出当天页）将继续提示，到场前请勿解除关注。
            </div>
          )}
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>队形变化</h3>
          {changes.map((fc) => (
            <div className="mb8" key={fc.id}>
              <span className={`badge ${fc.affectedBySub ? 'red' : 'brand'}`}>
                {fc.affectedBySub ? '受替位影响·需重练' : fc.atSegment}
              </span>{' '}
              {fc.affectedBySub && <span className="badge brand">{fc.atSegment}</span>} {fc.desc}
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
                const sub = subByMember.get(id)
                return (
                  <tr key={id}>
                    <td><b>{m.name}</b>{sub && <span className="badge purple" style={{ marginLeft: 6 }}>替位</span>}</td>
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
