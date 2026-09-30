import { useState } from 'react'
import { useStore, healthWatch } from '../store'
import { ROLE_LABEL, type Role } from '../types'

const KIND_LABEL: Record<string, string> = {
  general: '一般', health: '健康提醒', venue: '场地', costume: '服装', live: '现场', next: '下次活动', substitution: '临时替位',
}

export default function Notices() {
  const role = useStore((s) => s.role)
  const notices = useStore((s) => s.notices)
  const members = useStore((s) => s.members)
  const programs = useStore((s) => s.programs)
  const addNotice = useStore((s) => s.addNotice)

  const [text, setText] = useState('')
  const [urgent, setUrgent] = useState(false)

  const mine = [...notices]
    .filter((n) => n.targets.includes(role))
    .sort((a, b) => b.at.localeCompare(a.at))
  const watch = healthWatch(members)
  const canPublish = role === 'leader' || role === 'culture'

  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div>
        {canPublish && (
          <div className="card">
            <h3>发布通知</h3>
            <textarea className="inp" rows={2} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="通知内容，如：明晚排练提前半小时开始" />
            <div className="row mt8">
              <label className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} style={{ width: 18, height: 18 }} />
                紧急
              </label>
              <button className="btn primary" disabled={!text.trim()} onClick={() => {
                addNotice(text.trim(), urgent ? 'urgent' : 'info', ['leader', 'member', 'costume', 'culture', 'sound', 'volunteer'], 'general', null)
                setText(''); setUrgent(false)
              }}>发布给全部角色</button>
            </div>
          </div>
        )}

        <div className="card">
          <h3>我的通知 <span className="sub">按当前角色（{ROLE_LABEL[role]}）过滤</span></h3>
          {mine.length === 0 && <div className="muted">暂无通知。</div>}
          {mine.map((n) => (
            <div key={n.id} className={`notice ${n.level === 'urgent' ? 'urgent' : ''} ${n.kind === 'health' ? 'health' : ''}`}>
              <div>
                <span className={`badge ${n.level === 'urgent' ? 'red' : 'blue'}`} style={{ marginRight: 8 }}>{KIND_LABEL[n.kind]}</span>
                {n.programId && <span className="muted">《{programs.find((p) => p.id === n.programId)?.title}》 </span>}
                {n.text}
              </div>
              <div className="meta">{n.at} · 面向：{n.targets.map((t) => ROLE_LABEL[t]).join('、')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>老年队员健康提醒 <span className="sub">65岁以上或登记身体注意事项</span></h3>
        <table className="tbl">
          <thead><tr><th>队员</th><th>年龄</th><th>注意事项</th><th>提醒</th></tr></thead>
          <tbody>
            {watch.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b></td>
                <td>{m.age}{m.age >= 65 && <span className="badge gold" style={{ marginLeft: 4 }}>高龄</span>}</td>
                <td style={{ color: m.healthNotes ? 'var(--red)' : undefined }}>{m.healthNotes || '—'}</td>
                <td style={{ fontSize: 13 }}>
                  {m.healthNotes.includes('血压') || m.healthNotes.includes('心脏') || m.healthNotes.includes('冠心')
                    ? '排练前测血压，避免剧烈段落连续重复'
                    : m.healthNotes.includes('膝') || m.healthNotes.includes('腰')
                      ? '避免久蹲久站，分段之间安排坐位休息'
                      : m.healthNotes.includes('低血糖')
                        ? '随身备糖果，排练间隔补充能量'
                        : '注意补水与休息'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="alert gold mt12">演出当天请志愿者重点关注高龄队员上下台安全，必要时安排家属陪同。</div>
      </div>
    </div>
  )
}
