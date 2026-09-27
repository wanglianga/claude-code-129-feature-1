import { useState } from 'react'
import { useStore } from '../store'
import { useHelpers } from '../helpers'

const EMOJIS = ['📸', '💃', '🥁', '🎭', '👗', '🎉', '🏮', '🌸']

export default function Archive() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const rehearsals = useStore((s) => s.rehearsals)
  const costumes = useStore((s) => s.costumes)
  const formationLogs = useStore((s) => s.formationLogs)
  const photos = useStore((s) => s.photos)
  const notices = useStore((s) => s.notices)
  const addPhoto = useStore((s) => s.addPhoto)
  const { nameOf } = useHelpers()

  const archived = programs.filter((p) => p.stage === 'archived')
  const [pid, setPid] = useState(archived[0]?.id ?? '')
  const program = archived.find((p) => p.id === pid) ?? archived[0]
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [caption, setCaption] = useState('')

  if (!program) return <div className="card">暂无已归档的演出。演出结束后，签到、服装归还、走位调整、现场照片与下次活动通知会保留在这里。</div>

  const myRehearsals = rehearsals.filter((r) => r.programId === program.id)
  const myCostumes = costumes.filter((c) => c.programId === program.id)
  const myLogs = formationLogs.filter((l) => l.programId === program.id)
  const myPhotos = photos.filter((p) => p.programId === program.id)
  const nextNotices = notices.filter((n) => n.kind === 'next')

  return (
    <div>
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>演出档案</h3>
          <select className="inp" style={{ width: 'auto' }} value={program.id} onChange={(e) => setPid(e.target.value)}>
            {archived.map((p) => <option key={p.id} value={p.id}>《{p.title}》 {p.showDate}</option>)}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div>
          <div className="card">
            <h3>签到记录</h3>
            {myRehearsals.map((r) => {
              const present = Object.values(r.checkins).filter((s) => s === 'present').length
              const total = Object.keys(r.checkins).length
              return (
                <div key={r.id} className="spread mb8">
                  <span>{r.date} {r.timeSlot}</span>
                  <span className="badge green">{present}/{total} 出勤</span>
                </div>
              )
            })}
            {myRehearsals.length === 0 && <div className="muted">无签到记录。</div>}
          </div>

          <div className="card">
            <h3>服装归还</h3>
            <table className="tbl">
              <tbody>
                {myCostumes.map((c) => (
                  <tr key={c.memberId}>
                    <td><b>{nameOf(c.memberId)}</b></td>
                    <td>{c.size}码</td>
                    <td>{c.returned ? <span className="badge green">已归还 · 押金已退</span> : <span className="badge red">未归还</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>走位调整记录</h3>
            {myLogs.length === 0 && <div className="muted">无调整记录。</div>}
            {myLogs.map((l) => (
              <div className="notice" key={l.id}>{l.text}<div className="meta">{l.at}</div></div>
            ))}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>现场照片</h3>
            <div className="photos">
              {myPhotos.map((ph) => (
                <div className="photo" key={ph.id}>
                  <div className="img">{ph.emoji}</div>
                  <div className="cap">{ph.caption}<br />{ph.at}</div>
                </div>
              ))}
            </div>
            {role === 'leader' && (
              <div className="row mt12">
                <select className="inp" style={{ width: 80 }} value={emoji} onChange={(e) => setEmoji(e.target.value)}>
                  {EMOJIS.map((e) => <option key={e}>{e}</option>)}
                </select>
                <input className="inp" style={{ flex: 1 }} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="照片说明" />
                <button className="btn primary" disabled={!caption.trim()} onClick={() => { addPhoto(program.id, emoji, caption.trim()); setCaption('') }}>补传照片</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>下次活动通知</h3>
            {nextNotices.length === 0 && <div className="muted">暂无下次活动安排。</div>}
            {nextNotices.map((n) => (
              <div className="notice health" key={n.id}>{n.text}<div className="meta">{n.at}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
