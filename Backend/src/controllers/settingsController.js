// settingsController.js
// Handles system-wide and per-user settings
// Routes: GET /settings, PUT /settings/system, PUT /settings/notifications, PUT /settings/appearance
// Sessions: GET /settings/sessions, DELETE /settings/sessions/:id, DELETE /settings/sessions

const { query } = require('../config/database');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Upsert a settings row by key
const upsertSetting = async (key, value, userId = null) => {
  const json = JSON.stringify(value);
  await query(`
    INSERT INTO system_settings (key, value, updated_by, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
  `, [key, json, userId]);
};

const getSetting = async (key, fallback = null) => {
  const result = await query('SELECT value FROM system_settings WHERE key = $1', [key]);
  if (result.rows.length === 0) return fallback;
  try { return JSON.parse(result.rows[0].value); } catch { return result.rows[0].value; }
};

// ── Controllers ───────────────────────────────────────────────────────────────

// GET /api/v1/settings
// Returns all settings relevant to the current user (system + their own prefs)
const getAll = async (req, res) => {
  try {
    const userId = req.user?.id;

    const [systemSettings, userNotifPrefs, userAppearance] = await Promise.all([
      getSetting('system', {
        company_name: 'ISMS Security',
        company_email: '',
        company_phone: '',
        company_address: '',
        session_timeout: 60,
        max_login_attempts: 5,
        password_expiry_days: 90,
        two_factor_enabled: false,
        audit_log_retention: 365,
        timezone: 'Africa/Nairobi',
        date_format: 'DD/MM/YYYY',
        currency: 'KES',
      }),
      getSetting(`notifications:${userId}`, {
        email_incidents: true,
        email_system: true,
        email_reports: false,
        push_incidents: true,
        push_alerts: true,
        sms_critical: false,
        digest_frequency: 'daily',
      }),
      getSetting(`appearance:${userId}`, {
        theme: 'dark',
        density: 'comfortable',
      }),
    ]);

    res.json({
      success: true,
      data: {
        system:        systemSettings,
        notifications: userNotifPrefs,
        appearance:    userAppearance,
      },
    });
  } catch (error) {
    console.error('Settings getAll error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load settings', error: error.message });
  }
};

// PUT /api/v1/settings/system  (Admin only — enforced in route)
const updateSystem = async (req, res) => {
  try {
    const {
      company_name, company_email, company_phone, company_address,
      session_timeout, max_login_attempts, password_expiry_days,
      two_factor_enabled, audit_log_retention, timezone, date_format, currency,
    } = req.body;

    // Merge with existing so partial updates don't wipe other keys
    const existing = await getSetting('system', {});
    const updated = {
      ...existing,
      ...(company_name          !== undefined && { company_name }),
      ...(company_email         !== undefined && { company_email }),
      ...(company_phone         !== undefined && { company_phone }),
      ...(company_address       !== undefined && { company_address }),
      ...(session_timeout       !== undefined && { session_timeout: Number(session_timeout) }),
      ...(max_login_attempts    !== undefined && { max_login_attempts: Number(max_login_attempts) }),
      ...(password_expiry_days  !== undefined && { password_expiry_days: Number(password_expiry_days) }),
      ...(two_factor_enabled    !== undefined && { two_factor_enabled: Boolean(two_factor_enabled) }),
      ...(audit_log_retention   !== undefined && { audit_log_retention: Number(audit_log_retention) }),
      ...(timezone              !== undefined && { timezone }),
      ...(date_format           !== undefined && { date_format }),
      ...(currency              !== undefined && { currency }),
    };

    await upsertSetting('system', updated, req.user?.id);

    // Log the change
    await query(`
      INSERT INTO activity_logs (user_id, action, details, created_at)
      VALUES ($1, 'system_settings_updated', $2, NOW())
    `, [req.user?.id, JSON.stringify({ updated_fields: Object.keys(req.body) })]).catch(() => {});

    res.json({ success: true, message: 'System settings updated', data: updated });
  } catch (error) {
    console.error('Settings updateSystem error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update system settings', error: error.message });
  }
};

// PUT /api/v1/settings/notifications
const updateNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const existing = await getSetting(`notifications:${userId}`, {});
    const updated = { ...existing, ...req.body };

    await upsertSetting(`notifications:${userId}`, updated, userId);

    res.json({ success: true, message: 'Notification preferences updated', data: updated });
  } catch (error) {
    console.error('Settings updateNotifications error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update notification preferences', error: error.message });
  }
};

// PUT /api/v1/settings/appearance
const updateAppearance = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { theme, density } = req.body;
    const existing = await getSetting(`appearance:${userId}`, {});
    const updated = {
      ...existing,
      ...(theme   && { theme }),
      ...(density && { density }),
    };

    await upsertSetting(`appearance:${userId}`, updated, userId);

    res.json({ success: true, message: 'Appearance updated', data: updated });
  } catch (error) {
    console.error('Settings updateAppearance error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update appearance', error: error.message });
  }
};

// GET /api/v1/settings/sessions
const getSessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await query(`
      SELECT id, user_agent, ip_address, last_used_at, created_at
      FROM refresh_tokens
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_used_at DESC
    `, [userId]);

    const sessions = result.rows.map(row => ({
      id:          row.id,
      device:      row.user_agent || 'Unknown device',
      ip:          row.ip_address || '—',
      last_active: row.last_used_at ? new Date(row.last_used_at).toLocaleString() : 'Unknown',
      created_at:  row.created_at,
    }));

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Settings getSessions error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions', error: error.message });
  }
};

// DELETE /api/v1/settings/sessions/:id — revoke one session
const revokeSession = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = await query(`
      DELETE FROM refresh_tokens WHERE id = $1 AND user_id = $2 RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Settings revokeSession error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to revoke session', error: error.message });
  }
};

// DELETE /api/v1/settings/sessions — revoke all sessions except current
const revokeAllSessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    // Keep the current token (identified by the Authorization header)
    const currentToken = req.headers.authorization?.replace('Bearer ', '');

    await query(`
      DELETE FROM refresh_tokens
      WHERE user_id = $1
        AND token != $2
    `, [userId, currentToken || '']);

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (error) {
    console.error('Settings revokeAllSessions error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to revoke sessions', error: error.message });
  }
};

module.exports = {
  getAll,
  updateSystem,
  updateNotifications,
  updateAppearance,
  getSessions,
  revokeSession,
  revokeAllSessions,
};