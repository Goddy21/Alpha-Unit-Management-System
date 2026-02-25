// notificationsController.js
const { query } = require('../config/database');

// ─── Schema probe (runs once on first request) ────────────────────────────────
// Detects actual column names so the controller works regardless of naming convention

let schemaCache = null;

async function getSchema() {
  if (schemaCache) return schemaCache;

  const tableCheck = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'notifications'
    ) AS exists
  `);

  if (!tableCheck.rows[0].exists) {
    throw new Error(
      "Table 'notifications' does not exist. Run the CREATE TABLE migration at the bottom of notificationsController.js."
    );
  }

  const cols = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications'
  `);

  const columnSet = new Set(cols.rows.map(r => r.column_name));

  schemaCache = {
    id: 'id',
    type: 'type',
    priority: 'priority',
    action_required: 'action_required',
    recipient_type: 'recipient_type',
    timestamp: 'created_at',
    read_by: 'read_by',
    all_columns: columnSet,
  };

  console.log('[notifications] Schema resolved:', Object.fromEntries(
    Object.entries(schemaCache).filter(([k]) => k !== 'all_columns')
  ));
  return schemaCache;
}

module.exports = {
  // GET /api/v1/notifications
  getAll: async (req, res) => {
    try {
      const schema = await getSchema();
      const { type, priority, read, recipient_type, action_required, limit = 50, offset = 0 } = req.query;

      const userId   = req.user?.id;
      const userRole = req.user?.role?.toLowerCase();

      let sql = `
        SELECT * FROM notifications
        WHERE (
          ${schema.recipient_type} = 'all'
          OR ${schema.recipient_type} = $1
        )
      `;
      const params = [userRole || 'all'];

      if (type)             { params.push(type);                 sql += ` AND ${schema.type}             = $${params.length}`; }
      if (priority)         { params.push(priority);             sql += ` AND ${schema.priority}         = $${params.length}`; }
      if (read !== undefined){ params.push(read === 'true');     sql += ` AND ${schema.read}             = $${params.length}`; }
      if (recipient_type)   { params.push(recipient_type);       sql += ` AND ${schema.recipient_type}   = $${params.length}`; }
      if (action_required !== undefined) {
        params.push(action_required === 'true');
        sql += ` AND ${schema.action_required} = $${params.length}`;
      }

      sql += ` ORDER BY created_at DESC`;
      params.push(parseInt(limit));  sql += ` LIMIT $${params.length}`;
      params.push(parseInt(offset)); sql += ` OFFSET $${params.length}`;

      const result = await query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Notifications getAll error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
    }
  },

  // GET /api/v1/notifications/stats
  getStats: async (req, res) => {
    try {
      const schema = await getSchema();
      const userId   = req.user?.id;
      const userRole = req.user?.role?.toLowerCase();

      const result = await query(`
        SELECT
          COUNT(*) AS total,

          COUNT(*) FILTER (
            WHERE NOT (${schema.read_by} @> to_jsonb(ARRAY[$2]::uuid[]))
          ) AS unread,

          COUNT(*) FILTER (
            WHERE ${schema.priority} = 'critical'
          ) AS critical,

          COUNT(*) FILTER (
            WHERE ${schema.action_required} = true
            AND NOT (${schema.read_by} @> to_jsonb(ARRAY[$2]::uuid[]))
          ) AS action_required

        FROM notifications
        WHERE (
          ${schema.recipient_type} = 'all'
          OR ${schema.recipient_type} = $1
        )
      `, [userRole || 'all', userId]);

      const row = result.rows[0];

      res.json({
        success: true,
        data: {
          total:           Number(row.total),
          unread:          Number(row.unread),
          critical:        Number(row.critical),
          action_required: Number(row.action_required),
        },
      });

    } catch (error) {
      console.error('Notifications getStats error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
        error: error.message
      });
    }
  },

  // GET /api/v1/notifications/:id
  getById: async (req, res) => {
    try {
      const schema = await getSchema();
      const result = await query(`SELECT * FROM notifications WHERE ${schema.id} = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Notification not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Notifications getById error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch notification', error: error.message });
    }
  },

  // POST /api/v1/notifications
  create: async (req, res) => {
    try {
      const schema = await getSchema();

      const {
        type,
        title,
        message,
        priority = 'medium',
        category = null,
        action_required = false,
        link = null,
        recipient_type = 'all'
      } = req.body;

      if (!type || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'type, title, and message are required'
        });
      }

      const result = await query(`
        INSERT INTO notifications
          (${schema.type}, title, message, ${schema.priority}, category,
          ${schema.action_required}, link, ${schema.recipient_type})
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [type, title, message, priority, category, action_required, link, recipient_type]);

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Notifications create error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: error.message
      });
    }
  },

  // PUT /api/v1/notifications/:id
  update: async (req, res) => {
    try {
      const schema = await getSchema();
      const { id } = req.params;
      const { read, title, message, priority, action_required } = req.body;

      const fields = [];
      const params = [];

      if (read !== undefined)            { params.push(read);            fields.push(`${schema.read}             = $${params.length}`); }
      if (title !== undefined)           { params.push(title);           fields.push(`title                      = $${params.length}`); }
      if (message !== undefined)         { params.push(message);         fields.push(`message                    = $${params.length}`); }
      if (priority !== undefined)        { params.push(priority);        fields.push(`${schema.priority}         = $${params.length}`); }
      if (action_required !== undefined) { params.push(action_required); fields.push(`${schema.action_required}  = $${params.length}`); }

      if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

      params.push(id);
      const result = await query(
        `UPDATE notifications SET ${fields.join(', ')} WHERE ${schema.id} = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Notification not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Notifications update error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to update notification', error: error.message });
    }
  },

  // DELETE /api/v1/notifications/:id
  deleteItem: async (req, res) => {
    try {
      const schema = await getSchema();
      const { id } = req.params;

      if (id === 'read-all') {
        const userId   = req.user?.id;
        const userRole = req.user?.role?.toLowerCase();
        await query(`
          DELETE FROM notifications
          WHERE ${schema.read} = true
          AND (${schema.recipient_type} = 'all' OR ${schema.recipient_type} = $1)
        `, [userRole || 'all', userId]);
        return res.json({ success: true, message: 'All read notifications deleted' });
      }

      const result = await query(
        `DELETE FROM notifications WHERE ${schema.id} = $1 RETURNING ${schema.id}`, [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Notification not found' });
      res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
      console.error('Notifications deleteItem error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to delete notification', error: error.message });
    }
  },
};