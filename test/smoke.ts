import { useStore, absentSet, placedSet, stageDone, activeSubs, riskySubs } from '../src/store'

let pass = 0, fail = 0
const assert = (cond: boolean, msg: string) => {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.log('  ✗', msg) }
}

const s = useStore.getState()

console.log('1. 报名 → 自动生成服装押金记录')
s.enroll('p2', 'm2', 'L', true, '膝关节滑膜炎，避免久蹲', ['周一晚', '周三晚'])
assert(useStore.getState().programs.find((p) => p.id === 'p2')!.memberIds.includes('m2'), '队员进入节目名单')
const c = useStore.getState().costumes.find((x) => x.memberId === 'm2' && x.programId === 'p2')
assert(!!c && c.deposit === 100 && !c.depositPaid, '服装记录生成、押金100未交')

console.log('2. 排练签到：请假/缺席 → 缺席集合（以最新一场 09-30 彩排 r6 为准）')
const r6 = useStore.getState().rehearsals.find((r) => r.id === 'r6')!
s.checkin('r6', 'm9', 'absent')
const absent = absentSet(useStore.getState().rehearsals, 'p1')
assert(absent.get('m2') === 'leave' && absent.get('m9') === 'absent', '请假与缺席被识别')

console.log('2b. 临时替位：推荐 → 确认 → 走位/变化/名单/服装/清单通知/风险 → 撤销恢复')
{
  // 候选池：未占位的候补队员 m17、m18
  const cands = s.rankSubstitutes('p1', 'm2')
  assert(cands.length === 2 && cands.every((c) => c.memberId === 'm17' || c.memberId === 'm18'), '候选为两名未占位候补队员')
  // m18：熟练度5但最后一次排练（r6 09-30）缺席；m17：熟练度4但全勤——综合评分 m18 仍居首（熟练度权重高）
  assert(cands[0].memberId === 'm18', '综合评分最高者排第一')
  assert(cands.find((c) => c.memberId === 'm18')!.attendedLast === false, 'm18 未参加最后一次排练被识别')
  assert(cands.find((c) => c.memberId === 'm17')!.attendedLast === true, 'm17 参加了最后一次排练')
  assert(Math.abs(cands[0].heightDiff) <= 1, '推荐者身高与请假者接近')

  const err = s.confirmSubstitute('p1', 'm2', 'm18', '家中临时有事')
  assert(err === null, '确认替位成功（无错误返回）')

  const p1s = useStore.getState().programs.find((p) => p.id === 'p1')!
  assert(p1s.formation.cells[0][0] === 'm18', '走位图更新：替位队员站上请假者前排1号位')
  const sub = activeSubs(p1s)[0]
  assert(!!sub && sub.subMemberId === 'm18' && sub.absentMemberId === 'm2' && sub.row === 0 && sub.col === 0, '替位记录正确（前排1号位）')
  assert(sub.attendedLastRehearsal === false && sub.lastRehearsalDate === '2026-09-30', '记录未参加最后一次排练及日期')
  assert(riskySubs(p1s).length === 1, '队长端风险集合包含该替位')
  assert(p1s.formation.changes.every((c) => c.affectedBySub === sub.id), '队形变化被自动标记为受替位影响')
  assert(sub.focusMemberIds.includes('m18'), '重点排练名单包含替位队员')
  assert(sub.focusMemberIds.includes('m1'), '重点排练名单包含相邻配合队员（同排 m1）')

  const tcos = useStore.getState().costumes.find((c) => c.memberId === 'm18' && c.programId === 'p1')!
  assert(!!tcos && tcos.temporary === true && tcos.deposit === 0 && !tcos.pickedUp, '自动生成临时候补服装记录（免押金、待领取）')

  const st1 = useStore.getState()
  assert(st1.notices.some((n) => n.kind === 'substitute' && n.targets.includes('costume') && n.targets.includes('sound') && n.text.includes('演出清单更新')), '向替位队员/服装/音响下发更新后的演出清单')
  assert(st1.notices.some((n) => n.kind === 'substitute' && n.level === 'urgent' && n.text.includes('未参加最后一次排练')), '生成未参加最后排练的风险提示')
  assert(st1.formationLogs.some((l) => l.programId === 'p1' && l.text.includes('临时替位')), '生成走位调整记录（新走位图留痕）')

  // 撤销：站位恢复、变化标记解除、替位标记取消
  s.cancelSubstitute('p1', sub.id)
  const p1r = useStore.getState().programs.find((p) => p.id === 'p1')!
  assert(p1r.formation.cells[0][0] === 'm2', '撤销后原队员恢复站位')
  assert(activeSubs(p1r).length === 0 && p1r.substitutes[0].cancelled === true, '替位标记为已撤销')
  assert(p1r.formation.changes.every((c) => c.affectedBySub == null), '队形变化影响标记解除')
}

console.log('3. 走位：放置队员 + 每人唯一站位')
s.assignCell('p2', 0, 0, 'm2')
s.assignCell('p2', 0, 1, 'm2') // 再放一次到别处
const p2 = useStore.getState().programs.find((p) => p.id === 'p2')!
assert(p2.formation.cells[0][0] === null && p2.formation.cells[0][1] === 'm2', '同一队员只占一个格子')
assert(placedSet(p2).has('m2'), '已就位集合包含该队员')

console.log('4. 场地缩小：裁列 → 队员待安置 + 调整日志 + 通知')
const before = placedSet(useStore.getState().programs.find((p) => p.id === 'p1')!).size
s.shrinkVenue('p1', '6')
const p1 = useStore.getState().programs.find((p) => p.id === 'p1')!
assert(p1.formation.cols === 6, '列数压缩为6')
assert(p1.formation.cells[0].length === 6, '网格宽度为6列')
assert(placedSet(p1).size <= before, '被裁列队员离开站位（待安置）')
assert(useStore.getState().formationLogs.some((l) => l.programId === 'p1' && l.text.includes('场地缩小')), '生成走位调整记录')
assert(useStore.getState().notices.some((n) => n.kind === 'venue'), '生成场地通知')

console.log('5. 曲目版本更新：新版本置当前并通知音响师')
s.uploadMusicVersion('p2', 'V2 精简版', '茉莉花_V2.mp3', '时长缩短', '队长')
const pv2 = useStore.getState().programs.find((p) => p.id === 'p2')!
const cur = pv2.musicVersions.find((v) => v.current)!
assert(cur.label === 'V2 精简版' && pv2.musicVersions.filter((v) => v.current).length === 1, '只有一个当前版本')
assert(useStore.getState().notices.some((n) => n.targets.includes('sound') && n.text.includes('曲目版本更新')), '通知音响师')

console.log('6. 节目审查：要求调整 → 退回排练阶段；通过 → 待演出')
s.reviewProgram('p1', 'changes_requested', '内容需调整', '文化站·陈老师')
assert(useStore.getState().programs.find((p) => p.id === 'p1')!.stage === 'rehearsing', '退回排练阶段')
s.reviewProgram('p1', 'approved', '通过', '文化站·陈老师')
assert(useStore.getState().programs.find((p) => p.id === 'p1')!.stage === 'ready', '审查通过后待演出')

console.log('7. 服装流程：收押金 → 家属代领 → 上报尺码问题 → 换货 → 归还')
s.payDeposit('m2', 'p2')
s.pickupCostume('m2', 'p2', '吴强（儿子）代领')
let cc = useStore.getState().costumes.find((x) => x.memberId === 'm2' && x.programId === 'p2')!
assert(cc.depositPaid && cc.pickedUp && cc.pickedUpBy.includes('儿子'), '押金收取、家属代领登记')
s.reportSizeIssue('m2', 'p2', 'L码偏紧')
s.resolveSizeIssue('m2', 'p2', 'XL')
cc = useStore.getState().costumes.find((x) => x.memberId === 'm2' && x.programId === 'p2')!
assert(cc.size === 'XL' && cc.sizeIssue === '', '换货更新尺码并清除问题')
s.returnCostume('m2', 'p2')
assert(useStore.getState().costumes.find((x) => x.memberId === 'm2' && x.programId === 'p2')!.returned, '归还登记')

console.log('8. 排练室冲突拦截')
assert(s.bookRoom('room1', 't2', '2026-09-28', '周一 19:00–20:30', '冲突测试') !== null, '同时段同室被拦截')
assert(s.bookRoom('room2', 't2', '2026-10-06', '周二 19:00–20:30', '不冲突') === null, '不同日期同室可预订')

console.log('9. 现场签到 + 候场顺序调整')
s.onsiteCheckin('p4', 'm15')
assert(useStore.getState().onsite['p4']['m15'] === true, '现场签到生效')
const orderBefore = useStore.getState().programs.filter((p) => p.stage === 'ready' || p.stage === 'showday').map((p) => p.waitingOrder)
s.moveWaiting('p4', 1)
assert(JSON.stringify(orderBefore) !== JSON.stringify(useStore.getState().programs.filter((p) => p.stage === 'ready' || p.stage === 'showday').map((p) => p.waitingOrder)), '候场顺序可调整')

console.log('10. 连续性链条：p4 各环节齐全')
const p4 = useStore.getState().programs.find((p) => p.id === 'p4')!
const done = stageDone(p4, useStore.getState().rehearsals, useStore.getState().costumes, useStore.getState().onsite)
assert(done.signup && done.rehearsing && done.positioning && done.costume && done.review, '报名→排练→走位→服装→审核 均完成')

console.log(`\n结果：${pass} 通过，${fail} 失败`)
if (fail > 0) process.exit(1)
