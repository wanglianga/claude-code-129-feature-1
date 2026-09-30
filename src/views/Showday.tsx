import { useState } from 'react'
import { useStore, activeSubs, riskySubs } from '../store'
import { useHelpers } from '../helpers'

const CHECK_ITEMS = ['替位队员已到场', '已与替位队员过一遍新走位与受影响队形变化', '临时候补服装已到位', '音响/候场播报清单已按最新名单更新']

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
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const queue = programs
    .filter((p) => p.stage === 'ready' || p.stage === 'showday')
    .sort((a, b) => a.waitingOrder - b.waitingOrder)
  const liveNotices = notices.filter((n) => n.kind === 'live').slice(-6).reverse()
  const canCheck = role === 'leader' || role === 'volunteer'

  return (
    <div>
      {/* 替位后最新演出清单：替位队员、服装负责人、音响师共用 */}
      {queue.some((p) => activeSubs(p).length > 0) && (
        <div className="card sub-panel">
          <h3>替位后最新演出清单 <span className="sub">队长确认替位后自动更新，替位队员 / 服装 / 音响以此为准</span></h3>
          {queue.filter((p) => activeSubs(p).length > 0).map((p) => {
            const subs = activeSubs(p)
            const tempCos = costumes.filter((c) => c.programId === p.id && c.temporary)
            return (
              <div key={p.id} className="mb8" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 8 }}>
                <b>《{p.title}》</b>
                <span className="muted">（{p.durationMin}分钟 · 候场顺序见下）</span>
                <div className="mt8">
                  {subs.map((x) => {
                    const arrived = !!onsite[p.id]?.[x.subMemberId]
                    return (
                      <div key={x.id} className="kv" style={{ gridTemplateColumns: '1fr', marginBottom: 4 }}>
                        <span className={`badge purple`}>
                          {nameOf(x.subMemberId)} → {x.row === 0 ? '前排' : `第${x.row + 1}排`}{x.col + 1}号位
                        </span>
                        <span className="muted"> 顶替 {nameOf(x.absentMemberId)}（{x.reason}）</span>
                        {!x.attendedLastRehearsal && <span className="badge red" style={{ marginLeft: 6 }}>未参加最后排练</span>}
                        <span className={`badge ${arrived ? 'green' : 'gold'}`} style={{ marginLeft: 6 }}>{arrived ? '已到场' : '尚未到场'}</span>
                      </div>
                    )
                  })}
                </div>
                {role === 'costume' && tempCos.length > 0 && (
                  <div className="muted">候补服装：{tempCos.map((c) => `${nameOf(c.memberId)} ${c.size}码${c.pickedUp ? '（已发）' : '（待发）'}`).join('、')}</div>
                )}
                {role === 'sound' && (
                  <div className="muted">音响：按最新阵容执行（含替位站位），当前曲目 {p.musicVersions.find((v) => v.current)?.label ?? '未上传'}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3>候场顺序 <span className="sub">志愿者按此引导节目到候场区</span></h3>
            {queue.length === 0 && <div className="muted">暂无待演出节目（节目审查通过后进入候场队列）。</div>}
            {queue.map((p, i) => {
              const replacedAbsent = new Set(activeSubs(p).map((x) => x.absentMemberId))
              const performing = p.memberIds.filter((id) => !replacedAbsent.has(id))
              const arrived = performing.filter((id) => onsite[p.id]?.[id]).length
              return (
                <div key={p.id} className={`queue-item ${p.stage === 'showday' ? 'onstage' : ''}`}>
                  <div className="no">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <b>《{p.title}》</b>
                    <div className="muted">
                      {p.durationMin}分钟 · 实际参演 {performing.length}人{replacedAbsent.size > 0 && `（含替位 ${replacedAbsent.size} 人）`} · 已到 {arrived}/{performing.length}
                    </div>
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
                {p.memberIds.map((mid) => {
                  const m = members.find((x) => x.id === mid)!
                  const on = onsite[p.id]?.[mid]
                  const replacedBy = activeSubs(p).find((x) => x.absentMemberId === mid)
                  return (
                    <div key={mid} className="checkin-card"
                      style={on
                        ? { borderColor: 'var(--green)', background: 'var(--green-soft)' }
                        : replacedBy
                          ? { borderColor: 'var(--muted)', background: '#f7f4f0', opacity: 0.75 }
                          : undefined}>
                      <div className="nm">
                        {m.name}
                        {replacedBy && <span className="badge gray" style={{ marginLeft: 6 }}>已请假·由{nameOf(replacedBy.subMemberId)}替位</span>}
                      </div>
                      <div className="meta">{m.age}岁{m.healthNotes ? ` · ⚠${m.healthNotes.slice(0, 10)}` : ''}</div>
                      {replacedBy
                        ? <button className="btn sm" style={{ width: '100%', padding: '10px 0' }} disabled>不参演（替位已确认）</button>
                        : (
                          <button className={`btn ${on ? 'green' : ''}`} style={{ width: '100%', padding: '10px 0' }}
                            onClick={() => onsiteCheckin(p.id, mid)}>
                            {on ? '✓ 已到场' : '标记到场'}
                          </button>
                        )}
                    </div>
                  )
                })}
              </div>
              {role === 'sound' && (
                <div className="alert blue mt8">音响确认：{p.soundNeeds}；当前曲目 {p.musicVersions.find((v) => v.current)?.label ?? '未上传'}。</div>
              )}

              {/* 演出前检查：有替位时持续提示，直到逐项核对完成且替位队员到场 */}
              {activeSubs(p).length > 0 && (
                <div className="mt12" style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
                  {(() => {
                    const risks = riskySubs(p)
                    const subArrived = activeSubs(p).every((x) => onsite[p.id]?.[x.subMemberId])
                    const allChecked = CHECK_ITEMS.every((_, i) => checks[`${p.id}-${i}`])
                    const clear = subArrived && allChecked
                    return (
                      <>
                        <h3 style={{ fontSize: 15 }}>演出前检查（替位）</h3>
                        {risks.length > 0 && !clear && (
                          <div className="alert red sub-risk">
                            ⚠ {risks.map((x) => nameOf(x.subMemberId)).join('、')} 未参加最后一次排练（{risks[0].lastRehearsalDate}），
                            上场前请当面核对其走位与队形变化——以下检查未全部完成前，本提示持续显示。
                          </div>
                        )}
                        {CHECK_ITEMS.map((label, i) => {
                          const key = `${p.id}-${i}`
                          const on = !!checks[key]
                          return (
                            <label key={key} className="row" style={{ gap: 8, margin: '6px 0', cursor: canCheck ? 'pointer' : 'default' }}>
                              <input type="checkbox" checked={on} disabled={!canCheck} style={{ width: 18, height: 18 }}
                                onChange={() => setChecks((v) => ({ ...v, [key]: !v[key] }))} />
                              <span className={on ? '' : 'muted'}>{label}</span>
                            </label>
                          )
                        })}
                        {activeSubs(p).some((x) => !onsite[p.id]?.[x.subMemberId]) && (
                          <div className="alert gold mt8">替位队员尚未全部到场，请志愿者优先引导并在上方签到卡中标记。</div>
                        )}
                        {clear && <div className="alert green mt8">✓ 替位演出前检查已全部完成，替位队员已到场，可以候场。</div>}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          ))}
          {queue.length === 0 && (
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
