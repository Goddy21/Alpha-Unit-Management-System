const { query } = require('../config/database');

// ── helpers ──────────────────────────────────────────────────────────────────
const buildWhere = (conditions, params) =>
  conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

const safeInt = (val, fallback = 0) => {
  const n = parseInt(val);
  return isNaN(n) ? fallback : n;
};

/**
 * GET /events
 */
const getAll = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status, event_type, priority,
      search, site_id, client_id,
      from_date, to_date,
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status && status !== 'all') {
      conditions.push(`e.status = $${idx++}`); params.push(status);
    }
    if (event_type && event_type !== 'all') {
      conditions.push(`e.event_type = $${idx++}`); params.push(event_type);
    }
    if (priority && priority !== 'all') {
      conditions.push(`e.priority = $${idx++}`); params.push(priority);
    }
    if (site_id) {
      conditions.push(`e.site_id = $${idx++}`); params.push(site_id);
    }
    if (client_id) {
      conditions.push(`e.client_id = $${idx++}`); params.push(client_id);
    }
    if (from_date) {
      conditions.push(`e.start_date >= $${idx++}`); params.push(from_date);
    }
    if (to_date) {
      conditions.push(`e.end_date <= $${idx++}`); params.push(to_date);
    }
    if (search) {
      conditions.push(`(e.title ILIKE $${idx} OR e.venue_name ILIKE $${idx} OR e.description ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = buildWhere(conditions, params);

    const dataResult = await query(
      `SELECT
         e.*,
         s.name AS site_name,
         c.name AS client_name,
         u.name AS created_by_name
       FROM events e
       LEFT JOIN sites    s ON s.id = e.site_id
       LEFT JOIN clients  c ON c.id = e.client_id
       LEFT JOIN users    u ON u.id = e.created_by
       ${where}
       ORDER BY e.start_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM events e ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        events: dataResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Error fetching events.', error: error.message });
  }
};

/**
 * GET /events/stats
 */
const getStats = async (req, res) => {
  try {
    const totals = await query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE status = 'active')        AS active,
        COUNT(*) FILTER (WHERE status = 'planned')       AS planned,
        COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled,
        COUNT(*) FILTER (WHERE priority = 'critical')    AS critical,
        SUM(expected_attendance)                         AS total_expected,
        SUM(actual_attendance)                           AS total_actual,
        SUM(ambulances_deployed)                         AS total_ambulances,
        SUM(fire_engines_deployed)                       AS total_fire_engines,
        SUM(police_officers)                             AS total_police,
        SUM(security_guards)                             AS total_guards
      FROM events
    `);

    const byType = await query(`
      SELECT event_type, COUNT(*) AS count
      FROM events
      GROUP BY event_type
      ORDER BY count DESC
    `);

    const upcoming = await query(`
      SELECT id, title, event_type, start_date, venue_name, status, priority
      FROM events
      WHERE start_date > NOW() AND status NOT IN ('cancelled','completed')
      ORDER BY start_date ASC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        ...totals.rows[0],
        byType: byType.rows,
        upcoming: upcoming.rows,
      },
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching event stats.', error: error.message });
  }
};

/**
 * GET /events/:id
 */
const getById = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         e.*,
         s.name AS site_name,
         c.name AS client_name,
         u.name AS created_by_name
       FROM events e
       LEFT JOIN sites   s ON s.id = e.site_id
       LEFT JOIN clients c ON c.id = e.client_id
       LEFT JOIN users   u ON u.id = e.created_by
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Event not found.' });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ success: false, message: 'Error fetching event.', error: error.message });
  }
};

/**
 * POST /events
 */
const create = async (req, res) => {
  try {
    const {
      title, description, event_type = 'general', status = 'planned', priority = 'medium',
      start_date, end_date,
      venue_name, address, coordinates, site_id, client_id,
      expected_attendance = 0, actual_attendance = 0, max_capacity = 0,
      ambulances_deployed = 0, ambulances_required = 0,
      fire_engines_deployed = 0, fire_engines_required = 0,
      police_officers = 0, police_units = 0,
      security_guards = 0, supervisors = 0,
      vehicles_deployed = 0, communication_devices = 0,
      first_aid_stations = 0, evacuation_routes, briefing_notes, logistics_notes,
      images = [], videos = [], equipment_list = [],
      risk_level = 'low', risk_notes,
      permits_required = false, permits_obtained = false,
    } = req.body;

    if (!title || !start_date || !end_date)
      return res.status(400).json({ success: false, message: 'title, start_date, and end_date are required.' });

    const created_by = req.user?.id || null;

    // Sanitize all numeric fields to prevent integer overflow / NaN errors
    const safeExpected     = safeInt(expected_attendance);
    const safeActual       = safeInt(actual_attendance);
    const safeCapacity     = safeInt(max_capacity);
    const safeAmbDep       = safeInt(ambulances_deployed);
    const safeAmbReq       = safeInt(ambulances_required);
    const safeFireDep      = safeInt(fire_engines_deployed);
    const safeFireReq      = safeInt(fire_engines_required);
    const safePoliceOff    = safeInt(police_officers);
    const safePoliceUnits  = safeInt(police_units);
    const safeGuards       = safeInt(security_guards);
    const safeSupervisors  = safeInt(supervisors);
    const safeVehicles     = safeInt(vehicles_deployed);
    const safeComms        = safeInt(communication_devices);
    const safeFirstAid     = safeInt(first_aid_stations);

    const result = await query(
      `INSERT INTO events (
         title, description, event_type, status, priority,
         start_date, end_date,
         venue_name, address, coordinates, site_id, client_id,
         expected_attendance, actual_attendance, max_capacity,
         ambulances_deployed, ambulances_required,
         fire_engines_deployed, fire_engines_required,
         police_officers, police_units,
         security_guards, supervisors,
         vehicles_deployed, communication_devices,
         first_aid_stations, evacuation_routes, briefing_notes, logistics_notes,
         images, videos, equipment_list,
         risk_level, risk_notes,
         permits_required, permits_obtained,
         created_by
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,
         $8,$9,$10,$11,$12,
         $13,$14,$15,
         $16,$17,
         $18,$19,
         $20,$21,
         $22,$23,
         $24,$25,
         $26,$27,$28,$29,
         $30,$31,$32,
         $33,$34,
         $35,$36,
         $37
       ) RETURNING *`,
      [
        title, description, event_type, status, priority,
        start_date, end_date,
        venue_name, address, coordinates, site_id || null, client_id || null,
        safeExpected, safeActual, safeCapacity,
        safeAmbDep, safeAmbReq,
        safeFireDep, safeFireReq,
        safePoliceOff, safePoliceUnits,
        safeGuards, safeSupervisors,
        safeVehicles, safeComms,
        safeFirstAid, evacuation_routes, briefing_notes, logistics_notes,
        JSON.stringify(images), JSON.stringify(videos), JSON.stringify(equipment_list),
        risk_level, risk_notes,
        permits_required, permits_obtained,
        created_by,
      ]
    );

    res.status(201).json({ success: true, message: 'Event created successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, message: 'Error creating event.', error: error.message });
  }
};

/**
 * PUT /events/:id
 */
const update = async (req, res) => {
  try {
    const {
      title, description, event_type, status, priority,
      start_date, end_date,
      venue_name, address, coordinates, site_id, client_id,
      expected_attendance, actual_attendance, max_capacity,
      ambulances_deployed, ambulances_required,
      fire_engines_deployed, fire_engines_required,
      police_officers, police_units,
      security_guards, supervisors,
      vehicles_deployed, communication_devices,
      first_aid_stations, evacuation_routes, briefing_notes, logistics_notes,
      images, videos, equipment_list,
      risk_level, risk_notes,
      permits_required, permits_obtained,
    } = req.body;

    // Sanitize all numeric fields to prevent integer overflow / NaN errors
    const safeExpected     = safeInt(expected_attendance);
    const safeActual       = safeInt(actual_attendance);
    const safeCapacity     = safeInt(max_capacity);
    const safeAmbDep       = safeInt(ambulances_deployed);
    const safeAmbReq       = safeInt(ambulances_required);
    const safeFireDep      = safeInt(fire_engines_deployed);
    const safeFireReq      = safeInt(fire_engines_required);
    const safePoliceOff    = safeInt(police_officers);
    const safePoliceUnits  = safeInt(police_units);
    const safeGuards       = safeInt(security_guards);
    const safeSupervisors  = safeInt(supervisors);
    const safeVehicles     = safeInt(vehicles_deployed);
    const safeComms        = safeInt(communication_devices);
    const safeFirstAid     = safeInt(first_aid_stations);

    const result = await query(
      `UPDATE events SET
         title                 = COALESCE($1,  title),
         description           = COALESCE($2,  description),
         event_type            = COALESCE($3,  event_type),
         status                = COALESCE($4,  status),
         priority              = COALESCE($5,  priority),
         start_date            = COALESCE($6,  start_date),
         end_date              = COALESCE($7,  end_date),
         venue_name            = COALESCE($8,  venue_name),
         address               = COALESCE($9,  address),
         coordinates           = COALESCE($10, coordinates),
         site_id               = COALESCE($11, site_id),
         client_id             = COALESCE($12, client_id),
         expected_attendance   = COALESCE($13, expected_attendance),
         actual_attendance     = COALESCE($14, actual_attendance),
         max_capacity          = COALESCE($15, max_capacity),
         ambulances_deployed   = COALESCE($16, ambulances_deployed),
         ambulances_required   = COALESCE($17, ambulances_required),
         fire_engines_deployed = COALESCE($18, fire_engines_deployed),
         fire_engines_required = COALESCE($19, fire_engines_required),
         police_officers       = COALESCE($20, police_officers),
         police_units          = COALESCE($21, police_units),
         security_guards       = COALESCE($22, security_guards),
         supervisors           = COALESCE($23, supervisors),
         vehicles_deployed     = COALESCE($24, vehicles_deployed),
         communication_devices = COALESCE($25, communication_devices),
         first_aid_stations    = COALESCE($26, first_aid_stations),
         evacuation_routes     = COALESCE($27, evacuation_routes),
         briefing_notes        = COALESCE($28, briefing_notes),
         logistics_notes       = COALESCE($29, logistics_notes),
         images                = COALESCE($30, images),
         videos                = COALESCE($31, videos),
         equipment_list        = COALESCE($32, equipment_list),
         risk_level            = COALESCE($33, risk_level),
         risk_notes            = COALESCE($34, risk_notes),
         permits_required      = COALESCE($35, permits_required),
         permits_obtained      = COALESCE($36, permits_obtained)
       WHERE id = $37
       RETURNING *`,
      [
        title, description, event_type, status, priority,
        start_date, end_date,
        venue_name, address, coordinates, site_id || null, client_id || null,
        safeExpected, safeActual, safeCapacity,
        safeAmbDep, safeAmbReq,
        safeFireDep, safeFireReq,
        safePoliceOff, safePoliceUnits,
        safeGuards, safeSupervisors,
        safeVehicles, safeComms,
        safeFirstAid, evacuation_routes, briefing_notes, logistics_notes,
        images ? JSON.stringify(images) : null,
        videos ? JSON.stringify(videos) : null,
        equipment_list ? JSON.stringify(equipment_list) : null,
        risk_level, risk_notes,
        permits_required, permits_obtained,
        req.params.id,
      ]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Event not found.' });

    res.json({ success: true, message: 'Event updated successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, message: 'Error updating event.', error: error.message });
  }
};

/**
 * DELETE /events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const result = await query('DELETE FROM events WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Error deleting event.', error: error.message });
  }
};

module.exports = { getAll, getStats, getById, create, update, deleteEvent };