import { useStore, stageDone, absentSet, riskySubs, activeSubs } from '../store'
import { PIPELINE, STAGE_LABEL, type Role } from '../types'
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

  const urgent = notices.filter((n) => n.level === 'urgent' && n.targets.includes(role))
  const sizeIssues = costumes.filter((c) => c.sizeIssue)
  const unpaid = costumes.filter((c) => !c.depositPaid && programs.some((p) => p.id === c.programId && p.stage !== 'archived'))
  const temporaryCostumes = costumes.filter((c) => c.temporary)
  const allRiskySubs = programs.flatMap((p) => riskySubs(p).map((x) => ({ p, x })))
  const allActiveSubs = programs.flatMap((p) => activeSubs(p).map((x) => ({ p, x })))

  return (
    <div>
      {/* 替位风险：队长端持续提示（未参加最后一次排练） */}
      {role === 'leader' && allRiskySubs.length > 0 && (
        <div className="alert red sub-risk">
          ⚠ 替位风险未解除：{allRiskySubs.map(({ p, x }) =>
            `《${p.title}》${nameOf(x.subMemberId)}顶替${nameOf(x.absentMemberId)}（未参加 ${x.lastRehearsalDate} 最后一次排练）`).join('；')}。
          请演出前补排走位与队形变化，并在「演出当天」演出前检查中核对到场——检查通过前提示持续存在。
        </div>
      )}

      {/* 已更新的演出清单（替位/服装/音响等角色均可见） */}
      {allActiveSubs.length > 0 && (['leader', 'member', 'costume', 'sound'] as Role[]).includes(role) && (
        <div className="alert blue">
          演出清单已按临时替位更新：{allActiveSubs.map(({ p, x }) =>
            `《${p.title}》${nameOf(x.subMemberId)}→${x.row === 0 ? '前排' : `第${x.row + 1}排`}${x.col + 1}号位（替 ${nameOf(x.absentMemberId)}）`).join('；')}。
          {role === 'costume' && '请为替位队员准备临时候补服装（押金免收、演出后回收）。'}
          {role === 'sound' && '请按更新后的人员与曲目执行，候场播报以最新清单为准。'}
          {role === 'member' && '请相关队员按新走位图参加重点排练。'}
        </div>
      )}

      {/* 预警区 */}
      {urgent.length > 0 && urgent.map((n) => (
        <div key={n.id} className="alert red">⚠ {n.text}</div>
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
        const pSubs = activeSubs(p)
        const pRisks = riskySubs(p)
        const covered = new Set(pSubs.map((x) => x.absentMemberId))
        const frontAbsent = [...absent.keys()].filter((id) => members.find((m) => m.id === id)?.frontRow && !covered.has(id))
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
                （最近排练{absent.get(frontAbsent[0]) === 'leave' ? '请假' : '未到'}），请尽快在「走位编排」安排临时替位或调整队形。
              </div>
            )}

            {/* 临时替位状态 */}
            {pSubs.length > 0 && p.stage !== 'archived' && (
              <div className={`alert ${pRisks.length > 0 ? 'red' : 'green'} mt8`}>
                临时替位已确认：{pSubs.map((x) =>
                  `${nameOf(x.subMemberId)} 顶替 ${nameOf(x.absentMemberId)}（${x.row === 0 ? '前排' : `第${x.row + 1}排`}${x.col + 1}号位）`).join('；')}。
                新走位图、重点排练名单已生成，服装/音响/替位队员的演出清单已更新。
                {pRisks.length > 0 && ` 风险：${pRisks.map((x) => nameOf(x.subMemberId)).join('、')} 未参加最后一次排练，演出前检查将持续提示。`}
              </div>
            )}
            {temporaryCostumes.filter((c) => c.programId === p.id).length > 0 && role === 'costume' && (
              <div className="alert gold mt8">
                临时候补服装待备：{temporaryCostumes.filter((c) => c.programId === p.id)
                  .map((c) => `${nameOf(c.memberId)}（${c.size}码）`).join('、')}，免收押金、演出后回收。
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
