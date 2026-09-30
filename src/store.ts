import { create } from 'zustand'
import type {
  CheckinStatus, CostumeRecord, CostumeSize, Enrollment, FormationLog,
  Member, Notice, Photo, Program, Rehearsal, Role, Room, RoomBooking, Stage,
  Substitution, Team,
} from './types'
import * as seed from './seed'

let seq = 100
const nid = (p: string) => `${p}${seq++}`
const now = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const STAGE_ORDER: Stage[] = ['signup', 'rehearsing', 'positioning', 'costume', 'review', 'ready', 'showday', 'archived']

interface State {
  role: Role
  currentMemberId: string // 队员视角下“我是谁”
  teams: Team[]
  members: Member[]
  programs: Program[]
  enrollments: Enrollment[]
  rehearsals: Rehearsal[]
  costumes: CostumeRecord[]
  rooms: Room[]
  bookings: RoomBooking[]
  notices: Notice[]
  photos: Photo[]
  formationLogs: FormationLog[]
  onsite: Record<string, Record<string, boolean>> // programId -> memberId -> 已到

  setRole: (r: Role) => void
  setCurrentMember: (id: string) => void

  // 报名
  publishProgram: (p: Pick<Program, 'title' | 'type' | 'theme' | 'durationMin' | 'soundNeeds' | 'isAudition' | 'showDate'>, teamId: string) => void
  enroll: (programId: string, memberId: string, size: CostumeSize, joinFormal: boolean, healthNotes: string, slots: string[]) => void
  advanceStage: (programId: string) => void

  // 排练签到
  checkin: (rehearsalId: string, memberId: string, status: CheckinStatus) => void
  setRehearsalNote: (rehearsalId: string, note: string) => void
  addRehearsal: (programId: string, roomId: string, date: string, timeSlot: string) => void

  // 曲目与分段
  uploadMusicVersion: (programId: string, label: string, fileName: string, note: string, by: string) => void
  toggleFocusMember: (programId: string, segmentId: string, memberId: string) => void

  // 走位
  assignCell: (programId: string, row: number, col: number, memberId: string | null) => void
  shrinkVenue: (programId: string, newCols: string) => void
  addFormationChange: (programId: string, atSegment: string, desc: string) => void

  // 临时替位（演出前一天前排请假）
  registerPreShowLeave: (programId: string, memberId: string, reason: string) => void
  confirmSubstitution: (programId: string, leaveId: string, subMemberId: string) => void

  // 服装
  payDeposit: (memberId: string, programId: string) => void
  pickupCostume: (memberId: string, programId: string, byWho: string) => void
  returnCostume: (memberId: string, programId: string) => void
  reportSizeIssue: (memberId: string, programId: string, issue: string) => void
  resolveSizeIssue: (memberId: string, programId: string, newSize: CostumeSize) => void

  // 文化站
  reviewProgram: (programId: string, result: 'approved' | 'changes_requested' | 'rejected', comment: string, by: string) => void
  setVenueApproval: (programId: string, approved: boolean, note: string) => void

  // 演出日
  onsiteCheckin: (programId: string, memberId: string) => void
  moveWaiting: (programId: string, dir: -1 | 1) => void

  // 通知 / 档案
  addNotice: (text: string, level: Notice['level'], targets: Role[], kind: Notice['kind'], programId: string | null) => void
  addPhoto: (programId: string, emoji: string, caption: string) => void

  // 排练室
  bookRoom: (roomId: string, teamId: string, date: string, timeSlot: string, purpose: string) => string | null
  cancelBooking: (id: string) => void
}

export const useStore = create<State>((set, get) => ({
  role: 'leader',
  currentMemberId: 'm2',
  teams: seed.teams,
  members: seed.members,
  programs: seed.programs,
  enrollments: seed.enrollments,
  rehearsals: seed.rehearsals,
  costumes: seed.costumes,
  rooms: seed.rooms,
  bookings: seed.bookings,
  notices: seed.notices,
  photos: seed.photos,
  formationLogs: seed.formationLogs,
  onsite: { p3: { m13: true, m14: true, m15: true, m16: true }, p4: { m13: true, m14: true } },

  setRole: (role) => set({ role }),
  setCurrentMember: (id) => set({ currentMemberId: id }),

  publishProgram: (p, teamId) => set((s) => ({
    programs: [...s.programs, {
      id: nid('p'), teamId, ...p, stage: 'signup' as Stage,
      venue: p.isAudition ? '待定（海选）' : '社区文化广场主舞台',
      venueApproval: 'pending' as const, venueNote: '待文化站审批',
      memberIds: [], musicVersions: [], segments: [],
      formation: { rows: 2, cols: 4, cells: [[null, null, null, null], [null, null, null, null]], changes: [] },
      preShowLeaves: [], substitutions: [],
      reviews: [], waitingOrder: s.programs.filter((x) => x.stage === 'ready' || x.stage === 'showday').length + 1,
      createdAt: now(),
    }],
  })),

  enroll: (programId, memberId, size, joinFormal, healthNotes, slots) => set((s) => {
    if (s.enrollments.some((e) => e.programId === programId && e.memberId === memberId)) return s
    return {
      enrollments: [...s.enrollments, { memberId, programId, costumeSize: size, joinFormal, healthNotes, availableSlots: slots, enrolledAt: now() }],
      programs: s.programs.map((p) => p.id === programId ? { ...p, memberIds: [...p.memberIds, memberId] } : p),
      costumes: [...s.costumes, {
        memberId, programId, size, deposit: 100, depositPaid: false,
        pickedUp: false, pickedUpBy: '', returned: false, sizeIssue: '',
      }],
      members: s.members.map((x) => x.id === memberId ? { ...x, healthNotes: healthNotes || x.healthNotes, availableSlots: slots.length ? slots : x.availableSlots } : x),
    }
  }),

  advanceStage: (programId) => set((s) => ({
    programs: s.programs.map((p) => {
      if (p.id !== programId) return p
      const i = STAGE_ORDER.indexOf(p.stage)
      return { ...p, stage: STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)] }
    }),
  })),

  checkin: (rehearsalId, memberId, status) => set((s) => ({
    rehearsals: s.rehearsals.map((r) => r.id === rehearsalId
      ? { ...r, checkins: { ...r.checkins, [memberId]: status } } : r),
  })),

  setRehearsalNote: (rehearsalId, note) => set((s) => ({
    rehearsals: s.rehearsals.map((r) => r.id === rehearsalId ? { ...r, note } : r),
  })),

  addRehearsal: (programId, roomId, date, timeSlot) => set((s) => ({
    rehearsals: [...s.rehearsals, { id: nid('r'), programId, roomId, date, timeSlot, checkins: {}, note: '' }],
  })),

  uploadMusicVersion: (programId, label, fileName, note, by) => set((s) => ({
    programs: s.programs.map((p) => p.id === programId ? {
      ...p,
      musicVersions: [...p.musicVersions.map((v) => ({ ...v, current: false })),
        { id: nid('v'), label, fileName, note, uploadedBy: by, uploadedAt: now(), current: true }],
    } : p),
    notices: [...s.notices, {
      id: nid('n'), programId, level: 'info' as const, kind: 'general' as const, at: now(),
      targets: ['sound', 'leader', 'member'] as Role[],
      text: `曲目版本更新：${label}（${fileName}），请音响师替换播放文件。`,
    }],
  })),

  toggleFocusMember: (programId, segmentId, memberId) => set((s) => ({
    programs: s.programs.map((p) => p.id === programId ? {
      ...p,
      segments: p.segments.map((seg) => seg.id === segmentId ? {
        ...seg,
        focusMemberIds: seg.focusMemberIds.includes(memberId)
          ? seg.focusMemberIds.filter((x) => x !== memberId)
          : [...seg.focusMemberIds, memberId],
      } : seg),
    } : p),
  })),

  assignCell: (programId, row, col, memberId) => set((s) => ({
    programs: s.programs.map((p) => {
      if (p.id !== programId) return p
      const cells = p.formation.cells.map((r) => [...r])
      // 同一队员只能在一个格子
      if (memberId) cells.forEach((r, ri) => r.forEach((c, ci) => { if (c === memberId) cells[ri][ci] = null }))
      cells[row][col] = memberId
      return { ...p, formation: { ...p.formation, cells } }
    }),
  })),

  shrinkVenue: (programId, newColsStr) => set((s) => {
    const newCols = parseInt(newColsStr, 10)
    const p = s.programs.find((x) => x.id === programId)
    if (!p || isNaN(newCols) || newCols < 1 || newCols >= p.formation.cols) return s
    const oldCols = p.formation.cols
    const displaced: string[] = []
    const cells = p.formation.cells.map((row) => row.slice(0, newCols).map((c) => c))
    p.formation.cells.forEach((row) => row.forEach((c, ci) => { if (c && ci >= newCols) displaced.push(c) }))
    const names = displaced.map((id) => s.members.find((m) => m.id === id)?.name ?? id).join('、')
    return {
      programs: s.programs.map((x) => x.id === programId ? { ...x, formation: { ...x.formation, cols: newCols, cells } } : x),
      formationLogs: [...s.formationLogs, {
        id: nid('fl'), programId, at: now(),
        text: `演出场地缩小：队形由${oldCols}列压缩为${newCols}列${displaced.length ? `，${names} 待重新安置` : ''}`,
      }],
      notices: [...s.notices, {
        id: nid('n'), programId, level: 'urgent' as const, kind: 'venue' as const, at: now(),
        targets: ['leader', 'member'] as Role[],
        text: `场地缩小：队形已压缩为${newCols}列${displaced.length ? `，${names} 需重新安排站位` : ''}`,
      }],
    }
  }),

  addFormationChange: (programId, atSegment, desc) => set((s) => ({
    programs: s.programs.map((p) => p.id === programId
      ? { ...p, formation: { ...p.formation, changes: [...p.formation.changes, { id: nid('fc'), atSegment, desc }] } } : p),
  })),

  // ===== 临时替位：演出前一天前排队员请假 =====
  registerPreShowLeave: (programId, memberId, reason) => set((s) => ({
    programs: s.programs.map((p) => {
      if (p.id !== programId) return p
      if (p.preShowLeaves.some((l) => l.memberId === memberId && !l.substitutionId)) return p
      // 仅当前仍在队形中的队员可登记（已被替下的队员不再占用待处理状态）
      const inFormation = p.formation.cells.some((r) => r.includes(memberId))
      if (!inFormation) return p
      return { ...p, preShowLeaves: [...p.preShowLeaves, { id: nid('l'), memberId, reason, at: now() }] }
    }),
    notices: [...s.notices, {
      id: nid('n'), programId, level: 'urgent' as const, kind: 'substitution' as const, at: now(),
      targets: ['leader'] as Role[],
      text: `演出前一天前排队员请假：${s.members.find((m) => m.id === memberId)?.name} — ${reason}。请到「走位编排」按身高/熟练度/出勤推荐替位并确认。`,
    }],
  })),

  confirmSubstitution: (programId, leaveId, subMemberId) => {
    const s = get()
    const p = s.programs.find((x) => x.id === programId)
    const leave = p?.preShowLeaves.find((l) => l.id === leaveId)
    if (!p || !leave || leave.substitutionId) return
    // 替位人选必须当前不在队形中（每人唯一站位）
    let subRow = -1, subCol = -1
    p.formation.cells.forEach((r, ri) => r.forEach((c, ci) => { if (c === subMemberId) { subRow = ri; subCol = ci } }))
    if (subRow >= 0) return
    // 定位请假队员当前站位
    let row = -1, col = -1
    p.formation.cells.forEach((r, ri) => r.forEach((c, ci) => { if (c === leave.memberId) { row = ri; col = ci } }))
    if (row < 0) return

    // 最后一次有签到记录的排练（替位是否参加的依据）
    const last = latestRehearsal(s.rehearsals, programId)
    const subAtLast = last?.checkins[subMemberId] === 'present'
    const lastDate = last?.date ?? '无排练记录'

    // 重点排练名单：替位队员 + 同排相邻站位的配合队员
    const focus = new Set<string>([subMemberId])
    const sameRow = p.formation.cells[row]
    sameRow.forEach((c, ci) => {
      if (c && c !== leave.memberId && Math.abs(ci - col) <= 2) focus.add(c)
    })
    // 请假队员在某分段是重点练习成员的，替位也要重点练
    p.segments.forEach((seg) => { if (seg.focusMemberIds.includes(leave.memberId)) focus.add(subMemberId) })

    // 自动标记受影响的队形变化（全部变化都涉及前排走位；前排替位均需重走）
    const affectedChangeIds = p.formation.changes.map((c) => c.id)

    // 新走位图：替位队员放到请假队员的位置，原队员撤下
    const cells = p.formation.cells.map((r) => r.map((c) => (c === leave.memberId ? subMemberId : c)))
    // 若替位队员原本在其他格子（如已在队形中），清空原位
    cells.forEach((r, ri) => r.forEach((c, ci) => {
      if (c === subMemberId && !(ri === row && ci === col)) cells[ri][ci] = null
    }))

    const sub: Substitution = {
      id: nid('sub'), absentMemberId: leave.memberId, subMemberId, row, col,
      at: now(), lastRehearsalDate: lastDate, subAtLastRehearsal: subAtLast,
      affectedChangeIds: [...affectedChangeIds], focusMemberIds: [...focus],
    }
    const absentName = s.members.find((m) => m.id === leave.memberId)?.name
    const subName = s.members.find((m) => m.id === subMemberId)?.name
    const posText = `${row === 0 ? '前排' : `第${row + 1}排`}${col + 1}号位`

    set({
      programs: s.programs.map((x) => {
        if (x.id !== programId) return x
        return {
          ...x,
          formation: {
            ...x.formation,
            cells,
            changes: x.formation.changes.map((c) =>
              affectedChangeIds.includes(c.id) ? { ...c, affectedBySub: true } : c),
          },
          preShowLeaves: x.preShowLeaves.map((l) => l.id === leaveId ? { ...l, substitutionId: sub.id } : l),
          substitutions: [...x.substitutions, sub],
        }
      }),
      formationLogs: [...s.formationLogs, {
        id: nid('fl'), programId, at: now(),
        text: `临时替位：${absentName}（前排请假）→ ${subName} 顶替${posText}；${subAtLast ? '替位参加了最后一次排练' : `替位未参加最后一次排练（${lastDate}），演出风险待提示`}；受影响队形变化 ${affectedChangeIds.length} 处`,
      }],
      notices: [
        ...s.notices,
        // 替位队员 + 队长
        {
          id: nid('n'), programId, level: 'urgent' as const, kind: 'substitution' as const, at: now(),
          targets: ['leader', 'member'] as Role[],
          text: `《${p.title}》临时替位已确认：${subName} 顶替${absentName} 的${posText}。请${subName}今晚按新走位图重点排练${affectedChangeIds.length}处队形变化。`,
        },
        // 服装负责人
        {
          id: nid('n'), programId, level: 'urgent' as const, kind: 'substitution' as const, at: now(),
          targets: ['costume'] as Role[],
          text: `《${p.title}》演出清单更新：替位队员 ${subName} 明晚上台，请提前备好其演出服装与押金/领取手续；原 ${absentName} 的服装不再使用。`,
        },
        // 音响师
        {
          id: nid('n'), programId, level: 'info' as const, kind: 'substitution' as const, at: now(),
          targets: ['sound'] as Role[],
          text: `《${p.title}》演出清单更新：前排 ${absentName} 请假，替位 ${subName} 上台，人数与节目时长不变；候场点名与话筒交接请按新名单。`,
        },
        ...(!subAtLast ? [{
          id: nid('n'), programId, level: 'urgent' as const, kind: 'substitution' as const, at: now(),
          targets: ['leader'] as Role[],
          text: `替位风险：${subName} 未参加 ${lastDate} 最后一次排练，对新走位与队形变化不熟悉，演出前检查将持续提示，请安排今晚加练并现场重点盯位。`,
        }] : []),
      ],
    })
  },

  payDeposit: (memberId, programId) => set((s) => ({
    costumes: s.costumes.map((c) => c.memberId === memberId && c.programId === programId ? { ...c, depositPaid: true } : c),
  })),

  pickupCostume: (memberId, programId, byWho) => set((s) => ({
    costumes: s.costumes.map((c) => c.memberId === memberId && c.programId === programId ? { ...c, pickedUp: true, pickedUpBy: byWho } : c),
  })),

  returnCostume: (memberId, programId) => set((s) => ({
    costumes: s.costumes.map((c) => c.memberId === memberId && c.programId === programId ? { ...c, returned: true } : c),
  })),

  reportSizeIssue: (memberId, programId, issue) => set((s) => ({
    costumes: s.costumes.map((c) => c.memberId === memberId && c.programId === programId ? { ...c, sizeIssue: issue } : c),
    notices: [...s.notices, {
      id: nid('n'), programId, level: 'info' as const, kind: 'costume' as const, at: now(),
      targets: ['costume', 'leader'] as Role[],
      text: `尺码问题：${s.members.find((m) => m.id === memberId)?.name} — ${issue}`,
    }],
  })),

  resolveSizeIssue: (memberId, programId, newSize) => set((s) => ({
    costumes: s.costumes.map((c) => c.memberId === memberId && c.programId === programId ? { ...c, size: newSize, sizeIssue: '' } : c),
    enrollments: s.enrollments.map((e) => e.memberId === memberId && e.programId === programId ? { ...e, costumeSize: newSize } : e),
  })),

  reviewProgram: (programId, result, comment, by) => set((s) => ({
    programs: s.programs.map((p) => {
      if (p.id !== programId) return p
      const reviews = [...p.reviews, { id: nid('rv'), by, result, comment, at: now() }]
      // 通过 → 待演出；要求修改 → 退回排练阶段，队长调整后重新报审
      const stage: Stage = result === 'approved' ? 'ready' : result === 'changes_requested' ? 'rehearsing' : p.stage
      return { ...p, reviews, stage }
    }),
    notices: [...s.notices, {
      id: nid('n'), programId, level: result === 'approved' ? 'info' as const : 'urgent' as const,
      kind: 'general' as const, at: now(), targets: ['leader'] as Role[],
      text: result === 'approved' ? '节目审查通过，进入待演出状态。' : `文化站要求调整节目内容：${comment}`,
    }],
  })),

  setVenueApproval: (programId, approved, note) => set((s) => ({
    programs: s.programs.map((p) => p.id === programId
      ? { ...p, venueApproval: approved ? 'approved' : 'rejected', venueNote: note } : p),
  })),

  onsiteCheckin: (programId, memberId) => set((s) => ({
    onsite: {
      ...s.onsite,
      [programId]: { ...(s.onsite[programId] ?? {}), [memberId]: !(s.onsite[programId]?.[memberId]) },
    },
  })),

  moveWaiting: (programId, dir) => set((s) => {
    const queue = s.programs
      .filter((p) => p.stage === 'ready' || p.stage === 'showday')
      .sort((a, b) => a.waitingOrder - b.waitingOrder)
    const idx = queue.findIndex((p) => p.id === programId)
    const swap = idx + dir
    if (idx < 0 || swap < 0 || swap >= queue.length) return s
    const a = queue[idx], b = queue[swap]
    return {
      programs: s.programs.map((p) => {
        if (p.id === a.id) return { ...p, waitingOrder: b.waitingOrder }
        if (p.id === b.id) return { ...p, waitingOrder: a.waitingOrder }
        return p
      }),
    }
  }),

  addNotice: (text, level, targets, kind, programId) => set((s) => ({
    notices: [...s.notices, { id: nid('n'), programId, text, level, targets, kind, at: now() }],
  })),

  addPhoto: (programId, emoji, caption) => set((s) => ({
    photos: [...s.photos, { id: nid('ph'), programId, emoji, caption, at: now() }],
  })),

  bookRoom: (roomId, teamId, date, timeSlot, purpose) => {
    const s = get()
    const conflict = s.bookings.some((b) => b.roomId === roomId && b.date === date && b.timeSlot === timeSlot)
    if (conflict) return '该时段已被其他队伍预订'
    set((st) => ({ bookings: [...st.bookings, { id: nid('b'), roomId, teamId, date, timeSlot, purpose }] }))
    return null
  },

  cancelBooking: (id) => set((s) => ({ bookings: s.bookings.filter((b) => b.id !== id) })),
}))

// ============ 派生选择器 ============

/** 最近一次有签到记录的排练 */
export function latestRehearsal(rehearsals: Rehearsal[], programId: string): Rehearsal | undefined {
  return [...rehearsals].reverse().find((r) => r.programId === programId && Object.keys(r.checkins).length > 0)
}

/** 最近一次排练中请假/缺席的队员 */
export function absentSet(rehearsals: Rehearsal[], programId: string): Map<string, CheckinStatus> {
  const r = latestRehearsal(rehearsals, programId)
  const m = new Map<string, CheckinStatus>()
  if (!r) return m
  Object.entries(r.checkins).forEach(([id, st]) => { if (st !== 'present') m.set(id, st) })
  return m
}

/** 已入队形的队员 */
export function placedSet(p: Program): Set<string> {
  const s = new Set<string>()
  p.formation.cells.forEach((row) => row.forEach((c) => { if (c) s.add(c) }))
  return s
}

// ============ 临时替位派生 ============

export interface SubCandidate {
  memberId: string
  heightDiff: number          // 与请假队员身高差（cm，越小越好）
  proficiency: number         // 熟练度 1-5
  attendanceRate: number      // 本节目历史排练出勤率 0-1
  rehearsalCount: number      // 有记录的排练场次数
  atLastRehearsal: boolean    // 是否参加最后一次排练
  lastStatus?: CheckinStatus
  score: number               // 综合推荐分（越高越优先）
  reasons: string[]           // 推荐/风险说明
}

/**
 * 演出前一天替位推荐：按身高接近度、动作熟练度、排练出勤率综合排序。
 * 候选 = 本节目已报名、参加正式演出、当前未在队形中的队员。
 */
export function rankSubstitutes(
  p: Program,
  absentMemberId: string,
  members: Member[],
  rehearsals: Rehearsal[],
  enrollments: Enrollment[],
): SubCandidate[] {
  const absent = members.find((m) => m.id === absentMemberId)
  if (!absent) return []
  const placed = placedSet(p)
  // 已登记演出前请假（含已由他人替位）的队员不再作为他人的替位候选
  const onLeave = new Set(p.preShowLeaves.map((l) => l.memberId))
  const myRehearsals = rehearsals.filter((r) => r.programId === p.id && Object.keys(r.checkins).length > 0)
  const last = myRehearsals[myRehearsals.length - 1]

  return p.memberIds
    .filter((id) => id !== absentMemberId && !onLeave.has(id) && !placed.has(id))
    .filter((id) => enrollments.find((e) => e.programId === p.id && e.memberId === id)?.joinFormal !== false)
    .map((id) => {
      const m = members.find((x) => x.id === id)!
      const heightDiff = Math.abs(m.heightCm - absent.heightCm)
      let present = 0, counted = 0
      myRehearsals.forEach((r) => {
        const st = r.checkins[id]
        if (st) { counted++; if (st === 'present') present++ }
      })
      const attendanceRate = counted ? present / counted : 0
      const lastStatus = last?.checkins[id]
      const atLast = lastStatus === 'present'

      // 综合分：熟练度(40%) + 出勤率(35%) + 最后一次排练(15%) - 身高差(10%)
      const score = Math.round(
        m.proficiency * 8 + attendanceRate * 35 + (atLast ? 12 : 0) + Math.max(0, 12 - heightDiff * 1.2)
      )
      const reasons: string[] = []
      reasons.push(`身高${m.heightCm}cm，与${absent.name}差${heightDiff}cm`)
      reasons.push(`熟练度${m.proficiency}/5`)
      reasons.push(counted ? `排练出勤 ${present}/${counted} 场` : '暂无排练签到记录')
      if (atLast) reasons.push('✓ 参加了最后一次排练')
      else reasons.push('✗ 未参加最后一次排练（演出风险）')
      return { memberId: id, heightDiff, proficiency: m.proficiency, attendanceRate, rehearsalCount: counted, atLastRehearsal: atLast, lastStatus, score, reasons }
    })
    .sort((a, b) => b.score - a.score)
}

/** 未处理的演出前请假（尚未确认替位） */
export function pendingLeaves(p: Program) {
  return p.preShowLeaves.filter((l) => !l.substitutionId)
}

/**
 * 持续风险：替位队员未参加最后一次排练。
 * 队长端在走位页、总览和演出前检查（演出当天页）持续提示，直到演出归档。
 */
export function substitutionRisks(p: Program): Substitution[] {
  return p.substitutions.filter((x) => !x.subAtLastRehearsal)
}


/** 各阶段是否完成（文化站连续性视角） */
export function stageDone(p: Program, rehearsals: Rehearsal[], costumes: CostumeRecord[], onsite: Record<string, Record<string, boolean>>): Record<string, boolean> {
  const hasCheckin = rehearsals.some((r) => r.programId === p.id && Object.keys(r.checkins).length > 0)
  const placed = placedSet(p).size
  const myCostumes = costumes.filter((c) => c.programId === p.id)
  const costumeOk = myCostumes.length > 0 && myCostumes.every((c) => !c.sizeIssue)
  const lastReview = p.reviews[p.reviews.length - 1]
  return {
    signup: p.memberIds.length > 0,
    rehearsing: hasCheckin,
    positioning: placed > 0,
    costume: costumeOk,
    review: lastReview?.result === 'approved',
    showday: Object.keys(onsite[p.id] ?? {}).length > 0,
  }
}

/** 老年/健康关注队员 */
export function healthWatch(members: Member[]): Member[] {
  return members.filter((m) => m.age >= 65 || m.healthNotes.length > 0)
}
