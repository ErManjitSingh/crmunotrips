/** Roles that can assign leads to managers, team leaders, or executives */
export function canAssignLeads(role) {
  return role === 'admin' || role === 'sales_manager' || role === 'team_leader' || role === 'lead_provider';
}

export function assignAllowedRoles(role) {
  if (role === 'team_leader') return ['sales_executive'];
  if (role === 'sales_manager' || role === 'admin' || role === 'lead_provider') {
    return ['sales_manager', 'team_leader', 'sales_executive'];
  }
  return [];
}
