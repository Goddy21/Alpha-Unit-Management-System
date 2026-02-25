// portalController.js - Portal Users & Service Requests
const { query } = require('../config/database');

module.exports = {
  // GET /api/portal - Get all portal users with their service requests count
  getAll: async (req, res) => {
    try {
      const { status, company_id, role, type, tab = 'users' } = req.query;

      if (tab === 'requests') {
        // Return service requests
        let sql = `
          SELECT 
            sr.*,
            c.name AS client_name
          FROM service_requests sr
          LEFT JOIN clients c ON sr.client_id = c.id
          WHERE 1=1
        `;
        const params = [];

        if (status) {
          params.push(status);
          sql += ` AND sr.status = $${params.length}`;
        }
        if (company_id) {
          params.push(company_id);
          sql += ` AND sr.client_id = $${params.length}`;
        }
        if (type) {
          params.push(type);
          sql += ` AND sr.type = $${params.length}`;
        }

        sql += ` ORDER BY sr.submitted_date DESC`;

        const result = await query(sql, params);
        return res.json({ success: true, data: result.rows });
      }

      // Default: return portal users
      let sql = `
        SELECT 
          pu.*,
          c.name AS company_name,
          c.id AS company_id
        FROM portal_users pu
        LEFT JOIN clients c ON pu.client_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        sql += ` AND pu.status = $${params.length}`;
      }
      if (company_id) {
        params.push(company_id);
        sql += ` AND pu.client_id = $${params.length}`;
      }
      if (role) {
        params.push(role);
        sql += ` AND pu.role = $${params.length}`;
      }

      sql += ` ORDER BY pu.created_at DESC`;

      const result = await query(sql, params);
      return res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Portal getAll error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch portal data', error: error.message });
    }
  },

  // GET /api/portal/stats - Dashboard stats
  getStats: async (req, res) => {
    try {
      const [usersStats, requestsStats, avgResponse] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) AS total_users,
            COUNT(*) FILTER (WHERE status = 'active') AS active_users,
            COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_users,
            COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_users
          FROM portal_users
        `),
        query(`
          SELECT 
            COUNT(*) AS total_requests,
            COUNT(*) FILTER (WHERE status IN ('open', 'in-progress')) AS open_requests,
            COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_requests,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed_requests,
            COUNT(*) FILTER (WHERE priority = 'urgent') AS urgent_requests
          FROM service_requests
        `),
        query(`
          SELECT 
            AVG(EXTRACT(EPOCH FROM (resolved_date - submitted_date))/3600)::numeric(10,1) AS avg_hours
          FROM service_requests
          WHERE resolved_date IS NOT NULL
            AND submitted_date IS NOT NULL
        `),
      ]);

      const avgHours = parseFloat(avgResponse.rows[0]?.avg_hours || 0);
      const avgResponseTime = avgHours >= 1
        ? `${Math.floor(avgHours)}h ${Math.round((avgHours % 1) * 60)}min`
        : `${Math.round(avgHours * 60)}min`;

      res.json({
        success: true,
        data: {
          ...usersStats.rows[0],
          ...requestsStats.rows[0],
          avg_response_time: avgResponseTime,
        },
      });
    } catch (error) {
      console.error('Portal getStats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
    }
  },

  // GET /api/portal/:id - Get single portal user or service request
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const { type = 'user' } = req.query;

      if (type === 'request') {
        const result = await query(`
          SELECT 
            sr.*,
            c.name AS client_name
          FROM service_requests sr
          LEFT JOIN clients c ON sr.client_id = c.id
          WHERE sr.id = $1
        `, [id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Service request not found' });
        }
        return res.json({ success: true, data: result.rows[0] });
      }

      // Portal user
      const result = await query(`
        SELECT 
          pu.*,
          c.name AS company_name
        FROM portal_users pu
        LEFT JOIN clients c ON pu.client_id = c.id
        WHERE pu.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Portal user not found' });
      }

      // Get their recent service requests
      const requests = await query(`
        SELECT id, type, subject, status, priority, submitted_date
        FROM service_requests
        WHERE client_id = (SELECT client_id FROM portal_users WHERE id = $1)
        ORDER BY submitted_date DESC
        LIMIT 5
      `, [id]);

      res.json({
        success: true,
        data: { ...result.rows[0], recent_requests: requests.rows },
      });
    } catch (error) {
      console.error('Portal getById error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch record', error: error.message });
    }
  },

  // POST /api/portal - Create portal user or service request
  create: async (req, res) => {
    try {
      const { record_type = 'user' } = req.body;

      if (record_type === 'request') {
        const {
          client_id,
          type,
          subject,
          description,
          priority = 'medium',
        } = req.body;

        if (!client_id || !type || !subject || !description) {
          return res.status(400).json({
            success: false,
            message: 'client_id, type, subject, and description are required',
          });
        }

        const result = await query(`
          INSERT INTO service_requests 
            (client_id, type, subject, description, priority, status, submitted_date)
          VALUES ($1, $2, $3, $4, $5, 'open', NOW())
          RETURNING *
        `, [client_id, type, subject, description, priority]);

        return res.status(201).json({ success: true, data: result.rows[0] });
      }

      // Create portal user
      const {
        name,
        email,
        client_id,
        role = 'viewer',
        access_level,
        two_factor_enabled = false,
        permissions = {},
      } = req.body;

      if (!name || !email || !client_id) {
        return res.status(400).json({
          success: false,
          message: 'name, email, and client_id are required',
        });
      }

      // Check duplicate email
      const existing = await query('SELECT id FROM portal_users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      // Derive access_level from role if not provided
      const derivedAccessLevel = access_level || (
        role === 'primary' ? 'full' :
        role === 'secondary' ? 'limited' : 'read-only'
      );

      const result = await query(`
        INSERT INTO portal_users 
          (name, email, client_id, role, access_level, status, 
           two_factor_enabled, permissions, created_at)
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, NOW())
        RETURNING *
      `, [
        name,
        email,
        client_id,
        role,
        derivedAccessLevel,
        two_factor_enabled,
        JSON.stringify(permissions),
      ]);

      // Log activity
      await query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at)
        VALUES ($1, 'CREATE_PORTAL_USER', 'portal_users', $2, NOW())
      `, [req.user?.id, result.rows[0].id]).catch(() => {}); // Non-fatal

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Portal create error:', error);
      res.status(500).json({ success: false, message: 'Failed to create record', error: error.message });
    }
  },

  // PUT /api/portal/:id - Update portal user or service request
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { record_type = 'user' } = req.body;

      if (record_type === 'request') {
        const { status, assigned_to, resolved_date, priority } = req.body;

        const fields = [];
        const params = [];

        if (status) { params.push(status); fields.push(`status = $${params.length}`); }
        if (assigned_to !== undefined) { params.push(assigned_to); fields.push(`assigned_to = $${params.length}`); }
        if (priority) { params.push(priority); fields.push(`priority = $${params.length}`); }
        if (resolved_date || status === 'resolved') {
          params.push(resolved_date || new Date().toISOString());
          fields.push(`resolved_date = $${params.length}`);
        }

        if (fields.length === 0) {
          return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        params.push(id);
        const result = await query(`
          UPDATE service_requests SET ${fields.join(', ')}
          WHERE id = $${params.length}
          RETURNING *
        `, params);

        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Service request not found' });
        }
        return res.json({ success: true, data: result.rows[0] });
      }

      // Update portal user
      const {
        name, email, role, access_level, status,
        two_factor_enabled, permissions,
      } = req.body;

      const fields = [];
      const params = [];

      if (name) { params.push(name); fields.push(`name = $${params.length}`); }
      if (email) { params.push(email); fields.push(`email = $${params.length}`); }
      if (role) { params.push(role); fields.push(`role = $${params.length}`); }
      if (access_level) { params.push(access_level); fields.push(`access_level = $${params.length}`); }
      if (status) { params.push(status); fields.push(`status = $${params.length}`); }
      if (two_factor_enabled !== undefined) { params.push(two_factor_enabled); fields.push(`two_factor_enabled = $${params.length}`); }
      if (permissions) { params.push(JSON.stringify(permissions)); fields.push(`permissions = $${params.length}`); }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      params.push(id);
      const result = await query(`
        UPDATE portal_users SET ${fields.join(', ')}
        WHERE id = $${params.length}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Portal user not found' });
      }

      // Log activity
      await query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at)
        VALUES ($1, 'UPDATE_PORTAL_USER', 'portal_users', $2, NOW())
      `, [req.user?.id, id]).catch(() => {});

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Portal update error:', error);
      res.status(500).json({ success: false, message: 'Failed to update record', error: error.message });
    }
  },

  // DELETE /api/portal/:id - Delete portal user (Admin only)
  deleteItem: async (req, res) => {
    try {
      const { id } = req.params;
      const { record_type = 'user' } = req.query;

      if (record_type === 'request') {
        const result = await query(
          'DELETE FROM service_requests WHERE id = $1 RETURNING id', [id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Service request not found' });
        }
        return res.json({ success: true, message: 'Service request deleted' });
      }

      const result = await query(
        'DELETE FROM portal_users WHERE id = $1 RETURNING id, name', [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Portal user not found' });
      }

      await query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at)
        VALUES ($1, 'DELETE_PORTAL_USER', 'portal_users', $2, NOW())
      `, [req.user?.id, id]).catch(() => {});

      res.json({ success: true, message: `Portal user ${result.rows[0].name} deleted` });
    } catch (error) {
      console.error('Portal deleteItem error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete record', error: error.message });
    }
  },
};
