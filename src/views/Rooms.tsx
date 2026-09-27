import { useState } from 'react'
import { useStore } from '../store'

const SLOTS = ['周一 19:00–20:30', '周二 19:00–20:30', '周三 19:00–20:30', '周四 19:00–20:30', '周五 19:00–20:30', '周六 09:00–11:00', '周日 09:00–11:00']

export default function Rooms() {
  const rooms = useStore((s) => s.rooms)
  const bookings = useStore((s) => s.bookings)
  const teams = useStore((s) => s.teams)
  const bookRoom = useStore((s) => s.bookRoom)
  const cancelBooking = useStore((s) => s.cancelBooking)

  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [date, setDate] = useState('2026-10-06')
  const [slot, setSlot] = useState(SLOTS[0])
  const [purpose, setPurpose] = useState('')
  const [err, setErr] = useState('')

  const sorted = [...bookings].sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot))

  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h3>排练室预订 <span className="sub">多支队伍共用，冲突自动拦截</span></h3>
        <div className="form-row">
          <label className="fld">排练室
            <select className="inp" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="fld">使用队伍
            <select className="inp" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label className="fld">日期<input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="fld">时段
            <select className="inp" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="fld">用途<input className="inp" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="如：《丰收锣鼓》队形合练" /></label>
        {err && <div className="alert red">{err}</div>}
        <button className="btn primary" onClick={() => {
          const e = bookRoom(roomId, teamId, date, slot, purpose.trim() || '排练')
          setErr(e ?? '')
          if (!e) setPurpose('')
        }}>提交预订</button>
      </div>

      <div className="card">
        <h3>排期一览</h3>
        <table className="tbl">
          <thead><tr><th>日期</th><th>时段</th><th>排练室</th><th>队伍</th><th>用途</th><th></th></tr></thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id}>
                <td>{b.date}</td>
                <td style={{ fontSize: 13 }}>{b.timeSlot}</td>
                <td>{rooms.find((r) => r.id === b.roomId)?.name.replace('文化活动中心·', '')}</td>
                <td><b>{teams.find((t) => t.id === b.teamId)?.name}</b></td>
                <td style={{ fontSize: 13 }}>{b.purpose}</td>
                <td><button className="btn sm danger" onClick={() => cancelBooking(b.id)}>取消</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
