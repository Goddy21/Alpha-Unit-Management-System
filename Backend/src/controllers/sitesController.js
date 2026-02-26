const { query } = require('../config/database');

function mapSite(s) {
  return {
    id:            s.id,
    siteCode:      s.site_code,
    name:          s.name,
    status:        s.status,
    address:       s.address || null,
    county:        s.county || null,
    clientId:      s.client_id || null,
    clientName:    s.client_name || null,
    contactPerson: s.contact_person || null,
    contactPhone:  s.contact_phone || null,
    riskLevel:     s.risk_level || 'medium',
    guardCount:    parseInt(s.guard_count) || 0,
    cameraCount:   parseInt(s.camera_count) || 0,
    notes:         s.notes || null,
    createdAt:     s.created_at,
  };
}

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 100, status, search, clientId } = req.query;
    const offset = (page - 1) * limit;

    let where = []; let params = []; let idx = 1;
    if (status && status !== 'all') { where.push(`s.status = $${idx++}`); params.push(status); }
    if (clientId) { where.push(`s.client_id = $${idx++}`); params.push(clientId); }
    if (search) {
      where.push(`(s.name ILIKE $${idx} OR s.site_code ILIKE $${idx} OR s.address ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         s.*,
         c.name AS client_name,
         (SELECT COUNT(*) FROM shifts sh WHERE sh.site_id = s.id AND sh.status = 'ongoing') AS guard_count,
         (SELECT COUNT(*) FROM cameras cam WHERE cam.site_id = s.id) AS camera_count
       FROM sites s
       LEFT JOIN clients c ON s.client_id = c.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM sites s ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        sites: result.rows.map(mapSite),
        pagination: {
          page: parseInt(page), limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ success: false, message: 'Error fetching sites.', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, c.name AS client_name,
         (SELECT COUNT(*) FROM shifts sh WHERE sh.site_id = s.id AND sh.status = 'ongoing') AS guard_count,
         (SELECT COUNT(*) FROM cameras cam WHERE cam.site_id = s.id) AS camera_count
       FROM sites s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, data: mapSite(result.rows[0]) });
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ success: false, message: 'Error fetching site.', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

const getStats = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(CASE WHEN status = 'active'    THEN 1 END) AS active,
        COUNT(CASE WHEN status = 'inactive'  THEN 1 END) AS inactive,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) AS suspended
      FROM sites
    `);
    
    if (!result || !result.rows || result.rows.length === 0) {
      return res.json({
        success: true,
        data: { total: 0, active: 0, inactive: 0, suspended: 0 },
      });
    }

    const r = result.rows[0];
    res.json({
      success: true,
      data: {
        total:     parseInt(r.total) || 0,
        active:    parseInt(r.active) || 0,
        inactive:  parseInt(r.inactive) || 0,
        suspended: parseInt(r.suspended) || 0,
      },
    });
  } catch (error) {
    console.error('Get site stats error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching stats.', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

const create = async (req, res) => {
  try {
    const {
      name, address, county, clientId, contactPerson,
      contactPhone, status = 'active', riskLevel = 'medium', notes,
    } = req.body;

    if (!name || !address)
      return res.status(400).json({ success: false, message: 'Name and address are required.' });

    const siteCode = `SITE${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    // Check for duplicate site code (unlikely but safe)
    const existing = await query('SELECT id FROM sites WHERE site_code = $1', [siteCode]);
    const finalCode = existing.rows.length > 0
      ? `SITE${String(Math.floor(Math.random() * 900000) + 100000)}`
      : siteCode;

    const result = await query(
      `INSERT INTO sites
         (site_code, name, address, county, client_id, contact_person,
          contact_phone, status, risk_level, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [finalCode, name, address, county || null, clientId || null,
       contactPerson || null, contactPhone || null, status, riskLevel, notes || null]
    );

    res.status(201).json({
      success: true,
      message: 'Site created successfully.',
      data: mapSite(result.rows[0]),
    });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ success: false, message: 'Error creating site.', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const {
      name, address, county, clientId, contactPerson,
      contactPhone, status, riskLevel, notes,
    } = req.body;

    const result = await query(
      `UPDATE sites SET
        name           = COALESCE($1, name),
        address        = COALESCE($2, address),
        county         = COALESCE($3, county),
        client_id      = COALESCE($4, client_id),
        contact_person = COALESCE($5, contact_person),
        contact_phone  = COALESCE($6, contact_phone),
        status         = COALESCE($7, status),
        risk_level     = COALESCE($8, risk_level),
        notes          = COALESCE($9, notes)
       WHERE id = $10
       RETURNING *`,
      [name, address, county, clientId || null, contactPerson,
       contactPhone, status, riskLevel, notes, req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Site not found.' });

    res.json({ success: true, message: 'Site updated.', data: mapSite(result.rows[0]) });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ success: false, message: 'Error updating site.', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM sites WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, message: 'Site deleted.' });
  } catch (error) {
    console.error('Delete site error:', error);
    // FK constraint — site has active shifts/cameras
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete site — it has linked shifts, cameras, or incidents. Deactivate it instead.',
      });
    }
    res.status(500).json({ success: false, message: 'Error deleting site.', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

module.exports = { getAll, getById, getStats, create, update, deleteItem };