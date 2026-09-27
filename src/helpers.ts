import { useStore } from './store'
import type { Member, Program } from './types'

export function useHelpers() {
  const members = useStore((s) => s.members)
  const teams = useStore((s) => s.teams)
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id
  const memberOf = (id: string): Member | undefined => members.find((m) => m.id === id)
  const teamOf = (p: Program) => teams.find((t) => t.id === p.teamId)?.name ?? p.teamId
  return { nameOf, memberOf, teamOf }
}
