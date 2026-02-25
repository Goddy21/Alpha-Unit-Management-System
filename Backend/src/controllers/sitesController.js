const { query } = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { limit = 200, page = 1, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    let idx = 1;

    if (status && status !== 'all') {
      whereConditions.push(`status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      whereConditions.push(`(name ILIKE $${idx} OR site_code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM sites ${where} ORDER BY name LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM sites ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        sites: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ success: false, message: 'Error fetching sites.', error: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await query('SELECT * FROM sites WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ success: false, message: 'Error fetching site.', error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, siteCode, location, status = 'active', clientId, address, coordinates } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Site name is required.' });

    const result = await query(
      `INSERT INTO sites (name, site_code, location, status, client_id, address, coordinates)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, siteCode || null, location || null, status, clientId || null, address || null, coordinates || null]
    );
    res.status(201).json({ success: true, message: 'Site created successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ success: false, message: 'Error creating site.', error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, siteCode, location, status, clientId, address, coordinates } = req.body;
    const result = await query(
      `UPDATE sites SET
        name        = COALESCE($1, name),
        site_code   = COALESCE($2, site_code),
        location    = COALESCE($3, location),
        status      = COALESCE($4, status),
        client_id   = COALESCE($5, client_id),
        address     = COALESCE($6, address),
        coordinates = COALESCE($7, coordinates)
       WHERE id = $8 RETURNING *`,
      [name, siteCode, location, status, clientId, address, coordinates, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, message: 'Site updated successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ success: false, message: 'Error updating site.', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const result = await query('DELETE FROM sites WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, message: 'Site deleted successfully.' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ success: false, message: 'Error deleting site.', error: error.message });
  }
};

module.exports = { getAll, getById, create, update, deleteItem };