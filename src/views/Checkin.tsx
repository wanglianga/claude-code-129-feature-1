import { useState } from 'react'
import { useStore } from '../store'
import type { CheckinStatus } from '../types'
import { useHelpers } from '../helpers'

export default function Checkin() {
  const programs = useStore((s) => s.programs)
  const rehearsals = useStore((s) => s.rehearsals)
  const members = useStore((s) => s.members)
  const rooms = useStore((s) => s.rooms)
  const checkin = useStore((s) => s.checkin)
  const setRehearsalNote = useStore((s) => s.setRehearsalNote)
  const addRehearsal = useStore((s) => s.addRehearsal)
  const uploadMusicVersion = useStore((s) => s.uploadMusicVersion)
  const toggleFocusMember = useStore((s) => s.toggleFocusMember)
  const { nameOf } = useHelpers()

  const active = programs.filter((p) => p.stage !== 'archived' && p.stage !== 'signup')
  const [pid, setPid] = useState(active[0]?.id ?? '')
  const program = programs.find((p) => p.id === pid) ?? active[0]
  const myRehearsals = rehearsals.filter((r) => r.programId === program?.id)
  const [rid, setRid] = useState(myRehearsals[myRehearsals.length - 1]?.id ?? '')
  const rehearsal = myRehearsals.find((r) => r.id === rid) ?? myRehearsals[myRehearsals.length - 1]

  const [label, setLabel] = useState('')
  const [fileName, setFileName] = useState('')
  const [note, setNote] = useState('')

  if (!program) return <div className="card">暂无排练中的节目，请先在「节目报名」发布并推进阶段。</div>

  const counts = { present: 0, leave: 0, absent: 0 }
  if (rehearsal) Object.values(rehearsal.checkins).forEach((s) => { counts[s]++ })
  const elderly = program.memberIds.map((id) => members.find((m) => m.id === id)!).filter((m) => m && (m.age >= 65 || m.healthNotes))

  return (
    <div>
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>排练签到（平板模式）</h3>
          <select className="inp" style={{ width: 'auto' }} value={program.id} onChange={(e) => { setPid(e.target.value); setRid('') }}>
            {active.map((p) => <option key={p.id} value={p.id}>《{p.title}》</option>)}
          </select>
          <select className="inp" style={{ width: 'auto' }} value={rehearsal?.id ?? ''} onChange={(e) => setRid(e.target.value)}>
            {myRehearsals.map((r) => <option key={r.id} value={r.id}>{r.date} {r.timeSlot}</option>)}
          </select>
          <button className="btn sm" onClick={() => {
            const d = prompt('排练日期（如 2026-10-05）')
            if (d) addRehearsal(program.id, 'room1', d, '19:00–20:30')
          }}>+ 新排练场次</button>
          {rehearsal && (
            <span className="row" style={{ marginLeft: 'auto' }}>
              <span className="badge green">出勤 {counts.present}</span>
              <span className="badge gold">请假 {counts.leave}</span>
              <span className="badge red">缺席 {counts.absent}</span>
            </span>
          )}
        </div>
      </div>

      {elderly.length > 0 && (
        <div className="alert gold">
          老年队员健康提醒：{elderly.map((m) => `${m.name}（${m.age}岁${m.healthNotes ? '，' + m.healthNotes : ''}）`).join('；')}。请控制连续排练时长，必要时安排休息。
        </div>
      )}

      {rehearsal && (
        <>
          <div className="checkin-grid">
            {program.memberIds.map((mid) => {
              const m = members.find((x) => x.id === mid)!
              const st = rehearsal.checkins[mid]
              const btn = (s: CheckinStatus, label: string, cls: string) => (
                <button key={s} className={`btn ${st === s ? cls : ''}`} onClick={() => checkin(rehearsal.id, mid, s)}>{label}</button>
              )
              return (
                <div className="checkin-card" key={mid}>
                  <div className="nm">{m.name} {m.frontRow && <span className="badge gold">前排</span>}</div>
                  <div className="meta">{m.age}岁{m.healthNotes ? ` · ⚠ ${m.healthNotes}` : ''}</div>
                  <div className="checkin-btns">
                    {btn('present', '出勤', 'on-present')}
                    {btn('leave', '请假', 'on-leave')}
                    {btn('absent', '缺席', 'on-absent')}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card mt12">
            <h3>排练备注（请假原因、突发情况等）</h3>
            <textarea className="inp" rows={2} defaultValue={rehearsal.note} key={rehearsal.id}
              onBlur={(e) => setRehearsalNote(rehearsal.id, e.target.value)}
              placeholder="如：张桂芳膝盖复查请假，前排需临时补位…" />
          </div>
        </>
      )}

      <div className="grid2 mt12">
        <div className="card">
          <h3>曲目版本 <span className="sub">上传新版本自动通知音响师替换</span></h3>
          {program.musicVersions.map((v) => (
            <div key={v.id} className="row mb8">
              <span className={`badge ${v.current ? 'green' : 'gray'}`}>{v.current ? '当前' : '历史'}</span>
              <b>{v.label}</b>
              <span className="muted">{v.fileName} · {v.uploadedBy} · {v.uploadedAt}</span>
            </div>
          ))}
          <div className="form-row mt8">
            <label className="fld">版本说明<input className="inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如：V4 审核修改版 3′50″" /></label>
            <label className="fld">文件名<input className="inp" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="如：丰收锣鼓_V4.mp3" /></label>
          </div>
          <label className="fld">备注<input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="修改原因，如：按文化站意见精简鼓点" /></label>
          <button className="btn primary" disabled={!label.trim() || !fileName.trim()} onClick={() => {
            uploadMusicVersion(program.id, label.trim(), fileName.trim(), note.trim(), '队长')
            setLabel(''); setFileName(''); setNote('')
          }}>上传新版本</button>
        </div>

        <div className="card">
          <h3>动作分段与重点练习成员 <span className="sub">点击队员名标记/取消</span></h3>
          {program.segments.length === 0 && <div className="muted">尚未设置动作分段。</div>}
          {program.segments.map((seg) => (
            <div key={seg.id} className="mb8" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 8 }}>
              <div className="spread">
                <b>{seg.name}</b>
                <span className="muted">{seg.range}</span>
              </div>
              <div className="unplaced mt8">
                {program.memberIds.map((mid) => (
                  <button key={mid}
                    className="chip"
                    style={seg.focusMemberIds.includes(mid) ? { background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' } : undefined}
                    onClick={() => toggleFocusMember(program.id, seg.id, mid)}>
                    {nameOf(mid)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
