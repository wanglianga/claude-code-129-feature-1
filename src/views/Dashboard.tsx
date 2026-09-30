import { useStore, stageDone, absentSet, substitutionRisks, pendingLeaves } from '../store'
import { PIPELINE, STAGE_LABEL } from '../types'
import { useHelpers } from '../helpers'

export default function Dashboard() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const rehearsals = useStore((s) => s.rehearsals)
  const costumes = useStore((s) => s.costumes)
  const onsite = useStore((s) => s.onsite)
  const notices = useStore((s) => s.notices)
  const members = useStore((s) => s.members)
  const { teamOf, nameOf } = useHelpers()

  const urgent = notices.filter((n) => n.level === 'urgent')
  const sizeIssues = costumes.filter((c) => c.sizeIssue)
  const unpaid = costumes.filter((c) => !c.depositPaid && programs.some((p) => p.id === c.programId && p.stage !== 'archived'))

  // 演出前一天临时替位：未确认请假 + 未参加最后一次排练的替位风险（队长端持续提示）
  const subPrograms = programs.filter((p) => p.stage !== 'archived' &&
    (pendingLeaves(p).length > 0 || substitutionRisks(p).length > 0))

  return (
    <div>
      {/* 预警区 */}
      {urgent.length > 0 && urgent.map((n) => (
        <div key={n.id} className="alert red">⚠ {n.text}</div>
      ))}

      {/* 临时替位：队长端持续提示（未确认请假 / 替位未参加最后一次排练） */}
      {role === 'leader' && subPrograms.map((p) => (
        <div key={`sub-${p.id}`} className="alert red sub-risk">
          🚨 《{p.title}》演出前替位提醒：
          {pendingLeaves(p).map((l) => (
            <span key={l.id}> 前排 {nameOf(l.memberId)} 请假<b>尚未确认替位</b>，请到「走位编排」处理；</span>
          ))}
          {substitutionRisks(p).map((s) => (
            <span key={s.id}> 替位 {nameOf(s.subMemberId)} <b>未参加最后一次排练（{s.lastRehearsalDate}）</b>，
            顶替 {nameOf(s.absentMemberId)} 的{ s.row === 0 ? '前排' : `第${s.row + 1}排`}{s.col + 1}号位——风险持续提示中，演出前检查页同步提醒。</span>
          ))}
        </div>
      ))}

      <div className="grid3">
        <div className="card">
          <h3>在办节目</h3>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand)' }}>
            {programs.filter((p) => p.stage !== 'archived').length}
          </div>
          <div className="muted">含 {programs.filter((p) => p.isAudition).length} 个文艺汇演海选节目</div>
        </div>
        <div className="card">
          <h3>服装待处理</h3>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold)' }}>{sizeIssues.length + unpaid.length}</div>
          <div className="muted">{sizeIssues.length} 件尺码问题 · {unpaid.length} 人未交押金</div>
        </div>
        <div className="card">
          <h3>健康关注</h3>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)' }}>
            {members.filter((m) => m.age >= 65 || m.healthNotes).length}
          </div>
          <div className="muted">65岁以上或登记身体注意事项的队员</div>
        </div>
      </div>

      {/* 节目连续性链条 */}
      {programs.map((p) => {
        const done = stageDone(p, rehearsals, costumes, onsite)
        const absent = absentSet(rehearsals, p.id)
        const frontAbsent = [...absent.keys()].filter((id) => members.find((m) => m.id === id)?.frontRow)
        const curIdx = PIPELINE.indexOf(p.stage)
        const broken = p.stage !== 'archived' && PIPELINE.slice(0, curIdx).some((st) => !done[st])
        return (
          <div className="card" key={p.id}>
            <div className="spread">
              <h3>
                《{p.title}》
                <span className="sub">{teamOf(p)} · {p.type} · {p.theme} · {p.durationMin}分钟 · 演出 {p.showDate}</span>
              </h3>
              <span className={`badge ${p.stage === 'archived' ? 'gray' : 'brand'}`}>{STAGE_LABEL[p.stage]}</span>
            </div>

            {/* 文化站关心的连续链条 */}
            <div className="chain">
              {PIPELINE.map((st, i) => {
                const ok = done[st]
                const isCurrent = p.stage === st
                const cls = isCurrent ? 'node current' : ok ? 'node done' : 'node'
                return (
                  <span key={st} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span className={cls} title={ok ? '已完成' : '待完成'}>
                      {ok ? '✓ ' : ''}{STAGE_LABEL[st]}
                    </span>
                    {i < PIPELINE.length - 1 && <span className="arrow">→</span>}
                  </span>
                )
              })}
            </div>
            {!broken && <div className="muted">链条连续，各环节记录完整。</div>}
            {broken && <div className="alert gold mt8">链条存在断档：当前阶段之前有环节未完成，请补齐记录后继续推进。</div>}

            <div className="row mt8">
              <span className="muted">场地：{p.venue}</span>
              <span className={`badge ${p.venueApproval === 'approved' ? 'green' : p.venueApproval === 'pending' ? 'gold' : 'red'}`}>
                场地{ p.venueApproval === 'approved' ? '已审批' : p.venueApproval === 'pending' ? '待审批' : '未通过'}
              </span>
              {p.isAudition && <span className="badge blue">文艺汇演海选</span>}
              {p.musicVersions.some((v) => v.current) && (
                <span className="muted">曲目：{p.musicVersions.find((v) => v.current)?.label}</span>
              )}
            </div>

            {/* 队长快速发现缺席影响的站位 */}
            {frontAbsent.length > 0 && p.stage !== 'archived' && (
              <div className="alert red mt8">
                前排缺席影响站位：{frontAbsent.map((id) => nameOf(id)).join('、')}
                （最近排练{absent.get(frontAbsent[0]) === 'leave' ? '请假' : '未到'}），请尽快安排替补或调整队形。
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
