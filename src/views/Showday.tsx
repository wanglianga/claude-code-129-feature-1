import { useState } from 'react'
import { useStore, substitutionRisks, pendingLeaves } from '../store'
import { useHelpers } from '../helpers'

export default function Showday() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const members = useStore((s) => s.members)
  const costumes = useStore((s) => s.costumes)
  const onsite = useStore((s) => s.onsite)
  const notices = useStore((s) => s.notices)
  const onsiteCheckin = useStore((s) => s.onsiteCheckin)
  const moveWaiting = useStore((s) => s.moveWaiting)
  const addNotice = useStore((s) => s.addNotice)
  const { nameOf } = useHelpers()

  const [liveText, setLiveText] = useState('')
  const queue = programs
    .filter((p) => p.stage === 'ready' || p.stage === 'showday')
    .sort((a, b) => a.waitingOrder - b.waitingOrder)
  const liveNotices = notices.filter((n) => n.kind === 'live').slice(-6).reverse()

  // 演出前检查：所有未归档且有替位记录的节目（含走位/待演出阶段，演出前一天起持续检查）
  const preShow = programs.filter((p) => p.stage !== 'archived' && p.substitutions.length > 0)
  // 未确认替位的前排请假
  const openLeaves = programs.filter((p) => p.stage !== 'archived' && pendingLeaves(p).length > 0)

  const subBadge = (p: { id: string }, mid: string) => {
    const prog = programs.find((x) => x.id === p.id)!
    const sub = prog.substitutions.find((s) => s.subMemberId === mid)
    const gone = prog.substitutions.find((s) => s.absentMemberId === mid)
    if (sub) return <span className="badge" style={{ background: '#efe7fd', color: '#7a4fc2' }}>替位</span>
    if (gone) return <span className="badge red">已请假</span>
    return null
  }

  return (
    <div>
      {/* ===== 演出前检查：替位风险持续提示（不可解除） ===== */}
      {(openLeaves.length > 0 || preShow.length > 0) && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <h3>✅ 演出前检查清单 <span className="sub">演出前一天起逐项核对，红色风险项持续提示直至演出归档</span></h3>

          {openLeaves.map((p) => (
            <div className="alert red" key={`ol-${p.id}`}>
              《{p.title}》前排 {pendingLeaves(p).map((l) => nameOf(l.memberId)).join('、')} 请假尚未确认替位，
              请队长立即到「走位编排」页确认替位人选。
            </div>
          ))}

          {preShow.map((p) => {
            const risks = substitutionRisks(p)
            return (
              <div key={p.id} className="precheck">
                <div className="spread">
                  <b>《{p.title}》</b>
                  <span className="muted">演出 {p.showDate}</span>
                </div>
                <table className="tbl" style={{ margin: '6px 0' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: 200 }}>替位确认与新走位图</td>
                      <td><span className="badge green">已完成</span>
                        <span className="muted" style={{ marginLeft: 8 }}>
                          {p.substitutions.map((s) => `${nameOf(s.absentMemberId)}→${nameOf(s.subMemberId)}`).join('；')}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>替位队员服装</td>
                      <td>
                        {p.substitutions.map((s) => {
                          const c = costumes.find((x) => x.programId === p.id && x.memberId === s.subMemberId)
                          const ok = c?.pickedUp
                          return (
                            <span key={s.id} style={{ marginRight: 14 }}>
                              {nameOf(s.subMemberId)}：
                              {ok ? <span className="badge green">已领取</span>
                                : <span className="badge red">未领取，需加急备装</span>}
                            </span>
                          )
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td>音响/候场名单</td>
                      <td><span className="badge green">已按新名单更新</span>
                        <span className="muted" style={{ marginLeft: 8 }}>人数与节目时长不变，当前曲目 {p.musicVersions.find((v) => v.current)?.label ?? '未上传'}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>替位参加最后一次排练</td>
                      <td>
                        {risks.length === 0
                          ? <span className="badge green">全部参加，风险正常</span>
                          : risks.map((s) => (
                            <span key={s.id} className="badge red" style={{ marginRight: 8 }}>
                              ⚠ {nameOf(s.subMemberId)} 未参加（{s.lastRehearsalDate}）
                            </span>
                          ))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {risks.map((s) => (
                  <div className="alert red sub-risk" key={s.id} style={{ marginBottom: 6 }}>
                    ⚠ 持续风险提示：替位队员 <b>{nameOf(s.subMemberId)}</b> 未参加最后一次排练，
                    顶替 <b>{nameOf(s.absentMemberId)}</b> 的{ s.row === 0 ? '前排' : `第${s.row + 1}排`}{s.col + 1}号位。
                    上场前请核对：①已按新走位图加练受影响的 {s.affectedChangeIds.length} 处队形变化；
                    ②重点排练名单（{s.focusMemberIds.map(nameOf).join('、')}）已合练；③现场安排专人盯位引导。
                  </div>
                ))}
              </div>
            )
          })}
          {role === 'volunteer' && (
            <div className="alert blue mt8">志愿者：候场引导与上下台搀扶请按更新后的名单执行，重点关注紫色「替位」队员。</div>
          )}
        </div>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3>候场顺序 <span className="sub">志愿者按此引导节目到候场区</span></h3>
            {queue.length === 0 && <div className="muted">暂无待演出节目（节目审查通过后进入候场队列）。</div>}
            {queue.map((p, i) => {
              const activeCount = p.memberIds.length - p.substitutions.length
              const arrived = Object.values(onsite[p.id] ?? {}).filter(Boolean).length
              return (
                <div key={p.id} className={`queue-item ${p.stage === 'showday' ? 'onstage' : ''}`}>
                  <div className="no">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <b>《{p.title}》</b>
                    <div className="muted">{p.durationMin}分钟 · {activeCount}人（替位{p.substitutions.length}） · 已到 {arrived}/{activeCount}</div>
                    {p.substitutions.length > 0 && (
                      <div className="muted" style={{ color: '#7a4fc2' }}>
                        替位：{p.substitutions.map((s) => `${nameOf(s.absentMemberId)}→${nameOf(s.subMemberId)}`).join('；')}
                      </div>
                    )}
                  </div>
                  {p.stage === 'showday' && <span className="badge green">候场中</span>}
                  {(role === 'volunteer' || role === 'leader') && (
                    <div className="row">
                      <button className="btn sm" disabled={i === 0} onClick={() => moveWaiting(p.id, -1)}>↑ 提前</button>
                      <button className="btn sm" disabled={i === queue.length - 1} onClick={() => moveWaiting(p.id, 1)}>↓ 延后</button>
                    </div>
                  )}
                </div>
              )
            })}
            {(role === 'volunteer' || role === 'leader') && queue.length > 0 && (
              <div className="alert blue mt8">志愿者引导要点：按顺序提前2个节目通知到东侧候场区集合；核对人数与服装；引导上下台走西侧台阶，注意老年队员搀扶。</div>
            )}
          </div>

          <div className="card">
            <h3>现场临时通知 {(role === 'leader' || role === 'volunteer') && <span className="sub">发布后全员可见</span>}</h3>
            {(role === 'leader' || role === 'volunteer') && (
              <div className="row mb8">
                <input className="inp" style={{ flex: 1 }} value={liveText} onChange={(e) => setLiveText(e.target.value)}
                  placeholder="如：请3号节目演员立即到东侧候场区集合" />
                <button className="btn primary" disabled={!liveText.trim()} onClick={() => {
                  addNotice(liveText.trim(), 'urgent', ['leader', 'member', 'volunteer', 'sound', 'costume'], 'live', null)
                  setLiveText('')
                }}>发布</button>
              </div>
            )}
            {liveNotices.length === 0 && <div className="muted">暂无现场通知。</div>}
            {liveNotices.map((n) => (
              <div key={n.id} className="notice urgent">
                {n.text}
                <div className="meta">{n.at}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {queue.map((p) => (
            <div className="card" key={p.id}>
              <h3>《{p.title}》现场签到 <span className="sub">点击队员标记到场</span></h3>
              <div className="checkin-grid">
                {p.memberIds.filter((mid) => !p.substitutions.some((s) => s.absentMemberId === mid)).map((mid) => {
                  const m = members.find((x) => x.id === mid)!
                  const on = onsite[p.id]?.[mid]
                  const sub = p.substitutions.find((s) => s.subMemberId === mid)
                  return (
                    <div key={mid} className="checkin-card" style={on ? { borderColor: 'var(--green)', background: 'var(--green-soft)' } : sub ? { borderColor: '#7a4fc2' } : undefined}>
                      <div className="nm">{m.name} {subBadge(p, mid)}</div>
                      <div className="meta">{m.age}岁{m.healthNotes ? ` · ⚠${m.healthNotes.slice(0, 10)}` : ''}</div>
                      {sub && <div className="meta" style={{ color: '#7a4fc2' }}>替 {nameOf(sub.absentMemberId)} · {sub.row === 0 ? '前排' : `第${sub.row + 1}排`}{sub.col + 1}号位</div>}
                      <button className={`btn ${on ? 'green' : ''}`} style={{ width: '100%', padding: '10px 0' }}
                        onClick={() => onsiteCheckin(p.id, mid)}>
                        {on ? '✓ 已到场' : '标记到场'}
                      </button>
                    </div>
                  )
                })}
              </div>
              {role === 'sound' && (
                <div className="alert blue mt8">音响确认：{p.soundNeeds}；当前曲目 {p.musicVersions.find((v) => v.current)?.label ?? '未上传'}。</div>
              )}
            </div>
          ))}

          {/* 音响师视角：更新后的演出清单（替位节目可能尚未进入候场队列） */}
          {role === 'sound' && preShow.map((p) => (
            <div className="card" key={`snd-${p.id}`} style={{ borderColor: '#7a4fc2' }}>
              <h3>《{p.title}》更新后的演出清单 <span className="sub">替位已确认</span></h3>
              {p.substitutions.map((s) => (
                <div key={s.id} className="mb8">
                  <span className="badge red">{nameOf(s.absentMemberId)} 请假</span>
                  → <span className="badge" style={{ background: '#efe7fd', color: '#7a4fc2' }}>{nameOf(s.subMemberId)} 替位上台</span>
                  <span className="muted" style={{ marginLeft: 8 }}>{s.row === 0 ? '前排' : `第${s.row + 1}排`}{s.col + 1}号位 · 人数/时长不变</span>
                </div>
              ))}
              <div className="muted">音响需求：{p.soundNeeds}</div>
              <div className="muted">当前曲目：{p.musicVersions.find((v) => v.current)?.label ?? '未上传'}；候场点名与话筒交接请按新名单。</div>
            </div>
          ))}

          {queue.length === 0 && preShow.length === 0 && (
            <div className="card">
              <h3>音响需求一览（音响师）</h3>
              {programs.filter((p) => p.stage !== 'archived').map((p) => (
                <div key={p.id} className="mb8">
                  <b>《{p.title}》</b>：{p.soundNeeds}
                  <div className="muted">当前曲目：{p.musicVersions.find((v) => v.current)?.label ?? '未上传'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
