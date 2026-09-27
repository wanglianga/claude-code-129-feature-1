import { useState } from 'react'
import { useStore } from '../store'
import { SIZES, STAGE_LABEL, type CostumeSize, type Member, type ProgramType } from '../types'
import { useHelpers } from '../helpers'

const PROGRAM_TYPES: ProgramType[] = ['广场舞', '民族舞', '合唱伴舞', '节庆演出']
const ALL_SLOTS = ['周一晚', '周二晚', '周三晚', '周四晚', '周五晚', '周末上午', '周末下午']

export default function Signup() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const members = useStore((s) => s.members)
  const enrollments = useStore((s) => s.enrollments)
  const teams = useStore((s) => s.teams)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const publishProgram = useStore((s) => s.publishProgram)
  const enroll = useStore((s) => s.enroll)
  const advanceStage = useStore((s) => s.advanceStage)
  const { teamOf } = useHelpers()

  const [pid, setPid] = useState(programs[0]?.id ?? '')
  const program = programs.find((p) => p.id === pid) ?? programs[0]

  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div>
        {role === 'leader' && <PublishForm onPublish={(p, teamId) => publishProgram(p, teamId)} teams={teams} />}

        <div className="card">
          <h3>节目列表</h3>
          {programs.map((p) => (
            <div key={p.id} className={`queue-item ${program?.id === p.id ? 'onstage' : ''}`}
              style={{ cursor: 'pointer' }} onClick={() => setPid(p.id)}>
              <div className="no" style={{ background: p.isAudition ? 'var(--blue)' : 'var(--brand)', width: 34, height: 34, fontSize: 15 }}>
                {p.type[0]}
              </div>
              <div style={{ flex: 1 }}>
                <b>《{p.title}》</b>
                <div className="muted">{teamOf(p)} · {p.theme} · {p.memberIds.length}人 · {p.durationMin}分钟</div>
              </div>
              {p.isAudition && <span className="badge blue">海选</span>}
              <span className="badge gray">{STAGE_LABEL[p.stage]}</span>
            </div>
          ))}
        </div>
      </div>

      {program && (
        <div className="card">
          <h3>
            《{program.title}》报名情况
            <span className="sub">{program.type} · 已报 {program.memberIds.length} 人</span>
          </h3>

          {role === 'leader' && program.stage !== 'archived' && (
            <div className="row mb8">
              <button className="btn primary sm" onClick={() => advanceStage(program.id)}>
                推进到下一阶段（当前：{STAGE_LABEL[program.stage]}）
              </button>
            </div>
          )}

          <table className="tbl">
            <thead>
              <tr><th>队员</th><th>年龄</th><th>联系方式</th><th>服装尺码</th><th>可排练时间</th><th>正式演出</th><th>身体注意事项</th></tr>
            </thead>
            <tbody>
              {enrollments.filter((e) => e.programId === program.id).map((e) => {
                const m = members.find((x) => x.id === e.memberId)!
                return (
                  <tr key={e.memberId}>
                    <td><b>{m.name}</b>{m.frontRow && <span className="badge gold" style={{ marginLeft: 6 }}>前排</span>}</td>
                    <td>{m.age}</td>
                    <td>{m.phone}</td>
                    <td>{e.costumeSize}</td>
                    <td style={{ fontSize: 13 }}>{e.availableSlots.join('、')}</td>
                    <td>{e.joinFormal ? <span className="badge green">参加</span> : <span className="badge gray">只排练</span>}</td>
                    <td style={{ color: e.healthNotes ? 'var(--red)' : undefined }}>{e.healthNotes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {program.stage === 'signup' && <EnrollForm
            key={program.id}
            programId={program.id}
            defaultMember={role === 'member' ? currentMemberId : members.filter((m) => m.teamId === program.teamId && !program.memberIds.includes(m.id))[0]?.id}
            lockMember={role === 'member'}
            memberOptions={members.filter((m) => m.teamId === program.teamId)}
            onEnroll={enroll}
          />}
        </div>
      )}
    </div>
  )
}

function PublishForm({ onPublish, teams }: {
  onPublish: (p: any, teamId: string) => void
  teams: { id: string; name: string }[]
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ProgramType>('广场舞')
  const [theme, setTheme] = useState('')
  const [duration, setDuration] = useState(4)
  const [soundNeeds, setSoundNeeds] = useState('')
  const [showDate, setShowDate] = useState('')
  const [isAudition, setIsAudition] = useState(false)
  const [teamId, setTeamId] = useState(teams[0]?.id ?? 't1')

  return (
    <div className="card">
      <h3>队长发布报名</h3>
      <div className="form-row">
        <label className="fld">节目名称<input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：丰收锣鼓" /></label>
        <label className="fld">节目类型
          <select className="inp" value={type} onChange={(e) => setType(e.target.value as ProgramType)}>
            {PROGRAM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="fld">节目主题<input className="inp" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="如：庆丰收·迎国庆" /></label>
        <label className="fld">时长（分钟）<input className="inp" type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
      </div>
      <label className="fld">音响需求<input className="inp" value={soundNeeds} onChange={(e) => setSoundNeeds(e.target.value)} placeholder="麦克风数量、伴奏格式、特殊设备…" /></label>
      <div className="form-row">
        <label className="fld">演出日期<input className="inp" value={showDate} onChange={(e) => setShowDate(e.target.value)} placeholder="如：2026-10-01 19:00" /></label>
        <label className="fld">所属队伍
          <select className="inp" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <label className="fld" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={isAudition} onChange={(e) => setIsAudition(e.target.checked)} style={{ width: 18, height: 18 }} />
        作为社区文艺汇演海选节目报名（待统一安排场地与审查）
      </label>
      <button className="btn primary" disabled={!title.trim()} onClick={() => {
        onPublish({ title: title.trim(), type, theme: theme.trim() || '待补充', durationMin: duration, soundNeeds: soundNeeds.trim() || '待补充', isAudition, showDate: showDate.trim() || '待定' }, teamId)
        setTitle(''); setTheme(''); setSoundNeeds(''); setShowDate('')
      }}>发布报名</button>
    </div>
  )
}

function EnrollForm({ programId, defaultMember, lockMember, memberOptions, onEnroll }: {
  programId: string
  defaultMember?: string
  lockMember: boolean
  memberOptions: Member[]
  onEnroll: (programId: string, memberId: string, size: CostumeSize, joinFormal: boolean, healthNotes: string, slots: string[]) => void
}) {
  const [memberId, setMemberId] = useState(defaultMember ?? '')
  const [size, setSize] = useState<CostumeSize>('M')
  const [joinFormal, setJoinFormal] = useState(true)
  const [health, setHealth] = useState('')
  const [slots, setSlots] = useState<string[]>([])

  const selected = memberOptions.find((m) => m.id === memberId)

  return (
    <div className="card" style={{ background: '#fcfaf6', marginTop: 12 }}>
      <h3>{lockMember ? '我要报名' : '代队员补充报名'}</h3>
      <div className="form-row">
        <label className="fld">队员
          <select className="inp" value={memberId} disabled={lockMember} onChange={(e) => {
            setMemberId(e.target.value)
            const m = memberOptions.find((x) => x.id === e.target.value)
            setHealth(m?.healthNotes ?? '')
            setSlots(m?.availableSlots ?? [])
          }}>
            <option value="">请选择…</option>
            {memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}{m.age ? `（${m.age}岁）` : ''}</option>)}
          </select>
        </label>
        <label className="fld">服装尺码
          <select className="inp" value={size} onChange={(e) => setSize(e.target.value as CostumeSize)}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="fld">可排练时间（可多选）
        <div className="row mt8">
          {ALL_SLOTS.map((sl) => (
            <button key={sl} type="button" className={`btn sm ${slots.includes(sl) ? 'primary' : ''}`}
              onClick={() => setSlots(slots.includes(sl) ? slots.filter((x) => x !== sl) : [...slots, sl])}>
              {sl}
            </button>
          ))}
        </div>
      </label>
      <label className="fld">身体注意事项（队长排练与健康提醒依据）
        <textarea className="inp" rows={2} value={health} onChange={(e) => setHealth(e.target.value)} placeholder="如：高血压、膝盖不好避免深蹲…" />
      </label>
      <label className="fld" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={joinFormal} onChange={(e) => setJoinFormal(e.target.checked)} style={{ width: 18, height: 18 }} />
        参加正式演出（不勾选则仅参加排练）
      </label>
      <button className="btn primary" disabled={!memberId} onClick={() => onEnroll(programId, memberId, size, joinFormal, health.trim(), slots)}>
        确认报名
      </button>
    </div>
  )
}
