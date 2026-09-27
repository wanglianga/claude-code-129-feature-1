import { useState } from 'react'
import { useStore } from '../store'
import { SIZES, STAGE_LABEL, type CostumeSize } from '../types'

export default function Costume() {
  const role = useStore((s) => s.role)
  const programs = useStore((s) => s.programs)
  const costumes = useStore((s) => s.costumes)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const payDeposit = useStore((s) => s.payDeposit)
  const pickup = useStore((s) => s.pickupCostume)
  const ret = useStore((s) => s.returnCostume)
  const reportIssue = useStore((s) => s.reportSizeIssue)
  const resolveIssue = useStore((s) => s.resolveSizeIssue)

  const [pid, setPid] = useState(programs[0]?.id ?? '')
  const program = programs.find((p) => p.id === pid) ?? programs[0]
  const [pickupWho, setPickupWho] = useState<Record<string, string>>({})
  const [issueText, setIssueText] = useState<Record<string, string>>({})
  const [newSize, setNewSize] = useState<CostumeSize>('XL')

  if (!program) return null
  let list = costumes.filter((c) => c.programId === program.id)
  if (role === 'member') list = list.filter((c) => c.memberId === currentMemberId)

  const stats = {
    total: list.length,
    picked: list.filter((c) => c.pickedUp).length,
    returned: list.filter((c) => c.returned).length,
    deposit: list.filter((c) => c.depositPaid).length,
    issues: list.filter((c) => c.sizeIssue).length,
  }

  return (
    <div>
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>服装管理</h3>
          <select className="inp" style={{ width: 'auto' }} value={program.id} onChange={(e) => setPid(e.target.value)}>
            {programs.map((p) => <option key={p.id} value={p.id}>《{p.title}》（{STAGE_LABEL[p.stage]}）</option>)}
          </select>
          <span className="row" style={{ marginLeft: 'auto' }}>
            <span className="badge blue">押金 {stats.deposit}/{stats.total}</span>
            <span className="badge brand">已领 {stats.picked}/{stats.total}</span>
            <span className="badge green">已还 {stats.returned}/{stats.total}</span>
            {stats.issues > 0 && <span className="badge red">尺码问题 {stats.issues}</span>}
          </span>
        </div>
        <div className="muted mt8">每套服装押金 100 元，归还检查无损后退还。家属可凭队员姓名代领，系统记录代领人及关系。</div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>队员</th><th>年龄</th><th>尺码</th><th>押金</th><th>领取</th><th>归还</th><th>尺码问题 / 处理</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const m = members.find((x) => x.id === c.memberId)!
              const manage = role === 'costume' || role === 'leader'
              return (
                <tr key={c.memberId}>
                  <td><b>{m.name}</b></td>
                  <td>{m.age}</td>
                  <td><b>{c.size}</b></td>
                  <td>
                    {c.depositPaid
                      ? <span className="badge green">已交 ¥{c.deposit}</span>
                      : <><span className="badge red">未交</span>{manage && <button className="btn sm mt8" onClick={() => payDeposit(c.memberId, c.programId)}>收押金</button>}</>}
                  </td>
                  <td>
                    {c.pickedUp
                      ? <span className="badge brand">{c.pickedUpBy || '已领'}</span>
                      : (
                        <div className="row">
                          {manage
                            ? <>
                              <input className="inp" style={{ width: 130, padding: '6px 8px' }} placeholder="领走人（家属写关系）"
                                value={pickupWho[c.memberId] ?? ''} onChange={(e) => setPickupWho({ ...pickupWho, [c.memberId]: e.target.value })} />
                              <button className="btn sm primary" onClick={() => {
                                const who = (pickupWho[c.memberId] ?? '').trim()
                                if (!who) { alert('请填写领取人，家属代领请注明关系，如「吴强（儿子）」'); return }
                                pickup(c.memberId, c.programId, who)
                              }}>登记领取</button>
                            </>
                            : <span className="badge gray">待领取</span>}
                        </div>
                      )}
                  </td>
                  <td>
                    {c.returned
                      ? <span className="badge green">已归还（押金可退）</span>
                      : c.pickedUp && manage
                        ? <button className="btn sm green" onClick={() => ret(c.memberId, c.programId)}>登记归还</button>
                        : <span className="muted">—</span>}
                  </td>
                  <td style={{ minWidth: 260 }}>
                    {c.sizeIssue
                      ? (
                        <div>
                          <div className="alert red" style={{ margin: 0 }}>{c.sizeIssue}</div>
                          {manage && (
                            <div className="row mt8">
                              <select className="inp" style={{ width: 80, padding: '6px 8px' }} value={newSize} onChange={(e) => setNewSize(e.target.value as CostumeSize)}>
                                {SIZES.map((s) => <option key={s}>{s}</option>)}
                              </select>
                              <button className="btn sm green" onClick={() => resolveIssue(c.memberId, c.programId, newSize)}>换货并更新尺码</button>
                            </div>
                          )}
                        </div>
                      )
                      : manage
                        ? <div className="row">
                            <input className="inp" style={{ width: 150, padding: '6px 8px' }} placeholder="如：M码偏小" value={issueText[c.memberId] ?? ''}
                              onChange={(e) => setIssueText({ ...issueText, [c.memberId]: e.target.value })} />
                            <button className="btn sm" onClick={() => {
                              const v = (issueText[c.memberId] ?? '').trim()
                              if (!v) return
                              reportIssue(c.memberId, c.programId, v)
                              setIssueText({ ...issueText, [c.memberId]: '' })
                            }}>上报问题</button>
                          </div>
                        : <span className="muted">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
