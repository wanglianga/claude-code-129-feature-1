import { useStore, absentSet, placedSet, stageDone, rankSubstitutes, pendingLeaves, substitutionRisks } from '../src/store'

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

console.log('2. 排练签到：请假/缺席 → 缺席集合')
const r3 = useStore.getState().rehearsals.find((r) => r.id === 'r3')!
s.checkin('r3', 'm2', 'leave')
s.checkin('r3', 'm9', 'absent')
const absent = absentSet(useStore.getState().rehearsals, 'p1')
assert(absent.get('m2') === 'leave' && absent.get('m9') === 'absent', '请假与缺席被识别')

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

console.log('11. 演出前一天临时替位：推荐 → 确认 → 新走位/名单/通知 → 风险持续')
const st0 = useStore.getState()
let p1now = st0.programs.find((p) => p.id === 'p1')!
// 种子已预置前排张桂芳(m2)演出前一天请假(l1)；此时队形已在前面用例压缩为6列，m2 仍在 (0,0)
assert(pendingLeaves(p1now).some((l) => l.memberId === 'm2'), '种子存在未确认的前排请假')
assert(p1now.formation.cells[0][0] === 'm2', '请假队员仍在原前排站位')

// 推荐：候选 = 未入队形且参加正式演出的队员（m12 不参加正式演出被排除）
let cands = rankSubstitutes(p1now, 'm2', st0.members, st0.rehearsals, st0.enrollments)
const candIds = cands.map((c) => c.memberId)
assert(candIds.includes('m17') && candIds.includes('m18') && !candIds.includes('m12'), '候选含候补m17/m18，排除不参加正式演出的m12')
const c17 = cands.find((c) => c.memberId === 'm17')!
const c18 = cands.find((c) => c.memberId === 'm18')!
assert(c17.atLastRehearsal === true && c18.atLastRehearsal === false, '识别最后一次排练出勤：m17参加/m18未参加')
assert(c17.heightDiff === 1 && c18.heightDiff === 3, '身高差按与请假队员(160cm)计算')
assert(cands[0].memberId === 'm17', '综合推荐首选为参加最后排练且身高更接近的 m17')
assert(c17.score > c18.score, '首选综合分高于未参加最后排练者')

// 队长确认 m17 替位
s.confirmSubstitution('p1', pendingLeaves(useStore.getState().programs.find((p) => p.id === 'p1')!).find((l) => l.memberId === 'm2')!.id, 'm17')
p1now = useStore.getState().programs.find((p) => p.id === 'p1')!
assert(p1now.formation.cells[0][0] === 'm17', '新走位图：替位队员顶上请假队员站位')
assert(pendingLeaves(p1now).length === 0, '请假标记为已处理')
const sub1 = p1now.substitutions.find((x) => x.subMemberId === 'm17')!
assert(sub1.row === 0 && sub1.col === 0 && sub1.subAtLastRehearsal === true, '替位记录保存站位与最后排练出勤快照')
assert(p1now.formation.changes.every((c) => c.affectedBySub), '受影响队形变化被自动标记')
assert(sub1.focusMemberIds.includes('m17') && sub1.focusMemberIds.length >= 2, '生成重点排练名单（含替位与相邻配合队员）')
assert(useStore.getState().formationLogs.some((l) => l.programId === 'p1' && l.text.includes('临时替位')), '生成走位调整记录')
const subNotices = useStore.getState().notices.filter((n) => n.kind === 'substitution' && n.programId === 'p1')
assert(subNotices.some((n) => n.targets.includes('costume')), '通知服装负责人更新清单')
assert(subNotices.some((n) => n.targets.includes('sound')), '通知音响师更新清单')
assert(subNotices.some((n) => n.targets.includes('member')), '通知替位队员')
assert(substitutionRisks(p1now).length === 0, 'm17 参加最后排练 → 无持续风险')
assert(!!useStore.getState().costumes.find((c) => c.programId === 'p1' && c.memberId === 'm17'), '替位队员服装记录在案（负责人可加急备装）')

// 风险场景：前排 m1 再请假，唯一候选 m18（未参加最后一次排练）
s.registerPreShowLeave('p1', 'm1', '突发高烧')
p1now = useStore.getState().programs.find((p) => p.id === 'p1')!
const leaveM1 = pendingLeaves(p1now).find((l) => l.memberId === 'm1')!
cands = rankSubstitutes(p1now, 'm1', useStore.getState().members, useStore.getState().rehearsals, useStore.getState().enrollments)
assert(cands.some((c) => c.memberId === 'm18' && !c.atLastRehearsal), 'm18 作为候选且被识别为未参加最后排练')
s.confirmSubstitution('p1', leaveM1.id, 'm18')
p1now = useStore.getState().programs.find((p) => p.id === 'p1')!
const sub2 = p1now.substitutions.find((x) => x.subMemberId === 'm18')!
assert(p1now.formation.cells[0][2] === 'm18', 'm18 顶上 m1 的前排3号位')
assert(sub2.subAtLastRehearsal === false, '替位记录快照：m18 未参加最后一次排练')
const risks = substitutionRisks(p1now)
assert(risks.length === 1 && risks[0].subMemberId === 'm18', '队长端持续风险提示（不可解除）')
assert(useStore.getState().notices.some((n) => n.kind === 'substitution' && n.targets.includes('leader') && n.text.includes('替位风险')), '生成队长专属风险通知')
// 再次调用选择器，风险依旧存在（演出前检查持续提示）
assert(substitutionRisks(useStore.getState().programs.find((p) => p.id === 'p1')!).length === 1, '风险不会被自动消除')

console.log(`\n结果：${pass} 通过，${fail} 失败`)
if (fail > 0) process.exit(1)
