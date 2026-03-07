// src/config/roles.js
/**
 * ISMS Role Hierarchy & Permissions
 *
 * Hierarchy (highest → lowest):
 *   Admin > Managing Director > Director Logistics > HR Manager >
 *   Finance Manager > Operations Manager > Supervisor > Guard
 */

const ROLES = {
  ADMIN:               'Admin',
  MANAGING_DIRECTOR:   'Managing Director',
  DIRECTOR_LOGISTICS:  'Director Logistics',
  HR_MANAGER:          'HR Manager',
  FINANCE_MANAGER:     'Finance Manager',
  OPERATIONS_MANAGER:  'Operations Manager',
  SUPERVISOR:          'Supervisor',
  GUARD:               'Guard',
};

/**
 * Granular permission keys used across the system.
 * Format: resource:action
 */
const PERMISSIONS = {
  // ── User management ──────────────────────────────────────────────────────
  USERS_VIEW:              'users:view',
  USERS_CREATE:            'users:create',
  USERS_EDIT:              'users:edit',
  USERS_DELETE:            'users:delete',
  USERS_MANAGE_ROLES:      'users:manage_roles',

  // ── Personnel (guards) ───────────────────────────────────────────────────
  PERSONNEL_VIEW:          'personnel:view',
  PERSONNEL_CREATE:        'personnel:create',
  PERSONNEL_EDIT:          'personnel:edit',
  PERSONNEL_DELETE:        'personnel:delete',

  // ── Deployments / Sites ──────────────────────────────────────────────────
  SITES_VIEW:              'sites:view',
  SITES_CREATE:            'sites:create',
  SITES_EDIT:              'sites:edit',
  SITES_DELETE:            'sites:delete',
  DEPLOYMENTS_VIEW:        'deployments:view',
  DEPLOYMENTS_MANAGE:      'deployments:manage',

  // ── Incidents ────────────────────────────────────────────────────────────
  INCIDENTS_VIEW:          'incidents:view',
  INCIDENTS_REPORT:        'incidents:report',
  INCIDENTS_MANAGE:        'incidents:manage',

  // ── Schedules / Shifts ───────────────────────────────────────────────────
  SCHEDULES_VIEW:          'schedules:view',
  SCHEDULES_CREATE:        'schedules:create',
  SCHEDULES_EDIT:          'schedules:edit',

  // ── Leave management ─────────────────────────────────────────────────────
  LEAVE_VIEW_OWN:          'leave:view_own',
  LEAVE_APPLY:             'leave:apply',
  LEAVE_VIEW_TEAM:         'leave:view_team',
  LEAVE_VIEW_ALL:          'leave:view_all',
  LEAVE_APPROVE:           'leave:approve',        // Supervisor+
  LEAVE_FINAL_APPROVE:     'leave:final_approve',  // HR Manager+
  LEAVE_MANAGE:            'leave:manage',         // HR Manager+

  // ── Finance ──────────────────────────────────────────────────────────────
  FINANCE_VIEW:            'finance:view',
  FINANCE_MANAGE:          'finance:manage',
  INVOICES_VIEW:           'invoices:view',
  INVOICES_CREATE:         'invoices:create',

  // ── Reports ──────────────────────────────────────────────────────────────
  REPORTS_VIEW:            'reports:view',
  REPORTS_EXPORT:          'reports:export',
  REPORTS_ADVANCED:        'reports:advanced',

  // ── System ───────────────────────────────────────────────────────────────
  SYSTEM_SETTINGS:         'system:settings',
  AUDIT_LOGS:              'system:audit_logs',
  CCTV_VIEW:               'cctv:view',
  PATROL_TRACKING:         'patrol:tracking',
};

/**
 * Default permission sets per role.
 * Admin & Managing Director get ALL permissions automatically (see authorize middleware).
 */
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),

  [ROLES.MANAGING_DIRECTOR]: Object.values(PERMISSIONS),

  [ROLES.DIRECTOR_LOGISTICS]: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.PERSONNEL_CREATE,
    PERMISSIONS.PERSONNEL_EDIT,
    PERMISSIONS.SITES_VIEW,
    PERMISSIONS.SITES_CREATE,
    PERMISSIONS.SITES_EDIT,
    PERMISSIONS.SITES_DELETE,
    PERMISSIONS.DEPLOYMENTS_VIEW,
    PERMISSIONS.DEPLOYMENTS_MANAGE,
    PERMISSIONS.INCIDENTS_VIEW,
    PERMISSIONS.INCIDENTS_MANAGE,
    PERMISSIONS.SCHEDULES_VIEW,
    PERMISSIONS.SCHEDULES_CREATE,
    PERMISSIONS.SCHEDULES_EDIT,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_ADVANCED,
    PERMISSIONS.CCTV_VIEW,
    PERMISSIONS.PATROL_TRACKING,
    PERMISSIONS.AUDIT_LOGS,
  ],

  [ROLES.HR_MANAGER]: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.PERSONNEL_CREATE,
    PERMISSIONS.PERSONNEL_EDIT,
    PERMISSIONS.PERSONNEL_DELETE,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_FINAL_APPROVE,
    PERMISSIONS.LEAVE_MANAGE,
    PERMISSIONS.SCHEDULES_VIEW,
    PERMISSIONS.SCHEDULES_CREATE,
    PERMISSIONS.SCHEDULES_EDIT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],

  [ROLES.FINANCE_MANAGER]: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.LEAVE_VIEW_ALL,
  ],

  [ROLES.OPERATIONS_MANAGER]: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.PERSONNEL_CREATE,
    PERMISSIONS.PERSONNEL_EDIT,
    PERMISSIONS.SITES_VIEW,
    PERMISSIONS.SITES_CREATE,
    PERMISSIONS.SITES_EDIT,
    PERMISSIONS.DEPLOYMENTS_VIEW,
    PERMISSIONS.DEPLOYMENTS_MANAGE,
    PERMISSIONS.INCIDENTS_VIEW,
    PERMISSIONS.INCIDENTS_MANAGE,
    PERMISSIONS.SCHEDULES_VIEW,
    PERMISSIONS.SCHEDULES_CREATE,
    PERMISSIONS.SCHEDULES_EDIT,
    PERMISSIONS.LEAVE_VIEW_TEAM,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.CCTV_VIEW,
    PERMISSIONS.PATROL_TRACKING,
  ],

  [ROLES.SUPERVISOR]: [
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.SITES_VIEW,
    PERMISSIONS.DEPLOYMENTS_VIEW,
    PERMISSIONS.INCIDENTS_VIEW,
    PERMISSIONS.INCIDENTS_REPORT,
    PERMISSIONS.INCIDENTS_MANAGE,
    PERMISSIONS.SCHEDULES_VIEW,
    PERMISSIONS.SCHEDULES_EDIT,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_APPLY,
    PERMISSIONS.LEAVE_VIEW_TEAM,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.CCTV_VIEW,
    PERMISSIONS.PATROL_TRACKING,
  ],

  [ROLES.GUARD]: [
    PERMISSIONS.INCIDENTS_REPORT,
    PERMISSIONS.SCHEDULES_VIEW,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_APPLY,
    PERMISSIONS.PATROL_TRACKING,
  ],
};

/**
 * Roles that have full / senior management access
 * (skip granular permission checks where needed)
 */
const SENIOR_ROLES = [ROLES.ADMIN, ROLES.MANAGING_DIRECTOR];

/**
 * Roles allowed to approve leave at first level (supervisor-level approval)
 */
const LEAVE_FIRST_APPROVERS = [
  ROLES.SUPERVISOR,
  ROLES.OPERATIONS_MANAGER,
  ROLES.DIRECTOR_LOGISTICS,
  ROLES.HR_MANAGER,
  ROLES.MANAGING_DIRECTOR,
  ROLES.ADMIN,
];

/**
 * Roles allowed to give final / HR-level leave approval
 */
const LEAVE_FINAL_APPROVERS = [
  ROLES.HR_MANAGER,
  ROLES.MANAGING_DIRECTOR,
  ROLES.ADMIN,
];

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SENIOR_ROLES,
  LEAVE_FIRST_APPROVERS,
  LEAVE_FINAL_APPROVERS,
};
