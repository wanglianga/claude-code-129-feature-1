import { create } from 'zustand'
import type {
  CheckinStatus, CostumeRecord, CostumeSize, Enrollment, FormationLog,
  Member, Notice, Photo, Program, Rehearsal, Role, Room, RoomBooking, Stage, Substitute, Team,
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

/** 替位推荐候选项（按身高匹配、熟练度、排练出勤率综合评分） */
export interface SubCandidate {
  memberId: string
  row: number
  col: number
  heightCm: number
  heightDiff: number
  proficiency: number
  /** 排练出勤率 0-1 */
  attendance: number
  presents: number
  total: number
  /** 是否参加了最后一次排练 */
  attendedLast: boolean
  /** 综合评分（越高越合适） */
  score: number
}

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
  rankSubstitutes: (programId: string, absentMemberId: string) => SubCandidate[]
  confirmSubstitute: (programId: string, absentMemberId: string, subMemberId: string, reason: string) => string | null
  cancelSubstitute: (programId: string, subId: string) => void

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
      reviews: [], substitutes: [], waitingOrder: s.programs.filter((x) => x.stage === 'ready' || x.stage === 'showday').length + 1,
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

  // ============ 临时替位 ============
  rankSubstitutes: (programId, absentMemberId) => {
    const s = get()
    const p = s.programs.find((x) => x.id === programId)
    if (!p) return []
    // 请假队员的站位
    let pos: { row: number; col: number } | null = null
    p.formation.cells.forEach((row, r) => row.forEach((c, ci) => { if (c === absentMemberId) pos = { row: r, col: ci } }))
    if (!pos) return []
    const absent = s.members.find((m) => m.id === absentMemberId)
    if (!absent) return []
    const placed = placedSet(p)
    const activeSubs = p.substitutes.filter((x) => !x.cancelled)
    const subbedIds = new Set(activeSubs.flatMap((x) => [x.absentMemberId, x.subMemberId]))
    const myRehearsals = s.rehearsals
      .filter((r) => r.programId === programId && Object.keys(r.checkins).length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
    const last = myRehearsals[0]
    const candidates = p.memberIds
      .map((id) => s.members.find((m) => m.id === id))
      .filter((m): m is Member => !!m)
      // 可作为替位：本人未占位（候补/待安置），未被其他替位占用，不是请假者本人
      .filter((m) => m.id !== absentMemberId && !placed.has(m.id) && !subbedIds.has(m.id))
      .map((m) => {
        const heightDiff = Math.abs(m.heightCm - absent.heightCm)
        let presents = 0
        let total = 0
        myRehearsals.forEach((r) => {
          const st = r.checkins[m.id]
          if (st !== undefined) { total++; if (st === 'present') presents++ }
        })
        const attendance = total === 0 ? 0 : presents / total
        const attendedLast = last?.checkins[m.id] === 'present'
        // 综合评分：熟练度（40%）+ 出勤（35%）+ 身高匹配（25%），分越高越合适
        const score = m.proficiency / 5 * 40 + attendance * 35 + Math.max(0, 1 - heightDiff / 10) * 25
        return {
          memberId: m.id, row: pos!.row, col: pos!.col,
          heightCm: m.heightCm, heightDiff,
          proficiency: m.proficiency, attendance, presents, total,
          attendedLast, score,
        }
      })
      .sort((a, b) => b.score - a.score)
    return candidates
  },

  confirmSubstitute: (programId, absentMemberId, subMemberId, reason) => {
    const s = get()
    const p = s.programs.find((x) => x.id === programId)
    if (!p) return '节目不存在'
    if (p.substitutes.some((x) => !x.cancelled && x.absentMemberId === absentMemberId)) return '该队员已安排替位'
    let row = -1, col = -1
    p.formation.cells.forEach((r, ri) => r.forEach((c, ci) => { if (c === absentMemberId) { row = ri; col = ci } }))
    if (row < 0) return '请假队员当前不在队形中，无需替位'
    const placed = placedSet(p)
    if (placed.has(subMemberId)) return '该替位队员已有站位'
    const myRehearsals = s.rehearsals
      .filter((r) => r.programId === programId && Object.keys(r.checkins).length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
    const lastRehearsal = myRehearsals[0]
    const attendedLastRehearsal = lastRehearsal?.checkins[subMemberId] === 'present'

    // 受影响队形变化：前排请假 → 全部队形变化都需替位队员重练；同时标记该队员原站位参与的变化
    const affectedChangeIds = p.formation.changes.map((c) => c.id)

    // 重点排练名单：替位队员 + 同排相邻配合队员
    const focus = new Set<string>([subMemberId])
    p.formation.cells[row].forEach((c) => { if (c && c !== absentMemberId) focus.add(c) })
    if (row + 1 < p.formation.rows) p.formation.cells[row + 1].forEach((c) => { if (c) focus.add(c) })

    const subId = nid('sub')
    const sub: Substitute = {
      id: subId, programId, absentMemberId, subMemberId, row, col,
      affectedChangeIds, focusMemberIds: [...focus],
      attendedLastRehearsal, lastRehearsalDate: lastRehearsal?.date ?? '无排练记录',
      reason: reason.trim() || '演出前临时请假', confirmedAt: now(), cancelled: false,
    }
    const absentName = s.members.find((m) => m.id === absentMemberId)?.name ?? absentMemberId
    const subName = s.members.find((m) => m.id === subMemberId)?.name ?? subMemberId
    const enrollment = s.enrollments.find((e) => e.programId === programId && e.memberId === subMemberId)

    set((st) => ({
      programs: st.programs.map((x) => {
        if (x.id !== programId) return x
        const cells = x.formation.cells.map((r) => [...r])
        cells[row][col] = subMemberId
        const changes = x.formation.changes.map((c) =>
          affectedChangeIds.includes(c.id) ? { ...c, affectedBySub: subId } : c)
        return { ...x, formation: { ...x.formation, cells, changes }, substitutes: [...x.substitutes, sub] }
      }),
      // 候补队员自动建临时候补服装记录（不收押金、未领取，服装负责人据此备装）
      costumes: st.costumes.some((c) => c.programId === programId && c.memberId === subMemberId)
        ? st.costumes
        : [...st.costumes, {
            memberId: subMemberId, programId, size: enrollment?.costumeSize ?? 'M',
            deposit: 0, depositPaid: true, pickedUp: false, pickedUpBy: '',
            returned: false, sizeIssue: '', temporary: true,
          }],
      formationLogs: [...st.formationLogs, {
        id: nid('fl'), programId, at: now(),
        text: `临时替位：${absentName}（${row === 0 ? '前排' : `第${row + 1}排`}${col + 1}号位）演出前请假，由候补队员${subName}顶替；已重新生成走位图与重点排练名单`,
      }],
      notices: [
        ...st.notices,
        {
          id: nid('n'), programId, level: 'urgent' as const, kind: 'substitute' as const, at: now(),
          targets: ['leader', 'member', 'costume', 'sound'] as Role[],
          text: `《${p.title}》演出清单更新：${absentName}请假，${subName}临时顶替${row === 0 ? '前排' : `第${row + 1}排`}${col + 1}号位。替位队员、服装、音响请按更新后的清单执行。`,
        },
        ...(attendedLastRehearsal ? [] : [{
          id: nid('n'), programId, level: 'urgent' as const, kind: 'substitute' as const, at: now(),
          targets: ['leader'] as Role[],
          text: `风险：替位队员${subName}未参加最后一次排练（${sub.lastRehearsalDate}），对新走位与队形变化不熟练，演出前需重点排练并持续核对到场。`,
        }]),
      ],
    }))
    return null
  },

  cancelSubstitute: (programId, subId) => set((s) => {
    const p = s.programs.find((x) => x.id === programId)
    const sub = p?.substitutes.find((x) => x.id === subId)
    if (!p || !sub || sub.cancelled) return s
    const subName = s.members.find((m) => m.id === sub.subMemberId)?.name ?? sub.subMemberId
    const absentName = s.members.find((m) => m.id === sub.absentMemberId)?.name ?? sub.absentMemberId
    return {
      programs: s.programs.map((x) => {
        if (x.id !== programId) return x
        const cells = x.formation.cells.map((r) => [...r])
        // 仅当该格当前仍是替位队员时恢复为请假队员
        if (cells[sub.row][sub.col] === sub.subMemberId) cells[sub.row][sub.col] = sub.absentMemberId
        const changes = x.formation.changes.map((c) => c.affectedBySub === subId ? { ...c, affectedBySub: null } : c)
        return {
          ...x, formation: { ...x.formation, cells, changes },
          substitutes: x.substitutes.map((z) => z.id === subId ? { ...z, cancelled: true } : z),
        }
      }),
      formationLogs: [...s.formationLogs, {
        id: nid('fl'), programId, at: now(),
        text: `撤销替位：${subName} 不再顶替 ${absentName}，走位恢复原安排`,
      }],
      notices: [...s.notices, {
        id: nid('n'), programId, level: 'info' as const, kind: 'substitute' as const, at: now(),
        targets: ['leader', 'member', 'costume', 'sound'] as Role[],
        text: `《${p.title}》演出清单更新：撤销 ${subName} 的临时替位，${absentName} 恢复原站位。`,
      }],
    }
  }),

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

/** 节目当前生效的临时替位 */
export function activeSubs(p: Program): Substitute[] {
  return p.substitutes.filter((x) => !x.cancelled)
}

/** 存在风险的替位：替位队员未参加最后一次排练（队长端/演出前检查持续提示） */
export function riskySubs(p: Program): Substitute[] {
  return activeSubs(p).filter((x) => !x.attendedLastRehearsal)
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
