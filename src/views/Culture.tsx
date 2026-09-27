import { useState } from 'react'
import { useStore, stageDone } from '../store'
import { PIPELINE, STAGE_LABEL } from '../types'
import { useHelpers } from '../helpers'

export default function Culture() {
  const programs = useStore((s) => s.programs)
  const rehearsals = useStore((s) => s.rehearsals)
  const costumes = useStore((s) => s.costumes)
  const onsite = useStore((s) => s.onsite)
  const rooms = useStore((s) => s.rooms)
  const bookings = useStore((s) => s.bookings)
  const teams = useStore((s) => s.teams)
  const reviewProgram = useStore((s) => s.reviewProgram)
  const setVenueApproval = useStore((s) => s.setVenueApproval)
  const shrinkVenue = useStore((s) => s.shrinkVenue)
  const { teamOf } = useHelpers()

  const [comment, setComment] = useState<Record<string, string>>({})
  const [venueNote, setVenueNote] = useState('')
  const [shrink, setShrink] = useState('6')

  const active = programs.filter((p) => p.stage !== 'archived')
  const archived = programs.filter((p) => p.stage === 'archived')

  return (
    <div>
      <div className="alert blue">
        文化站工作台：查看每个节目的主题、人数、时长、音响需求，办理场地审批与节目审查；
        下方链条可检查节目从报名→排练→走位→服装→审核→现场签到是否连续。
      </div>

      {active.map((p) => {
        const done = stageDone(p, rehearsals, costumes, onsite)
        const curIdx = PIPELINE.indexOf(p.stage)
        const broken = PIPELINE.slice(0, curIdx).some((st) => !done[st])
        const lastReview = p.reviews[p.reviews.length - 1]
        return (
          <div className="card" key={p.id}>
            <div className="spread">
              <h3>《{p.title}》<span className="sub">{teamOf(p)} · {p.type} · {STAGE_LABEL[p.stage]}</span></h3>
              <div className="row">
                {p.isAudition && <span className="badge blue">文艺汇演海选</span>}
                <span className={`badge ${p.venueApproval === 'approved' ? 'green' : p.venueApproval === 'pending' ? 'gold' : 'red'}`}>
                  场地{ p.venueApproval === 'approved' ? '已审批' : p.venueApproval === 'pending' ? '待审批' : '未通过'}
                </span>
              </div>
            </div>

            <dl className="kv">
              <dt>节目主题</dt><dd>{p.theme}</dd>
              <dt>演出人数</dt><dd>{p.memberIds.length} 人</dd>
              <dt>节目时长</dt><dd>{p.durationMin} 分钟</dd>
              <dt>音响需求</dt><dd>{p.soundNeeds}</dd>
              <dt>演出场地</dt><dd>{p.venue}（{p.venueNote}）</dd>
              <dt>演出时间</dt><dd>{p.showDate}</dd>
              <dt>当前曲目</dt><dd>{p.musicVersions.find((v) => v.current)?.label ?? '未上传'}</dd>
            </dl>

            <div className="chain mt12">
              {PIPELINE.map((st, i) => (
                <span key={st} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span className={p.stage === st ? 'node current' : done[st] ? 'node done' : 'node'}>
                    {done[st] ? '✓ ' : ''}{STAGE_LABEL[st]}
                  </span>
                  {i < PIPELINE.length - 1 && <span className="arrow">→</span>}
                </span>
              ))}
            </div>
            {broken ? <div className="alert red">链条不连续：存在未完成的前置环节。</div>
                    : <div className="alert green" style={{ marginBottom: 0 }}>链条连续。</div>}

            {/* 场地审批 */}
            <div className="mt12 row">
              <input className="inp" style={{ flex: 1 }} placeholder="审批意见 / 场地说明（如舞台尺寸变化）"
                value={venueNote} onChange={(e) => setVenueNote(e.target.value)} />
              <button className="btn green" onClick={() => setVenueApproval(p.id, true, venueNote.trim() || '审批通过')}>批准场地</button>
              <button className="btn danger" onClick={() => setVenueApproval(p.id, false, venueNote.trim() || '暂不批准')}>不予批准</button>
            </div>
            <div className="row mt8">
              <span className="muted">演出场地缩小时通知队形调整：压缩为</span>
              <input className="inp" style={{ width: 80 }} type="number" value={shrink} onChange={(e) => setShrink(e.target.value)} />
              <span className="muted">列</span>
              <button className="btn sm" onClick={() => shrinkVenue(p.id, shrink)}>下发场地缩小通知</button>
            </div>

            {/* 节目审查 */}
            <div className="mt12" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
              <h3 style={{ fontSize: 15 }}>节目审查 {lastReview && <span className="sub">上次意见：{lastReview.result === 'approved' ? '通过' : lastReview.result === 'changes_requested' ? '要求调整' : '不通过'} — {lastReview.comment}</span>}</h3>
              <textarea className="inp" rows={2} placeholder="审查意见（如：第3分钟鼓点过密建议精简；服装颜色须与国庆主题一致）"
                value={comment[p.id] ?? ''} onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })} />
              <div className="row mt8">
                <button className="btn green" onClick={() => { reviewProgram(p.id, 'approved', (comment[p.id] ?? '').trim() || '通过', '文化站·陈老师'); }}>审查通过</button>
                <button className="btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                  onClick={() => reviewProgram(p.id, 'changes_requested', (comment[p.id] ?? '').trim() || '请按要求调整节目内容', '文化站·陈老师')}>
                  要求调整节目内容
                </button>
                <button className="btn danger" onClick={() => reviewProgram(p.id, 'rejected', (comment[p.id] ?? '').trim() || '不通过', '文化站·陈老师')}>不通过</button>
                <span className="muted">「要求调整」会把节目退回排练阶段并通知队长，调整后重新报审。</span>
              </div>
            </div>
          </div>
        )
      })}

      {/* 排练室共用一览 */}
      <div className="card">
        <h3>排练室共用排期（多支队伍）</h3>
        <table className="tbl">
          <thead><tr><th>日期</th><th>时段</th><th>排练室</th><th>队伍</th><th>用途</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.date}</td><td>{b.timeSlot}</td>
                <td>{rooms.find((r) => r.id === b.roomId)?.name}</td>
                <td>{teams.find((t) => t.id === b.teamId)?.name}</td>
                <td>{b.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {archived.length > 0 && (
        <div className="card">
          <h3>已完成演出归档</h3>
          {archived.map((p) => (
            <span key={p.id} className="badge gray" style={{ marginRight: 8, fontSize: 14, padding: '6px 14px' }}>
              《{p.title}》· {p.showDate}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
