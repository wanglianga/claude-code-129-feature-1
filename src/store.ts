import { create } from 'zustand'
import type {
  CheckinStatus, CostumeRecord, CostumeSize, Enrollment, FormationLog,
  Member, Notice, Photo, Program, Rehearsal, Role, Room, RoomBooking, Stage, Team,
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
