// patrolController.js — rewritten to match actual isms_db schema
//
// patrol_routes actual columns:
//   id, route_code, personnel_id, site_id, start_time, end_time,
//   checkpoints_total, checkpoints_completed, status, distance,
//   duration, created_at, updated_at
//
// patrol_checkpoints FK column: route_id (not patrol_route_id)

const { query } = require('../config/database');

module.exports = {

  // GET /api/v1/patrol
  getAll: async (req, res) => {
    try {
      const { status, site_id, guard_id, date, limit = 50, offset = 0 } = req.query;

      let sql = `
        SELECT
          pr.id,
          pr.route_code,
          pr.personnel_id          AS guard_id,
          pr.site_id,
          pr.start_time,
          pr.end_time,
          pr.status,
          pr.distance              AS distance_covered,
          pr.duration,
          pr.checkpoints_total     AS total_checkpoints,
          pr.checkpoints_completed AS completed_checkpoints,
          pr.created_at,
          pr.updated_at,
          p.name                   AS guard_name,
          p.employee_id            AS guard_employee_id,
          s.name                   AS site_name,
          s.site_code
        FROM patrol_routes pr
        LEFT JOIN personnel p ON pr.personnel_id = p.id
        LEFT JOIN sites     s ON pr.site_id      = s.id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        sql += ` AND pr.status = $${params.length}`;
      }
      if (site_id) {
        params.push(site_id);
        sql += ` AND pr.site_id = $${params.length}`;
      }
      if (guard_id) {
        params.push(guard_id);
        sql += ` AND pr.personnel_id = $${params.length}`;
      }
      if (date) {
        params.push(date);
        sql += ` AND DATE(pr.start_time) = $${params.length}`;
      }

      sql += ` ORDER BY pr.start_time DESC`;
      params.push(parseInt(limit));  sql += ` LIMIT  $${params.length}`;
      params.push(parseInt(offset)); sql += ` OFFSET $${params.length}`;

      const result = await query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Patrol getAll error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch patrols', error: error.message });
    }
  },

  // GET /api/v1/patrol/stats
  getStats: async (req, res) => {
    try {
      const { date } = req.query;
      const dateFilter = date || new Date().toISOString().split('T')[0];

      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')                               AS active,
          COUNT(*) FILTER (WHERE status = 'completed' AND DATE(start_time) = $1)  AS completed_today,
          COUNT(*) FILTER (WHERE status = 'deviation')                            AS deviations,
          COUNT(*) FILTER (WHERE status = 'delayed')                              AS delayed,
          COALESCE(SUM(distance), 0)                                              AS total_distance
        FROM patrol_routes
        WHERE DATE(start_time) = $1
           OR status = 'active'
      `, [dateFilter]);

      const row = result.rows[0];
      res.json({
        success: true,
        data: {
          active:          Number(row.active),
          completed_today: Number(row.completed_today),
          deviations:      Number(row.deviations),
          delayed:         Number(row.delayed),
          total_distance:  parseFloat(row.total_distance || 0).toFixed(1) + ' km',
        },
      });
    } catch (error) {
      console.error('Patrol getStats error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch patrol stats', error: error.message });
    }
  },

  // GET /api/v1/patrol/:id
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const patrolResult = await query(`
        SELECT
          pr.id,
          pr.route_code,
          pr.personnel_id          AS guard_id,
          pr.site_id,
          pr.start_time,
          pr.end_time,
          pr.status,
          pr.distance              AS distance_covered,
          pr.duration,
          pr.checkpoints_total     AS total_checkpoints,
          pr.checkpoints_completed AS completed_checkpoints,
          pr.created_at,
          pr.updated_at,
          p.name                   AS guard_name,
          p.employee_id            AS guard_employee_id,
          s.name                   AS site_name,
          s.site_code
        FROM patrol_routes pr
        LEFT JOIN personnel p ON pr.personnel_id = p.id
        LEFT JOIN sites     s ON pr.site_id      = s.id
        WHERE pr.id = $1
      `, [id]);

      if (patrolResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Patrol not found' });
      }

      // FK column on patrol_checkpoints is route_id
      const checkpointsResult = await query(`
        SELECT * FROM patrol_checkpoints
        WHERE route_id = $1
        ORDER BY sequence_order ASC
      `, [id]);

      res.json({
        success: true,
        data: {
          ...patrolResult.rows[0],
          checkpoints: checkpointsResult.rows,
        },
      });
    } catch (error) {
      console.error('Patrol getById error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch patrol', error: error.message });
    }
  },

  // POST /api/v1/patrol
  create: async (req, res) => {
    try {
      const { guard_id, site_id, start_time, checkpoints = [] } = req.body;

      if (!guard_id || !site_id) {
        return res.status(400).json({ success: false, message: 'guard_id and site_id are required' });
      }

      const route_code = `PTR${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

      const result = await query(`
        INSERT INTO patrol_routes
          (route_code, personnel_id, site_id, start_time, status,
           checkpoints_total, checkpoints_completed)
        VALUES ($1, $2, $3, $4, 'active', $5, 0)
        RETURNING *
      `, [
        route_code,
        guard_id,
        site_id,
        start_time || new Date().toISOString(),
        checkpoints.length,
      ]);

      const patrol = result.rows[0];

      for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        await query(`
          INSERT INTO patrol_checkpoints
            (route_id, name, location, sequence_order, status)
          VALUES ($1, $2, $3, $4, 'pending')
        `, [patrol.id, cp.name, cp.location || null, i + 1]);
      }

      res.status(201).json({ success: true, data: patrol });
    } catch (error) {
      console.error('Patrol create error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to create patrol', error: error.message });
    }
  },

  // PUT /api/v1/patrol/:id
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, end_time, distance_covered, duration, checkpoint_id, checkpoint_status } = req.body;

      // ── Checkpoint toggle ─────────────────────────────────────────────────
      if (checkpoint_id) {
        const cpResult = await query(`
          UPDATE patrol_checkpoints
          SET status = $1, visited_at = NOW()
          WHERE id = $2 AND route_id = $3
          RETURNING *
        `, [checkpoint_status || 'completed', checkpoint_id, id]);

        if (cpResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Checkpoint not found' });
        }

        // Keep denormalised completed count in sync
        const countResult = await query(`
          SELECT
            COUNT(*)                                      AS total,
            COUNT(*) FILTER (WHERE status = 'completed')  AS completed
          FROM patrol_checkpoints WHERE route_id = $1
        `, [id]);

        const { total, completed } = countResult.rows[0];
        const allDone = parseInt(total) > 0 && parseInt(completed) === parseInt(total);

        await query(`
          UPDATE patrol_routes
          SET checkpoints_completed = $1
            ${allDone ? ", status = 'completed', end_time = NOW()" : ''}
          WHERE id = $2
        `, [parseInt(completed), id]);

        return res.json({ success: true, data: cpResult.rows[0] });
      }

      // ── Patrol update ─────────────────────────────────────────────────────
      const fields = [];
      const params = [];

      if (status) {
        params.push(status);
        fields.push(`status = $${params.length}`);
      }
      if (end_time) {
        params.push(end_time);
        fields.push(`end_time = $${params.length}`);
      }
      if (distance_covered != null) {
        params.push(distance_covered);
        fields.push(`distance = $${params.length}`);
      }
      if (duration != null) {
        params.push(duration);
        fields.push(`duration = $${params.length}`);
      }
      // Auto end_time when completing without explicit end_time
      if (status === 'completed' && !end_time) {
        fields.push(`end_time = NOW()`);
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      params.push(id);
      const result = await query(
        `UPDATE patrol_routes SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Patrol not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Patrol update error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to update patrol', error: error.message });
    }
  },

  // DELETE /api/v1/patrol/:id
  deleteItem: async (req, res) => {
    try {
      const { id } = req.params;

      await query('DELETE FROM patrol_checkpoints WHERE route_id = $1', [id]);

      const result = await query(
        'DELETE FROM patrol_routes WHERE id = $1 RETURNING id', [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Patrol not found' });
      }

      res.json({ success: true, message: 'Patrol deleted' });
    } catch (error) {
      console.error('Patrol deleteItem error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to delete patrol', error: error.message });
    }
  },
};