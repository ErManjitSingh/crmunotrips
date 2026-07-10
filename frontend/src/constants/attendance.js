/** Roles that must check in (office). Admin & Sales Manager are excluded. */
export const ATTENDANCE_CHECK_IN_ROLES = [
  'team_leader',
  'sales_executive',
  'accountant',
  'operations_manager',
];

export function requiresAttendanceCheckIn(role) {
  return ATTENDANCE_CHECK_IN_ROLES.includes(role);
}
