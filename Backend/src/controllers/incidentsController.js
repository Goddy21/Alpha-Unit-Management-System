// src/controllers/incidentsController.js
const { query } = require('../config/database');

/**
 * Get all incidents with pagination and filters
 */
const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      severity,
      status,
      siteId,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
    } = req.query;

    const allowedSortFields = ['timestamp', 'created_at', 'severity', 'status', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    let whereConditions = [];
    let filterParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(i.title ILIKE $${paramIndex} OR i.incident_code ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`
      );
      filterParams.push(`%${search}%`);
      paramIndex++;
    }

    if (severity && severity !== 'all') {
      whereConditions.push(`i.severity = $${paramIndex}`);
      filterParams.push(severity);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`i.status = $${paramIndex}`);
      filterParams.push(status);
      paramIndex++;
    }

    if (siteId) {
      whereConditions.push(`i.site_id = $${paramIndex}`);
      filterParams.push(siteId);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const incidentsQuery = `
      SELECT
        i.*,
        s.name        AS site_name,
        s.site_code,
        p.name        AS reported_by_name,
        p.employee_id AS reported_by_employee_id
      FROM incidents i
      LEFT JOIN sites s     ON i.site_id = s.id
      LEFT JOIN personnel p ON i.reported_by = p.id
      ${whereClause}
      ORDER BY i.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const incidentsParams = [...filterParams, parseInt(limit), parseInt(offset)];
    const incidentsResult = await query(incidentsQuery, incidentsParams);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM incidents i
      LEFT JOIN sites s     ON i.site_id = s.id
      LEFT JOIN personnel p ON i.reported_by = p.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, filterParams);
    const total = parseInt(countResult.rows[0].total);

    const incidents = incidentsResult.rows.map((i) => ({
      id: i.id,
      incident_code: i.incident_code,
      title: i.title,
      description: i.description,
      siteId: i.site_id,
      siteName: i.site_name || '—',
      siteCode: i.site_code || '—',
      reportedBy: i.reported_by_name || i.reported_by || '—',
      reportedById: i.reported_by_id,
      timestamp: i.timestamp,
      severity: i.severity,
      status: i.status,
      category: i.category,
      location: i.location,
      gpsCoords: i.gps_coords || null,
      hasAttachments: i.attachment_count > 0,
      attachmentCount: i.attachment_count || 0,
      assignedTo: i.assigned_to || null,
      resolvedAt: i.resolved_at || null,
      responseTime: i.response_time || null,
      notes: i.notes || null,
    }));

    res.status(200).json({
      success: true,
      data: {
        incidents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incidents.',
      error: error.message,
    });
  }
};

/**
 * Get incident by ID
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        i.*,
        s.name        AS site_name,
        s.site_code,
        p.name        AS reported_by_name,
        p.employee_id AS reported_by_employee_id
       FROM incidents i
       LEFT JOIN sites s     ON i.site_id = s.id
       LEFT JOIN personnel p ON i.reported_by = p.id
       WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found.' });
    }

    const i = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        id: i.id,
        incident_code: i.incident_code,
        title: i.title,
        description: i.description,
        siteId: i.site_id,
        siteName: i.site_name || '—',
        siteCode: i.site_code || '—',
        reportedBy: i.reported_by_name || i.reported_by || '—',
        reportedById: i.reported_by_id,
        timestamp: i.timestamp,
        severity: i.severity,
        status: i.status,
        category: i.category,
        location: i.location,
        gpsCoords: i.gps_coords || null,
        hasAttachments: i.attachment_count > 0,
        attachmentCount: i.attachment_count || 0,
        assignedTo: i.assigned_to || null,
        resolvedAt: i.resolved_at || null,
        responseTime: i.response_time || null,
        notes: i.notes || null,
      },
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incident.',
      error: error.message,
    });
  }
};

/**
 * Create new incident
 */
const create = async (req, res) => {
  try {
    const {
      title,
      description,
      siteId,
      reportedById,
      severity,
      category,
      location,
      gpsCoords,
      assignedTo,
    } = req.body;

    if (!title || !siteId || !severity || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, site, severity, and category are required.',
      });
    }

    const incidentCode = `INC${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO incidents
         (incident_code, title, description, site_id, reported_by_id, severity, status,
          category, location, gps_coords, assigned_to, timestamp, attachment_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 0)
       RETURNING *`,
      [
        incidentCode,
        title,
        description || null,
        siteId,
        reportedById || null,
        severity,
        'open',
        category,
        location || null,
        gpsCoords || null,
        assignedTo || null,
      ]
    );

    // Increment incidents_reported on the guard if reportedById provided
    if (reportedById) {
      await query(
        `UPDATE personnel SET incidents_reported = incidents_reported + 1 WHERE id = $1`,
        [reportedById]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating incident.',
      error: error.message,
    });
  }
};

/**
 * Update incident (status changes, assignment, resolution)
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      severity,
      status,
      category,
      location,
      gpsCoords,
      assignedTo,
      resolvedAt,
      responseTime,
      notes,
    } = req.body;

    const result = await query(
      `UPDATE incidents SET
        title          = COALESCE($1,  title),
        description    = COALESCE($2,  description),
        severity       = COALESCE($3,  severity),
        status         = COALESCE($4,  status),
        category       = COALESCE($5,  category),
        location       = COALESCE($6,  location),
        gps_coords     = COALESCE($7,  gps_coords),
        assigned_to    = COALESCE($8,  assigned_to),
        resolved_at    = COALESCE($9,  resolved_at),
        response_time  = COALESCE($10, response_time),
        notes          = COALESCE($11, notes)
       WHERE id = $12
       RETURNING *`,
      [
        title, description, severity, status, category,
        location, gpsCoords, assignedTo, resolvedAt, responseTime, notes,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Incident updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating incident.',
      error: error.message,
    });
  }
};

/**
 * Delete incident
 */
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM incidents WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident not found.' });
    }

    res.status(200).json({ success: true, message: 'Incident deleted successfully.' });
  } catch (error) {
    console.error('Delete incident error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting incident.',
      error: error.message,
    });
  }
};

/**
 * Get incident statistics
 */
const getStats = async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(CASE WHEN status = 'open'          THEN 1 END)           AS open,
        COUNT(CASE WHEN status = 'investigating' THEN 1 END)           AS investigating,
        COUNT(CASE WHEN status = 'resolved'      THEN 1 END)           AS resolved,
        COUNT(CASE WHEN status = 'closed'        THEN 1 END)           AS closed,
        COUNT(CASE WHEN severity = 'critical'    THEN 1 END)           AS critical,
        COUNT(CASE WHEN severity = 'high'        THEN 1 END)           AS high,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '30 days' THEN 1 END) AS last_30_days
      FROM incidents
    `);

    // Average response time in minutes for resolved/closed incidents that have a response_time recorded
    const avgResponseResult = await query(`
      SELECT AVG(
        EXTRACT(EPOCH FROM (resolved_at - timestamp)) / 60
      )::numeric(10,0) AS avg_response_minutes
      FROM incidents
      WHERE resolved_at IS NOT NULL AND timestamp IS NOT NULL
        AND status IN ('resolved', 'closed')
    `);

    const row = statsResult.rows[0];
    const avgMins = parseInt(avgResponseResult.rows[0].avg_response_minutes) || 0;
    const avgHours = Math.floor(avgMins / 60);
    const avgRemainingMins = avgMins % 60;
    const avgResponseTime = avgMins > 0
      ? avgHours > 0
        ? `${avgHours}h ${avgRemainingMins}min`
        : `${avgMins}min`
      : '—';

    res.status(200).json({
      success: true,
      data: {
        total: parseInt(row.total),
        open: parseInt(row.open),
        investigating: parseInt(row.investigating),
        resolved: parseInt(row.resolved),
        closed: parseInt(row.closed),
        critical: parseInt(row.critical),
        high: parseInt(row.high),
        last30Days: parseInt(row.last_30_days),
        avgResponseTime,
      },
    });
  } catch (error) {
    console.error('Get incident stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incident statistics.',
      error: error.message,
    });
  }
};

module.exports = { getAll, getById, create, update, deleteItem, getStats };
