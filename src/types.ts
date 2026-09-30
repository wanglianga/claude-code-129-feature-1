// ============ 角色与基础类型 ============

export type Role = 'leader' | 'member' | 'costume' | 'culture' | 'sound' | 'volunteer'

export const ROLE_LABEL: Record<Role, string> = {
  leader: '队长',
  member: '队员',
  costume: '服装负责人',
  culture: '文化站',
  sound: '音响师',
  volunteer: '志愿者',
}

export type ProgramType = '广场舞' | '民族舞' | '合唱伴舞' | '节庆演出'

/** 节目从报名到归档的流转阶段 */
export type Stage =
  | 'signup'       // 报名中
  | 'rehearsing'   // 排练中
  | 'positioning'  // 走位编排
  | 'costume'      // 服装准备
  | 'review'       // 节目审查
  | 'ready'        // 审核通过待演出
  | 'showday'      // 演出当天
  | 'archived'     // 已归档

export const STAGE_LABEL: Record<Stage, string> = {
  signup: '报名',
  rehearsing: '排练',
  positioning: '走位',
  costume: '服装',
  review: '节目审核',
  ready: '待演出',
  showday: '现场签到',
  archived: '已归档',
}

/** 文化站查看的连续性链条（顺序固定） */
export const PIPELINE: Stage[] = ['signup', 'rehearsing', 'positioning', 'costume', 'review', 'showday']

export type CostumeSize = 'S' | 'M' | 'L' | 'XL' | 'XXL'
export const SIZES: CostumeSize[] = ['S', 'M', 'L', 'XL', 'XXL']

// ============ 队员 ============

export interface Member {
  id: string
  name: string
  age: number
  phone: string
  teamId: string
  /** 可排练时间段，如 ['周一晚','周三晚'] */
  availableSlots: string[]
  /** 是否参加正式演出 */
  joinFormal: boolean
  /** 身体注意事项 */
  healthNotes: string
  /** 是否前排成员 */
  frontRow: boolean
  /** 身高（cm），临时替位时用于匹配站位视觉效果 */
  heightCm: number
  /** 动作熟练度 1-5（5 最熟练），替位推荐依据之一 */
  proficiency: number
}

/** 某队员在某节目里的报名记录 */
export interface Enrollment {
  memberId: string
  programId: string
  costumeSize: CostumeSize
  joinFormal: boolean
  healthNotes: string
  availableSlots: string[]
  enrolledAt: string
}

// ============ 节目（演出记录，所有角色在同一记录上协作） ============

export interface MusicVersion {
  id: string
  label: string          // 如 "V3 删减版 4'30"
  fileName: string
  note: string
  uploadedBy: string
  uploadedAt: string
  current: boolean
}

export interface Segment {
  id: string
  name: string           // 动作分段名，如 "开场造型"
  range: string          // 如 "0:00-0:45"
  focusMemberIds: string[] // 需要重点练习的成员
}

export interface FormationChange {
  id: string
  atSegment: string      // 在哪个分段发生队形变化
  desc: string
  /** 受临时替位影响（需替位队员重点排练的队形变化），null=未受影响，否则记录替位 id */
  affectedBySub?: string | null
}

export interface Formation {
  rows: number
  cols: number
  /** cells[r][c] = memberId | null；row 0 为前排 */
  cells: (string | null)[][]
  changes: FormationChange[]
}

export interface ReviewRecord {
  id: string
  by: string             // 文化站经办人
  result: 'approved' | 'changes_requested' | 'rejected'
  comment: string
  at: string
}

// ============ 临时替位（演出前一天前排请假等突发情况） ============

/** 一次已确认的临时替位 */
export interface Substitute {
  id: string
  programId: string
  /** 请假/缺席的原站位队员 */
  absentMemberId: string
  /** 顶替队员 */
  subMemberId: string
  /** 顶替的站位：row 0 为前排 */
  row: number
  col: number
  /** 被标记为受影响的队形变化 id */
  affectedChangeIds: string[]
  /** 生成的重点排练名单（替位队员 + 相邻配合队员） */
  focusMemberIds: string[]
  /** 确认时替位队员是否参加了最后一次排练（false 则持续提示风险） */
  attendedLastRehearsal: boolean
  /** 最后一次排练日期（快照） */
  lastRehearsalDate: string
  reason: string
  confirmedAt: string
  /** 是否已撤销（撤销后站位恢复） */
  cancelled: boolean
}

export interface Program {
  id: string
  teamId: string
  title: string
  type: ProgramType
  theme: string
  stage: Stage
  durationMin: number
  soundNeeds: string          // 音响需求（音响师可见）
  venue: string
  venueApproval: 'pending' | 'approved' | 'rejected'
  venueNote: string
  isAudition: boolean         // 是否为社区文艺汇演海选节目
  memberIds: string[]
  musicVersions: MusicVersion[]
  segments: Segment[]
  formation: Formation
  reviews: ReviewRecord[]
  substitutes: Substitute[]   // 临时替位记录
  waitingOrder: number        // 候场顺序号（演出当天）
  createdAt: string
  showDate: string
}

// ============ 排练与签到 ============

export type CheckinStatus = 'present' | 'leave' | 'absent'

export interface Rehearsal {
  id: string
  programId: string
  roomId: string
  date: string
  timeSlot: string
  checkins: Record<string, CheckinStatus>
  note: string
}

// ============ 服装 ============

export interface CostumeRecord {
  memberId: string
  programId: string
  size: CostumeSize
  deposit: number          // 押金金额
  depositPaid: boolean
  pickedUp: boolean
  pickedUpBy: string       // 领取人；家属代领时写家属姓名+关系
  returned: boolean
  sizeIssue: string        // 尺码不合适说明，空串表示无问题
  /** 临时替位候补服装（替位确认时自动建记录，演出后回收，不收押金） */
  temporary?: boolean
}

// ============ 排练室（多支队伍共用） ============

export interface RoomBooking {
  id: string
  roomId: string
  teamId: string
  date: string
  timeSlot: string
  purpose: string
}

export interface Room {
  id: string
  name: string
}

// ============ 通知 ============

export interface Notice {
  id: string
  programId: string | null
  text: string
  level: 'info' | 'urgent'
  targets: Role[]          // 面向哪些角色
  at: string
  kind: 'general' | 'health' | 'venue' | 'costume' | 'live' | 'next' | 'substitute'
}

// ============ 演出档案 ============

export interface Photo {
  id: string
  programId: string
  emoji: string            // 用 emoji 占位现场照片
  caption: string
  at: string
}

export interface FormationLog {
  id: string
  programId: string
  text: string
  at: string
}

// ============ 团队 ============

export interface Team {
  id: string
  name: string
  leader: string
}

// ============ 现场签到（演出当天） ============

export interface ShowdayState {
  programId: string
  onsiteCheckins: Record<string, boolean>  // memberId -> 已到
  started: boolean
}
