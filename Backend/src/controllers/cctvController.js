const { query } = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, siteId, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    let idx = 1;

    if (status && status !== 'all') {
      whereConditions.push(`c.status = $${idx++}`);
      params.push(status);
    }
    if (siteId) {
      whereConditions.push(`c.site_id = $${idx++}`);
      params.push(siteId);
    }
    if (search) {
      whereConditions.push(`(c.name ILIKE $${idx} OR c.camera_code ILIKE $${idx} OR c.location ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT c.*, s.name AS site_name, s.site_code
       FROM cameras c
       LEFT JOIN sites s ON c.site_id = s.id
       ${where}
       ORDER BY c.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM cameras c LEFT JOIN sites s ON c.site_id = s.id ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        cameras: result.rows.map(mapCamera),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get cameras error:', error);
    res.status(500).json({ success: false, message: 'Error fetching cameras.', error: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, s.name AS site_name, s.site_code
       FROM cameras c LEFT JOIN sites s ON c.site_id = s.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    res.json({ success: true, data: mapCamera(result.rows[0]) });
  } catch (error) {
    console.error('Get camera error:', error);
    res.status(500).json({ success: false, message: 'Error fetching camera.', error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(CASE WHEN status = 'online'          THEN 1 END) AS online,
        COUNT(CASE WHEN status = 'offline'         THEN 1 END) AS offline,
        COUNT(CASE WHEN status = 'motion-detected' THEN 1 END) AS motion_detected,
        COUNT(CASE WHEN status = 'maintenance'     THEN 1 END) AS maintenance,
        COUNT(CASE WHEN recording_enabled = true   THEN 1 END) AS recording
      FROM cameras
    `);
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        total:          parseInt(row.total),
        online:         parseInt(row.online),
        offline:        parseInt(row.offline),
        motionDetected: parseInt(row.motion_detected),
        maintenance:    parseInt(row.maintenance),
        recording:      parseInt(row.recording),
        alerts:         parseInt(row.motion_detected),
      },
    });
  } catch (error) {
    console.error('Get camera stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching camera stats.', error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, siteId, location, status = 'online', recordingEnabled = true, streamUrl, cameraCode } = req.body;
    if (!name || !siteId)
      return res.status(400).json({ success: false, message: 'Name and site are required.' });

    const code = cameraCode || `CAM${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const result = await query(
      `INSERT INTO cameras (camera_code, name, site_id, location, status, recording_enabled, stream_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [code, name, siteId, location || null, status, recordingEnabled, streamUrl || null]
    );
    res.status(201).json({ success: true, message: 'Camera added successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Create camera error:', error);
    res.status(500).json({ success: false, message: 'Error creating camera.', error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, siteId, location, status, recordingEnabled, streamUrl } = req.body;
    const result = await query(
      `UPDATE cameras SET
        name               = COALESCE($1, name),
        site_id            = COALESCE($2, site_id),
        location           = COALESCE($3, location),
        status             = COALESCE($4, status),
        recording_enabled  = COALESCE($5, recording_enabled),
        stream_url         = COALESCE($6, stream_url),
        last_activity      = NOW()
       WHERE id = $7 RETURNING *`,
      [name, siteId, location, status, recordingEnabled, streamUrl, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    res.json({ success: true, message: 'Camera updated successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Update camera error:', error);
    res.status(500).json({ success: false, message: 'Error updating camera.', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const result = await query('DELETE FROM cameras WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    res.json({ success: true, message: 'Camera deleted successfully.' });
  } catch (error) {
    console.error('Delete camera error:', error);
    res.status(500).json({ success: false, message: 'Error deleting camera.', error: error.message });
  }
};

// ── helper ──────────────────────────────────────────────────────────────────
function mapCamera(c) {
  return {
    id:               c.id,
    cameraCode:       c.camera_code,
    name:             c.name,
    siteId:           c.site_id,
    siteName:         c.site_name || '—',
    siteCode:         c.site_code || '—',
    location:         c.location || '—',
    status:           c.status,
    recordingEnabled: c.recording_enabled ?? false,
    streamUrl:        c.stream_url || null,
    lastActivity:     c.last_activity || null,
    createdAt:        c.created_at,
  };
}

module.exports = { getAll, getById, getStats, create, update, deleteItem };