// src/controllers/personnelController.js
const { query, transaction } = require('../config/database');

/**
 * Get all personnel with pagination and filters
 */
const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    // Whitelist sortBy to prevent SQL injection
    const allowedSortFields = ['created_at', 'name', 'rating', 'shifts_completed', 'join_date'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // Keep filter params separate from pagination params
    let whereConditions = [];
    let filterParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(p.name ILIKE $${paramIndex} OR p.employee_id ILIKE $${paramIndex} OR p.psra_license ILIKE $${paramIndex})`
      );
      filterParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`p.status = $${paramIndex}`);
      filterParams.push(status);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const personnelQuery = `
      SELECT
        p.*,
        s.name AS current_site_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',          c.id,
              'name',        c.name,
              'issue_date',  c.issue_date,
              'expiry_date', c.expiry_date,
              'status',      c.status
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS certifications
      FROM personnel p
      LEFT JOIN sites s ON p.current_site_id = s.id
      LEFT JOIN certifications c ON p.id = c.personnel_id
      ${whereClause}
      GROUP BY p.id, s.name
      ORDER BY p.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const personnelParams = [...filterParams, parseInt(limit), parseInt(offset)];
    const personnelResult = await query(personnelQuery, personnelParams);

    // Count query uses only filter params — never pagination params
    const countQuery = `SELECT COUNT(*) AS total FROM personnel p ${whereClause}`;
    const countResult = await query(countQuery, filterParams);
    const total = parseInt(countResult.rows[0].total);

    const personnel = personnelResult.rows.map((person) => ({
      id: person.id,
      guard_code: person.guard_code,
      name: person.name,
      employeeId: person.employee_id,
      phone: person.phone,
      email: person.email,
      psraLicense: person.psra_license,
      psraExpiry: person.psra_expiry,
      status: person.status,
      currentSite: person.current_site_name || '—',
      joinDate: person.join_date,
      trainingHours: person.training_hours || 0,
      rating: parseFloat(person.rating) || 0,
      shiftsCompleted: person.shifts_completed || 0,
      incidentsReported: person.incidents_reported || 0,
      certifications: (person.certifications || []).map((c) => ({
        id: c.id,
        name: c.name,
        issueDate: c.issue_date,
        expiryDate: c.expiry_date,
        status: c.status,
      })),
    }));

    res.status(200).json({
      success: true,
      data: {
        personnel,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching personnel.',
      error: error.message,
    });
  }
};

/**
 * Get personnel by ID with full details
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const personnelResult = await query(
      `SELECT p.*, s.name AS current_site_name, s.id AS current_site_id
       FROM personnel p
       LEFT JOIN sites s ON p.current_site_id = s.id
       WHERE p.id = $1`,
      [id]
    );

    if (personnelResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Personnel not found.' });
    }

    const person = personnelResult.rows[0];

    const certificationsResult = await query(
      'SELECT * FROM certifications WHERE personnel_id = $1 ORDER BY expiry_date',
      [id]
    );

    const shiftsResult = await query(
      `SELECT sh.*, s.name AS site_name
       FROM shifts sh
       LEFT JOIN sites s ON sh.site_id = s.id
       WHERE sh.personnel_id = $1
       ORDER BY sh.shift_date DESC, sh.start_time DESC
       LIMIT 5`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        id: person.id,
        guard_code: person.guard_code,
        name: person.name,
        employeeId: person.employee_id,
        phone: person.phone,
        email: person.email,
        psraLicense: person.psra_license,
        psraExpiry: person.psra_expiry,
        status: person.status,
        currentSite: person.current_site_name || '—',
        currentSiteId: person.current_site_id,
        joinDate: person.join_date,
        trainingHours: person.training_hours || 0,
        rating: parseFloat(person.rating) || 0,
        shiftsCompleted: person.shifts_completed || 0,
        incidentsReported: person.incidents_reported || 0,
        certifications: certificationsResult.rows.map((cert) => ({
          id: cert.id,
          name: cert.name,
          issueDate: cert.issue_date,
          expiryDate: cert.expiry_date,
          status: cert.status,
          fileUrl: cert.file_url,
        })),
        recentShifts: shiftsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching personnel.',
      error: error.message,
    });
  }
};

/**
 * Create new personnel
 */
const create = async (req, res) => {
  try {
    const { name, phone, email, psraLicense, psraExpiry, joinDate, certifications = [] } = req.body;

    if (!name || !email || !psraLicense) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and PSRA license are required.',
      });
    }

    const guardCode = `GRD${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    const employeeId = `EMP${new Date().getFullYear()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    const result = await transaction(async (client) => {
      const personnelResult = await client.query(
        `INSERT INTO personnel (guard_code, name, employee_id, phone, email, psra_license, psra_expiry, status, join_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          guardCode,
          name,
          employeeId,
          phone || null,
          email,
          psraLicense,
          psraExpiry || null,
          'active',
          joinDate || new Date().toISOString().split('T')[0],
        ]
      );

      const newPersonnel = personnelResult.rows[0];

      let createdCertifications = [];
      for (const cert of certifications) {
        const certResult = await client.query(
          `INSERT INTO certifications (personnel_id, name, issue_date, expiry_date, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [newPersonnel.id, cert.name, cert.issueDate, cert.expiryDate, cert.status || 'valid']
        );
        createdCertifications.push(certResult.rows[0]);
      }

      return { personnel: newPersonnel, certifications: createdCertifications };
    });

    res.status(201).json({
      success: true,
      message: 'Personnel created successfully.',
      data: result,
    });
  } catch (error) {
    console.error('Create personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating personnel.',
      error: error.message,
    });
  }
};

/**
 * Update personnel
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, psraLicense, psraExpiry, status, currentSiteId, trainingHours, rating } =
      req.body;

    const result = await query(
      `UPDATE personnel SET
        name            = COALESCE($1, name),
        phone           = COALESCE($2, phone),
        email           = COALESCE($3, email),
        psra_license    = COALESCE($4, psra_license),
        psra_expiry     = COALESCE($5, psra_expiry),
        status          = COALESCE($6, status),
        current_site_id = COALESCE($7, current_site_id),
        training_hours  = COALESCE($8, training_hours),
        rating          = COALESCE($9, rating)
       WHERE id = $10
       RETURNING *`,
      [name, phone, email, psraLicense, psraExpiry, status, currentSiteId, trainingHours, rating, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Personnel not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Personnel updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating personnel.',
      error: error.message,
    });
  }
};

/**
 * Delete personnel
 */
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM personnel WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Personnel not found.' });
    }

    res.status(200).json({ success: true, message: 'Personnel deleted successfully.' });
  } catch (error) {
    console.error('Delete personnel error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting personnel.',
      error: error.message,
    });
  }
};

/**
 * Get personnel statistics
 */
const getStats = async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(CASE WHEN status = 'active'    THEN 1 END)     AS active,
        COUNT(CASE WHEN status = 'on-leave'  THEN 1 END)     AS on_leave,
        COUNT(CASE WHEN status = 'inactive'  THEN 1 END)     AS inactive,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END)     AS suspended,
        AVG(rating)                                           AS avg_rating,
        SUM(shifts_completed)                                 AS total_shifts
      FROM personnel
    `);

    const expiringCertsResult = await query(`
      SELECT COUNT(DISTINCT personnel_id) AS expiring_certs
      FROM certifications
      WHERE status IN ('expiring', 'expired')
    `);

    res.status(200).json({
      success: true,
      data: {
        total: parseInt(statsResult.rows[0].total),
        active: parseInt(statsResult.rows[0].active),
        onLeave: parseInt(statsResult.rows[0].on_leave),
        inactive: parseInt(statsResult.rows[0].inactive),
        suspended: parseInt(statsResult.rows[0].suspended),
        avgRating: parseFloat(statsResult.rows[0].avg_rating) || 0,
        totalShifts: parseInt(statsResult.rows[0].total_shifts) || 0,
        expiringCerts: parseInt(expiringCertsResult.rows[0].expiring_certs) || 0,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching personnel statistics.',
      error: error.message,
    });
  }
};

/**
 * Add certification to personnel
 */
const addCertification = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, issueDate, expiryDate, status = 'valid' } = req.body;

    if (!name || !issueDate || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Certification name, issue date, and expiry date are required.',
      });
    }

    const result = await query(
      `INSERT INTO certifications (personnel_id, name, issue_date, expiry_date, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, issueDate, expiryDate, status]
    );

    res.status(201).json({
      success: true,
      message: 'Certification added successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Add certification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding certification.',
      error: error.message,
    });
  }
};

/**
 * Get personnel certifications
 */
const getCertifications = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM certifications WHERE personnel_id = $1 ORDER BY expiry_date',
      [id]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get certifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching certifications.',
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
  addCertification,
  getCertifications,
};
