import { useStore, absentSet, placedSet, stageDone } from '../src/store'

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

console.log(`\n结果：${pass} 通过，${fail} 失败`)
if (fail > 0) process.exit(1)
