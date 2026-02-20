// src/controllers/shiftsController.js
const { query, transaction } = require('../config/database');

/**
 * Get all shifts with pagination and filters
 */
const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      date,
      status,
      guardId,
      siteId,
      sortBy = 'shift_date',
      sortOrder = 'DESC',
    } = req.query;

    // Whitelist sortBy to prevent SQL injection
    const allowedSortFields = ['shift_date', 'start_time', 'created_at', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'shift_date';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // Keep filter params separate from pagination params
    let whereConditions = [];
    let filterParams = [];
    let paramIndex = 1;

    if (date) {
      whereConditions.push(`sh.shift_date = $${paramIndex}`);
      filterParams.push(date);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`sh.status = $${paramIndex}`);
      filterParams.push(status);
      paramIndex++;
    }

    if (guardId) {
      whereConditions.push(`sh.personnel_id = $${paramIndex}`);
      filterParams.push(guardId);
      paramIndex++;
    }

    if (siteId) {
      whereConditions.push(`sh.site_id = $${paramIndex}`);
      filterParams.push(siteId);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const shiftsQuery = `
      SELECT
        sh.*,
        p.name        AS guard_name,
        p.employee_id AS guard_employee_id,
        p.guard_code,
        s.name        AS site_name,
        s.site_code
      FROM shifts sh
      LEFT JOIN personnel p ON sh.personnel_id = p.id
      LEFT JOIN sites s     ON sh.site_id = s.id
      ${whereClause}
      ORDER BY sh.${safeSortBy} ${safeSortOrder}, sh.start_time ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const shiftsParams = [...filterParams, parseInt(limit), parseInt(offset)];
    const shiftsResult = await query(shiftsQuery, shiftsParams);

    // Count query — filter params only, no pagination
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM shifts sh
      LEFT JOIN personnel p ON sh.personnel_id = p.id
      LEFT JOIN sites s     ON sh.site_id = s.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, filterParams);
    const total = parseInt(countResult.rows[0].total);

    const shifts = shiftsResult.rows.map((sh) => ({
      id: sh.id,
      shift_code: sh.shift_code,
      guardId: sh.personnel_id,
      guardName: sh.guard_name || '—',
      guardEmployeeId: sh.guard_employee_id || '—',
      guardCode: sh.guard_code || '—',
      siteId: sh.site_id,
      siteName: sh.site_name || '—',
      siteCode: sh.site_code || '—',
      date: sh.shift_date,
      startTime: sh.start_time,
      endTime: sh.end_time,
      status: sh.status,
      checkInTime: sh.check_in_time || null,
      checkOutTime: sh.check_out_time || null,
      notes: sh.notes || null,
      createdAt: sh.created_at,
    }));

    res.status(200).json({
      success: true,
      data: {
        shifts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shifts.',
      error: error.message,
    });
  }
};

/**
 * Get shift by ID
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        sh.*,
        p.name        AS guard_name,
        p.employee_id AS guard_employee_id,
        p.guard_code,
        s.name        AS site_name,
        s.site_code
       FROM shifts sh
       LEFT JOIN personnel p ON sh.personnel_id = p.id
       LEFT JOIN sites s     ON sh.site_id = s.id
       WHERE sh.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    const sh = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        id: sh.id,
        shift_code: sh.shift_code,
        guardId: sh.personnel_id,
        guardName: sh.guard_name || '—',
        guardEmployeeId: sh.guard_employee_id || '—',
        guardCode: sh.guard_code || '—',
        siteId: sh.site_id,
        siteName: sh.site_name || '—',
        siteCode: sh.site_code || '—',
        date: sh.shift_date,
        startTime: sh.start_time,
        endTime: sh.end_time,
        status: sh.status,
        checkInTime: sh.check_in_time || null,
        checkOutTime: sh.check_out_time || null,
        notes: sh.notes || null,
        createdAt: sh.created_at,
      },
    });
  } catch (error) {
    console.error('Get shift error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shift.',
      error: error.message,
    });
  }
};

/**
 * Create new shift
 */
const create = async (req, res) => {
  try {
    const { guardId, siteId, date, startTime, endTime, notes } = req.body;

    if (!guardId || !siteId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Guard, site, date, start time, and end time are required.',
      });
    }

    // Check the guard isn't already scheduled for an overlapping shift on the same date
    const conflictResult = await query(
      `SELECT id FROM shifts
       WHERE personnel_id = $1
         AND shift_date = $2
         AND status NOT IN ('missed', 'cancelled')
         AND (
           (start_time <= $3 AND end_time > $3) OR
           (start_time < $4 AND end_time >= $4) OR
           (start_time >= $3 AND end_time <= $4)
         )`,
      [guardId, date, startTime, endTime]
    );

    if (conflictResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Guard already has a conflicting shift scheduled for this time.',
      });
    }

    const shiftCode = `SHF${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO shifts (shift_code, personnel_id, site_id, shift_date, start_time, end_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [shiftCode, guardId, siteId, date, startTime, endTime, 'scheduled', notes || null]
    );

    const sh = result.rows[0];

    // Fetch joined names for the response
    const joined = await query(
      `SELECT p.name AS guard_name, s.name AS site_name
       FROM personnel p, sites s
       WHERE p.id = $1 AND s.id = $2`,
      [guardId, siteId]
    );

    res.status(201).json({
      success: true,
      message: 'Shift created successfully.',
      data: {
        ...sh,
        guardName: joined.rows[0]?.guard_name || '—',
        siteName: joined.rows[0]?.site_name || '—',
      },
    });
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating shift.',
      error: error.message,
    });
  }
};

/**
 * Update shift (status, check-in/out times, reschedule)
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { guardId, siteId, date, startTime, endTime, status, checkInTime, checkOutTime, notes } =
      req.body;

    const result = await query(
      `UPDATE shifts SET
        personnel_id  = COALESCE($1, personnel_id),
        site_id       = COALESCE($2, site_id),
        shift_date    = COALESCE($3, shift_date),
        start_time    = COALESCE($4, start_time),
        end_time      = COALESCE($5, end_time),
        status        = COALESCE($6, status),
        check_in_time = COALESCE($7, check_in_time),
        check_out_time = COALESCE($8, check_out_time),
        notes         = COALESCE($9, notes)
       WHERE id = $10
       RETURNING *`,
      [guardId, siteId, date, startTime, endTime, status, checkInTime, checkOutTime, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    // If shift completed, bump the guard's shifts_completed counter
    if (status === 'completed') {
      const sh = result.rows[0];
      await query(
        `UPDATE personnel SET shifts_completed = shifts_completed + 1 WHERE id = $1`,
        [sh.personnel_id]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Shift updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update shift error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shift.',
      error: error.message,
    });
  }
};

/**
 * Delete shift
 */
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM shifts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    res.status(200).json({ success: true, message: 'Shift deleted successfully.' });
  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting shift.',
      error: error.message,
    });
  }
};

/**
 * Get shift statistics (scoped to today by default)
 */
const getStats = async (req, res) => {
  try {
    const { date } = req.query;
    // Default to today if no date provided
    const targetDate = date || new Date().toISOString().split('T')[0];

    const todayStatsResult = await query(
      `SELECT
        COUNT(*)                                                   AS today_total,
        COUNT(CASE WHEN status = 'ongoing'   THEN 1 END)          AS ongoing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)          AS completed,
        COUNT(CASE WHEN status = 'missed'    THEN 1 END)          AS missed,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END)          AS scheduled
       FROM shifts
       WHERE shift_date = $1`,
      [targetDate]
    );

    const weekStatsResult = await query(
      `SELECT COUNT(*) AS week_total
       FROM shifts
       WHERE shift_date >= CURRENT_DATE - INTERVAL '7 days'`
    );

    const row = todayStatsResult.rows[0];

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        today: parseInt(row.today_total),
        ongoing: parseInt(row.ongoing),
        completed: parseInt(row.completed),
        missed: parseInt(row.missed),
        scheduled: parseInt(row.scheduled),
        weekTotal: parseInt(weekStatsResult.rows[0].week_total),
      },
    });
  } catch (error) {
    console.error('Get shift stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shift statistics.',
      error: error.message,
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteItem,
  getStats,
};
