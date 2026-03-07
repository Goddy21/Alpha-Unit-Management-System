// src/controllers/leaveController.js
const { query, transaction } = require('../config/database');
const {
  ROLES,
  LEAVE_FIRST_APPROVERS,
  LEAVE_FINAL_APPROVERS,
} = require('../config/roles');

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Map a DB row to the API shape.
 */
function formatLeave(row) {
  return {
    id:               row.id,
    userId:           row.user_id,
    userName:         row.user_name,
    userRole:         row.user_role,
    department:       row.department,
    leaveType:        row.leave_type,
    startDate:        row.start_date,
    endDate:          row.end_date,
    totalDays:        row.total_days,
    reason:           row.reason,
    status:           row.status,
    // First-level approval (Supervisor / Ops Manager)
    firstApproverId:   row.first_approver_id,
    firstApproverName: row.first_approver_name,
    firstApprovedAt:   row.first_approved_at,
    firstComment:      row.first_comment,
    // Final approval (HR Manager+)
    finalApproverId:   row.final_approver_id,
    finalApproverName: row.final_approver_name,
    finalApprovedAt:   row.final_approved_at,
    finalComment:      row.final_comment,
    // Meta
    attachmentUrl:    row.attachment_url,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   APPLY FOR LEAVE  –  POST /leave
───────────────────────────────────────────────────────────────────────────── */
const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, attachmentUrl } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'leaveType, startDate, endDate, and reason are required.',
      });
    }

    // Calculate working days (Mon–Fri only)
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ success: false, message: 'End date must be after start date.' });
    }

    let totalDays = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) totalDays++;
      cursor.setDate(cursor.getDate() + 1);
    }

    const result = await query(
      `INSERT INTO leave_requests
         (user_id, leave_type, start_date, end_date, total_days, reason, attachment_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
       RETURNING id`,
      [req.user.id, leaveType, startDate, endDate, totalDays, reason, attachmentUrl || null]
    );

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully.',
      data: { id: result.rows[0].id, totalDays },
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ success: false, message: 'Error submitting leave request.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   LIST LEAVE REQUESTS  –  GET /leave
   Visibility is scope-limited by role.
───────────────────────────────────────────────────────────────────────────── */
const getLeaveRequests = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status, leaveType,
      userId,
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    const role = req.user.role;

    // ── Scope by role ──────────────────────────────────────────────────────
    if ([ROLES.GUARD].includes(role)) {
      // Guards only see their own requests
      conditions.push(`lr.user_id = $${idx++}`);
      params.push(req.user.id);
    } else if (role === ROLES.SUPERVISOR) {
      // Supervisors see own + direct reports (same department)
      conditions.push(`(lr.user_id = $${idx} OR u.department = $${idx + 1})`);
      params.push(req.user.id, req.user.department);
      idx += 2;
    } else if (role === ROLES.OPERATIONS_MANAGER) {
      // Ops Managers see their department
      conditions.push(`(lr.user_id = $${idx} OR u.department = $${idx + 1})`);
      params.push(req.user.id, req.user.department);
      idx += 2;
    }
    // HR Manager, Finance Manager, Director Logistics, Managing Director, Admin → see all

    // ── Optional filters ───────────────────────────────────────────────────
    if (status && status !== 'all') {
      conditions.push(`lr.status = $${idx++}`);
      params.push(status);
    }
    if (leaveType && leaveType !== 'all') {
      conditions.push(`lr.leave_type = $${idx++}`);
      params.push(leaveType);
    }
    if (userId) {
      conditions.push(`lr.user_id = $${idx++}`);
      params.push(userId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        lr.*,
        u.name            AS user_name,
        u.role            AS user_role,
        u.department      AS department,
        fa.name           AS first_approver_name,
        ha.name           AS final_approver_name
      FROM leave_requests lr
      JOIN  users u  ON lr.user_id           = u.id
      LEFT JOIN users fa ON lr.first_approver_id  = fa.id
      LEFT JOIN users ha ON lr.final_approver_id  = ha.id
      ${where}
      ORDER BY lr.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      query(dataQuery, params),
      query(countQuery, params.slice(0, -2)),
    ]);

    res.json({
      success: true,
      data: {
        requests:   dataResult.rows.map(formatLeave),
        pagination: {
          page: parseInt(page), limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ success: false, message: 'Error fetching leave requests.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET SINGLE LEAVE REQUEST  –  GET /leave/:id
───────────────────────────────────────────────────────────────────────────── */
const getLeaveById = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         lr.*,
         u.name       AS user_name,
         u.role       AS user_role,
         u.department AS department,
         fa.name      AS first_approver_name,
         ha.name      AS final_approver_name
       FROM leave_requests lr
       JOIN  users u  ON lr.user_id           = u.id
       LEFT JOIN users fa ON lr.first_approver_id  = fa.id
       LEFT JOIN users ha ON lr.final_approver_id  = ha.id
       WHERE lr.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const leave = result.rows[0];
    // Guards can only view their own
    if (req.user.role === ROLES.GUARD && leave.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: formatLeave(leave) });
  } catch (error) {
    console.error('Get leave by id error:', error);
    res.status(500).json({ success: false, message: 'Error fetching leave request.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   FIRST-LEVEL APPROVAL  –  PUT /leave/:id/first-approval
   Supervisors, Ops Managers, Director Logistics, HR Manager, MD, Admin
───────────────────────────────────────────────────────────────────────────── */
const firstApproval = async (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'." });
    }

    const leaveResult = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!leaveResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const leave = leaveResult.rows[0];
    if (leave.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot action a leave that is already '${leave.status}'.` });
    }

    // Don't let users approve their own leave
    if (leave.user_id === req.user.id) {
      return res.status(403).json({ success: false, message: 'You cannot approve your own leave request.' });
    }

    const newStatus = action === 'approve' ? 'first_approved' : 'rejected';

    await query(
      `UPDATE leave_requests SET
         status              = $1,
         first_approver_id   = $2,
         first_approved_at   = NOW(),
         first_comment       = $3,
         updated_at          = NOW()
       WHERE id = $4`,
      [newStatus, req.user.id, comment || null, req.params.id]
    );

    res.json({
      success: true,
      message: action === 'approve'
        ? 'Leave first-approved. Pending final HR approval.'
        : 'Leave request rejected.',
      data: { id: req.params.id, status: newStatus },
    });
  } catch (error) {
    console.error('First approval error:', error);
    res.status(500).json({ success: false, message: 'Error processing approval.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   FINAL APPROVAL  –  PUT /leave/:id/final-approval
   HR Manager, Managing Director, Admin
───────────────────────────────────────────────────────────────────────────── */
const finalApproval = async (req, res) => {
  try {
    const { action, comment } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'." });
    }

    const leaveResult = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!leaveResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const leave = leaveResult.rows[0];
    if (!['pending', 'first_approved'].includes(leave.status)) {
      return res.status(400).json({ success: false, message: `Cannot final-approve a leave with status '${leave.status}'.` });
    }

    if (leave.user_id === req.user.id) {
      return res.status(403).json({ success: false, message: 'You cannot approve your own leave request.' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await query(
      `UPDATE leave_requests SET
         status              = $1,
         final_approver_id   = $2,
         final_approved_at   = NOW(),
         final_comment       = $3,
         updated_at          = NOW()
       WHERE id = $4`,
      [newStatus, req.user.id, comment || null, req.params.id]
    );

    res.json({
      success: true,
      message: action === 'approve' ? 'Leave approved.' : 'Leave request rejected.',
      data: { id: req.params.id, status: newStatus },
    });
  } catch (error) {
    console.error('Final approval error:', error);
    res.status(500).json({ success: false, message: 'Error processing final approval.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   CANCEL LEAVE  –  PUT /leave/:id/cancel
   Owner can cancel if still pending / first_approved
───────────────────────────────────────────────────────────────────────────── */
const cancelLeave = async (req, res) => {
  try {
    const leaveResult = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!leaveResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const leave = leaveResult.rows[0];

    if (leave.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own leave requests.' });
    }

    if (!['pending', 'first_approved'].includes(leave.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a leave with status '${leave.status}'.` });
    }

    await query(
      "UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    res.json({ success: true, message: 'Leave request cancelled.', data: { id: req.params.id, status: 'cancelled' } });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ success: false, message: 'Error cancelling leave request.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   LEAVE STATS  –  GET /leave/stats
───────────────────────────────────────────────────────────────────────────── */
const getLeaveStats = async (req, res) => {
  try {
    const role = req.user.role;
    let scopeWhere = '';
    let scopeParams = [];

    if (role === ROLES.GUARD) {
      scopeWhere = 'WHERE lr.user_id = $1';
      scopeParams = [req.user.id];
    } else if ([ROLES.SUPERVISOR, ROLES.OPERATIONS_MANAGER].includes(role)) {
      scopeWhere = 'WHERE (lr.user_id = $1 OR u.department = $2)';
      scopeParams = [req.user.id, req.user.department];
    }

    const statsQuery = `
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(CASE WHEN lr.status = 'pending'        THEN 1 END)         AS pending,
        COUNT(CASE WHEN lr.status = 'first_approved' THEN 1 END)         AS first_approved,
        COUNT(CASE WHEN lr.status = 'approved'       THEN 1 END)         AS approved,
        COUNT(CASE WHEN lr.status = 'rejected'       THEN 1 END)         AS rejected,
        COUNT(CASE WHEN lr.status = 'cancelled'      THEN 1 END)         AS cancelled,
        COUNT(CASE WHEN lr.leave_type = 'annual'     AND lr.status = 'approved' THEN 1 END) AS annual_approved,
        COUNT(CASE WHEN lr.leave_type = 'sick'       AND lr.status = 'approved' THEN 1 END) AS sick_approved,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days END), 0) AS total_days_approved
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      ${scopeWhere}
    `;

    const result = await query(statsQuery, scopeParams);
    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        total:            parseInt(row.total),
        pending:          parseInt(row.pending),
        firstApproved:    parseInt(row.first_approved),
        approved:         parseInt(row.approved),
        rejected:         parseInt(row.rejected),
        cancelled:        parseInt(row.cancelled),
        annualApproved:   parseInt(row.annual_approved),
        sickApproved:     parseInt(row.sick_approved),
        totalDaysApproved: parseInt(row.total_days_approved),
      },
    });
  } catch (error) {
    console.error('Leave stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching leave stats.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   ADD COMMENT  –  POST /leave/:id/comments
───────────────────────────────────────────────────────────────────────────── */
const addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required.' });
    }

    const leaveCheck = await query('SELECT id FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!leaveCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const result = await query(
      `INSERT INTO leave_comments (leave_request_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING id, comment, created_at`,
      [req.params.id, req.user.id, comment.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Comment added.',
      data: {
        ...result.rows[0],
        authorName: req.user.name,
        authorRole: req.user.role,
      },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Error adding comment.', error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET COMMENTS  –  GET /leave/:id/comments
───────────────────────────────────────────────────────────────────────────── */
const getComments = async (req, res) => {
  try {
    const result = await query(
      `SELECT lc.*, u.name AS author_name, u.role AS author_role
       FROM leave_comments lc
       JOIN users u ON lc.user_id = u.id
       WHERE lc.leave_request_id = $1
       ORDER BY lc.created_at ASC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id:         r.id,
        comment:    r.comment,
        authorName: r.author_name,
        authorRole: r.author_role,
        createdAt:  r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching comments.', error: error.message });
  }
};

module.exports = {
  applyLeave,
  getLeaveRequests,
  getLeaveById,
  firstApproval,
  finalApproval,
  cancelLeave,
  getLeaveStats,
  addComment,
  getComments,
};
