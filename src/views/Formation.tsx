import { useState } from 'react'
import { useStore, absentSet, placedSet, rankSubstitutes, pendingLeaves, substitutionRisks } from '../store'
import { useHelpers } from '../helpers'
import type { Substitution } from '../types'

export default function Formation() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const rehearsals = useStore((s) => s.rehearsals)
  const members = useStore((s) => s.members)
  const enrollments = useStore((s) => s.enrollments)
  const formationLogs = useStore((s) => s.formationLogs)
  const assignCell = useStore((s) => s.assignCell)
  const shrinkVenue = useStore((s) => s.shrinkVenue)
  const addFormationChange = useStore((s) => s.addFormationChange)
  const registerPreShowLeave = useStore((s) => s.registerPreShowLeave)
  const confirmSubstitution = useStore((s) => s.confirmSubstitution)
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
  const [leaveMember, setLeaveMember] = useState('')
  const [leaveReason, setLeaveReason] = useState('')

  if (!program) return <div className="card">暂无可编排走位的节目（节目需进入排练阶段）。</div>

  const { rows, cols: nCols, cells, changes } = program.formation
  const absent = absentSet(rehearsals, program.id)
  const placed = placedSet(program)
  const leaves = pendingLeaves(program)
  const risks = substitutionRisks(program)
  const latestSub = program.substitutions[program.substitutions.length - 1]

  // 已确认请假（明天不上台）的队员，不再出现在「待安置」
  const confirmedLeaveIds = new Set(
    program.preShowLeaves.filter((l) => l.substitutionId).map((l) => l.memberId),
  )
  const unplaced = program.memberIds.filter((id) => !placed.has(id) && !confirmedLeaveIds.has(id))

  // 站位 -> 替位记录（用于新走位图标注）
  const subCell = new Map<string, Substitution>()
  program.substitutions.forEach((s) => subCell.set(`${s.row}-${s.col}`, s))
  // 已登记请假、替位待确认的站位
  const leaveCell = new Set<string>()
  leaves.forEach((l) => {
    cells.forEach((r, ri) => r.forEach((c, ci) => { if (c === l.memberId) leaveCell.add(`${ri}-${ci}`) }))
  })

  const frontAbsentCells: string[] = []
  cells[0]?.forEach((c) => { if (c && absent.has(c)) frontAbsentCells.push(c) })

  // 当前在队形中的前排队员（登记请假用）
  const frontPlaced = cells[0].filter((c): c is string => !!c)
    .filter((id) => !program.preShowLeaves.some((l) => l.memberId === id && !l.substitutionId))

  const clickCell = (r: number, c: number) => {
    if (!editable) return
    const cur = cells[r][c]
    if (selected) {
      // 待替位的格子必须通过替位面板确认，不能手动放置
      if (cur && leaves.some((l) => l.memberId === cur)) { alert('该站位待替位，请在上方替位面板确认人选') ; return }
      assignCell(program.id, r, c, selected) // 放置（原有队员自动回待安置）
      setSelected(null)
    } else if (cur) {
      // 已登记演出前请假、待确认替位的站位不允许直接撤下
      if (leaves.some((l) => l.memberId === cur)) { alert('该队员已登记明天请假，请在上方替位面板确认替位人选') ; return }
      assignCell(program.id, r, c, null) // 撤下
    }
  }

  return (
    <div>
      {/* ===== 演出前一天临时替位工作区（仅队长） ===== */}
      {editable && leaves.length > 0 && (
        <div className="card sub-panel">
          <h3>
            🚨 演出前一天 · 前排请假替位
            <span className="sub">按身高、熟练度、排练出勤综合推荐，队长确认后更新各方演出清单</span>
          </h3>
          {leaves.map((leave) => {
            const absentMember = members.find((m) => m.id === leave.memberId)!
            const pos = (() => {
              for (let r = 0; r < cells.length; r++) {
                const c = cells[r].indexOf(leave.memberId)
                if (c >= 0) return `${r === 0 ? '前排' : `第${r + 1}排`}${c + 1}号位`
              }
              return '站位已调整'
            })()
            const candidates = rankSubstitutes(program, leave.memberId, members, rehearsals, enrollments)
            return (
              <div key={leave.id} className="sub-case">
                <div className="alert red" style={{ marginBottom: 8 }}>
                  <b>{absentMember.name}</b>（前排 · {pos}）请假：{leave.reason}
                  <div className="meta" style={{ fontWeight: 400 }}>登记时间 {leave.at}</div>
                </div>
                {candidates.length === 0 && <div className="muted">没有可推荐的候补队员（需已报名且参加正式演出、当前未在队形中）。</div>}
                <table className="tbl">
                  <thead>
                    <tr><th>推荐</th><th>候补队员</th><th>身高匹配</th><th>熟练度</th><th>排练出勤</th><th>最后一次排练</th><th>综合分</th>{editable && <th>操作</th>}</tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => {
                      const m = members.find((x) => x.id === c.memberId)!
                      return (
                        <tr key={c.memberId} style={!c.atLastRehearsal ? { background: '#fff8f8' } : i === 0 ? { background: 'var(--green-soft)' } : undefined}>
                          <td>{i === 0 ? <span className="badge green">首选</span> : <span className="badge gray">第{i + 1}位</span>}</td>
                          <td><b>{m.name}</b><div className="muted" style={{ fontSize: 12 }}>{m.heightCm}cm</div></td>
                          <td>
                            差 <b style={{ color: c.heightDiff <= 3 ? 'var(--green)' : c.heightDiff <= 6 ? 'var(--gold)' : 'var(--red)' }}>{c.heightDiff}cm</b>
                          </td>
                          <td><b>{c.proficiency}</b>/5</td>
                          <td>{c.rehearsalCount ? <><b>{Math.round(c.attendanceRate * 100)}%</b><div className="muted" style={{ fontSize: 12 }}>近{c.rehearsalCount}场</div></> : '—'}</td>
                          <td>
                            {c.atLastRehearsal
                              ? <span className="badge green">参加 ✓</span>
                              : <span className="badge red">未参加 ✗</span>}
                          </td>
                          <td><b style={{ fontSize: 16 }}>{c.score}</b></td>
                          {editable && (
                            <td>
                              <button className="btn sm primary"
                                onClick={() => {
                                  if (!c.atLastRehearsal) {
                                    const ok = confirm(`${m.name} 未参加最后一次排练，确认由其替位？\n确认后队长端与演出前检查将持续提示风险。`)
                                    if (!ok) return
                                  }
                                  confirmSubstitution(program.id, leave.id, c.memberId)
                                  setSelected(null)
                                }}>
                                确认替位
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="muted mt8" style={{ fontSize: 12.5 }}>
                  打分规则：熟练度 40% + 历史出勤率 35% + 是否参加最后一次排练 15% + 身高接近度 10%。
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== 替位确认后的持续风险提示（队长端，不解除） ===== */}
      {editable && risks.length > 0 && (
        <div className="alert red sub-risk">
          ⚠ 演出前风险持续提示：
          {risks.map((s) => (
            <span key={s.id}>
              替位队员 <b>{nameOf(s.subMemberId)}</b> 未参加最后一次排练（{s.lastRehearsalDate}），
              顶替 <b>{nameOf(s.absentMemberId)}</b> 的{ s.row === 0 ? '前排' : `第${s.row + 1}排`}{s.col + 1}号位，
              对新走位与队形变化不熟悉——请今晚加练并在演出当天重点盯位。
            </span>
          ))}
          <div style={{ fontWeight: 400, marginTop: 4 }}>该提示在走位页、总览与演出当天「演出前检查」中持续显示，直至演出归档。</div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>走位编排{latestSub ? '（新走位图）' : ''}</h3>
          <select className="inp" style={{ width: 'auto' }} value={program.id} onChange={(e) => setPid(e.target.value)}>
            {list.map((p) => <option key={p.id} value={p.id}>《{p.title}》</option>)}
          </select>
          <span className="muted">{rows}排 × {nCols}列 · 已就位 {placed.size}/{program.memberIds.length - confirmedLeaveIds.size} 人</span>
          {latestSub && <span className="badge blue">替位更新于 {latestSub.at}</span>}
        </div>

        <div className="legend">
          <span><i style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}></i>已就位</span>
          <span><i style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }}></i>最近排练缺席/请假（影响站位）</span>
          <span><i style={{ background: '#efe7fb', border: '1px solid #7a4fc2' }}></i>临时替位（新走位）</span>
          <span><i style={{ background: '#fdf3dd', border: '1px solid var(--gold)' }}></i>前排区域</span>
          <span><i style={{ background: '#fff', border: '1px dashed var(--line)' }}></i>空位</span>
        </div>

        {frontAbsentCells.length > 0 && leaves.length === 0 && (
          <div className="alert red">
            前排成员 {frontAbsentCells.map(nameOf).join('、')} 最近排练{absent.get(frontAbsentCells[0]) === 'leave' ? '请假' : '缺席'}，
            其站位已标红闪烁——请安排替补队员或调整队形。
          </div>
        )}

        {/* 非队长角色看到的替位说明 */}
        {!editable && program.substitutions.length > 0 && (
          <div className="alert blue">
            演出清单已更新：
            {program.substitutions.map((s) => (
              <span key={s.id}>{nameOf(s.absentMemberId)} 请假 → <b>{nameOf(s.subMemberId)}</b> 替位上台；</span>
            ))}
            {role === 'member' && program.substitutions.some((s) => s.subMemberId === currentMemberId) && '你是本次替位队员，请按新走位图准时到位并参加重点排练。'}
          </div>
        )}

        <div className="stage-dir">———— 观众席方向（第1排为前排）————</div>
        <div className="formation-grid" style={{ gridTemplateColumns: `repeat(${nCols}, 1fr)` }}>
          {cells.map((row, r) => row.map((cell, c) => {
            const st = cell ? absent.get(cell) : undefined
            const sub = cell ? subCell.get(`${r}-${c}`) : undefined
            const preLeave = leaveCell.has(`${r}-${c}`)
            const cls = [
              'fcell',
              cell ? 'filled' : '',
              r === 0 ? 'front' : '',
              st === 'absent' ? 'absent' : st === 'leave' ? 'leave' : '',
              sub ? 'sub' : '',
              preLeave ? 'preleave' : '',
            ].join(' ')
            return (
              <div key={`${r}-${c}`} className={cls} onClick={() => clickCell(r, c)}
                style={cell === currentMemberId && role === 'member' ? { outline: '3px solid var(--blue)' } : undefined}>
                {cell ? (
                  <>
                    <span>{nameOf(cell)}{sub && <span className="sub-tag">替位</span>}</span>
                    <span className="pos">
                      {r === 0 ? '前排' : `第${r + 1}排`}·{c + 1}号位
                      {sub ? ' · 临时替位' : preLeave ? ' · 明天请假·待替位' : st === 'absent' ? ' · 缺席!' : st === 'leave' ? ' · 请假' : ''}
                    </span>
                  </>
                ) : (
                  <span className="pos">{selected ? '点击放置' : `${r + 1}排${c + 1}列`}</span>
                )}
              </div>
            )
          }))}
        </div>

        {latestSub && (
          <div className="alert green mt12">
            ✓ 替位确认后已自动生成新走位图（见上方紫色站位）与重点排练名单；
            替位队员、服装负责人、音响师均已收到更新后的演出清单通知。
          </div>
        )}

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
              {fc.affectedBySub && <span className="badge red" style={{ marginLeft: 6 }}>受替位影响 · 需重走</span>}
            </div>
          ))}

          {/* 替位确认后生成的重点排练名单 */}
          {program.substitutions.length > 0 && (
            <div className="card" style={{ background: '#fcfaf6', boxShadow: 'none', marginTop: 8 }}>
              <h3 style={{ fontSize: 15 }}>📋 重点排练名单 <span className="sub">替位确认后自动生成</span></h3>
              {program.substitutions.map((su) => (
                <div key={su.id} className="mb8">
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <b>{nameOf(su.subMemberId)}</b> 替 {nameOf(su.absentMemberId)}
                    （{su.row === 0 ? '前排' : `第${su.row + 1}排`}{su.col + 1}号位）
                    {!su.subAtLastRehearsal && <span className="badge red" style={{ marginLeft: 6 }}>未参加最后排练 · 重点加练</span>}
                  </div>
                  <div className="unplaced">
                    {su.focusMemberIds.map((id) => (
                      <span key={id} className="chip"
                        style={id === su.subMemberId ? { background: '#7a4fc2', borderColor: '#7a4fc2', color: '#fff' } : undefined}>
                        {nameOf(id)}{id === su.subMemberId ? '（替位）' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="muted mt8" style={{ fontSize: 12.5 }}>
                含替位队员本人、同排相邻配合队员，以及请假队员原负责的重点动作分段；请今晚按新走位图合练。
              </div>
            </div>
          )}

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
              <h3 style={{ fontSize: 15 }}>演出前一天前排请假登记 <span className="sub">登记后自动推荐替位</span></h3>
              <div className="row">
                <select className="inp" style={{ width: 200 }} value={leaveMember} onChange={(e) => setLeaveMember(e.target.value)}>
                  <option value="">选择前排队员…</option>
                  {frontPlaced.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
                <input className="inp" style={{ flex: 1, minWidth: 180 }} value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)} placeholder="请假原因，如：突发高烧明天无法上台" />
                <button className="btn danger" disabled={!leaveMember || !leaveReason.trim()} onClick={() => {
                  registerPreShowLeave(program.id, leaveMember, leaveReason.trim())
                  setLeaveMember(''); setLeaveReason('')
                }}>登记请假并推荐替位</button>
              </div>
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
                const isSub = program.substitutions.some((s) => s.subMemberId === id)
                const isGone = confirmedLeaveIds.has(id)
                return (
                  <tr key={id} style={isSub ? { background: '#f6f0fd' } : undefined}>
                    <td><b>{m.name}</b>{m.frontRow && <span className="badge gold" style={{ marginLeft: 4 }}>前排</span>}{isSub && <span className="badge" style={{ marginLeft: 4, background: '#efe7fd', color: '#7a4fc2' }}>替位</span>}{isGone && <span className="badge red" style={{ marginLeft: 4 }}>已请假</span>}</td>
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
