import { useState } from 'react'
import { useStore } from './store'
import { ROLE_LABEL, type Role } from './types'
import Dashboard from './views/Dashboard'
import Signup from './views/Signup'
import Checkin from './views/Checkin'
import Formation from './views/Formation'
import Costume from './views/Costume'
import Culture from './views/Culture'
import Showday from './views/Showday'
import Rooms from './views/Rooms'
import Archive from './views/Archive'
import Notices from './views/Notices'

type TabId = 'dashboard' | 'signup' | 'checkin' | 'formation' | 'costume' | 'culture' | 'showday' | 'rooms' | 'archive' | 'notices'

const TABS: { id: TabId; label: string; roles: Role[] }[] = [
  { id: 'dashboard', label: '总览', roles: ['leader', 'member', 'costume', 'culture', 'sound', 'volunteer'] },
  { id: 'signup', label: '节目报名', roles: ['leader', 'member'] },
  { id: 'checkin', label: '排练签到', roles: ['leader'] },
  { id: 'formation', label: '走位编排', roles: ['leader', 'member'] },
  { id: 'costume', label: '服装管理', roles: ['costume', 'leader', 'member'] },
  { id: 'culture', label: '文化站审核', roles: ['culture'] },
  { id: 'showday', label: '演出当天', roles: ['leader', 'volunteer', 'sound', 'member', 'costume'] },
  { id: 'rooms', label: '排练室', roles: ['leader', 'culture'] },
  { id: 'archive', label: '演出档案', roles: ['leader', 'member', 'costume', 'culture', 'sound', 'volunteer'] },
  { id: 'notices', label: '通知中心', roles: ['leader', 'member', 'costume', 'culture', 'sound', 'volunteer'] },
]

export default function App() {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const setCurrentMember = useStore((s) => s.setCurrentMember)
  const [tab, setTab] = useState<TabId>('dashboard')

  const allowed = TABS.filter((t) => t.roles.includes(role))
  const active = allowed.some((t) => t.id === tab) ? tab : allowed[0].id

  return (
    <div>
      <header className="app-header">
        <h1 className="app-title">
          社区舞蹈队 · 排练报名与演出走位协作台
          <small>同一场演出记录，队长 / 队员 / 服装 / 文化站 / 音响师 / 志愿者 协同</small>
        </h1>
        <div className="role-switch">
          <span className="role-tag">当前角色：{ROLE_LABEL[role]}</span>
          <select className="me-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          {role === 'member' && (
            <select className="me-select" value={currentMemberId} onChange={(e) => setCurrentMember(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>我是：{m.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <nav className="tabs">
        {allowed.map((t) => (
          <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {active === 'dashboard' && <Dashboard />}
        {active === 'signup' && <Signup />}
        {active === 'checkin' && <Checkin />}
        {active === 'formation' && <Formation />}
        {active === 'costume' && <Costume />}
        {active === 'culture' && <Culture />}
        {active === 'showday' && <Showday />}
        {active === 'rooms' && <Rooms />}
        {active === 'archive' && <Archive />}
        {active === 'notices' && <Notices />}
      </main>
    </div>
  )
}
