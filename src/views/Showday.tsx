import { useState } from 'react'
import { useStore } from '../store'
import { useHelpers } from '../helpers'

export default function Showday() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const members = useStore((s) => s.members)
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

  return (
    <div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3>候场顺序 <span className="sub">志愿者按此引导节目到候场区</span></h3>
            {queue.length === 0 && <div className="muted">暂无待演出节目（节目审查通过后进入候场队列）。</div>}
            {queue.map((p, i) => {
              const arrived = Object.values(onsite[p.id] ?? {}).filter(Boolean).length
              return (
                <div key={p.id} className={`queue-item ${p.stage === 'showday' ? 'onstage' : ''}`}>
                  <div className="no">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <b>《{p.title}》</b>
                    <div className="muted">{p.durationMin}分钟 · {p.memberIds.length}人 · 已到 {arrived}/{p.memberIds.length}</div>
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
                  return (
                    <div key={mid} className="checkin-card" style={on ? { borderColor: 'var(--green)', background: 'var(--green-soft)' } : undefined}>
                      <div className="nm">{m.name}</div>
                      <div className="meta">{m.age}岁{m.healthNotes ? ` · ⚠${m.healthNotes.slice(0, 10)}` : ''}</div>
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
