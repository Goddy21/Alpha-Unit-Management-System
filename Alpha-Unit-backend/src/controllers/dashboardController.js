const { query } = require('../config/database');

/**
 * GET /api/v1/dashboard/stats
 * Returns aggregate counts for the operations dashboard cards
 */
const getStats = async (req, res) => {
  try {
    const [
      activeSitesResult,
      guardsOnDutyResult,
      openIncidentsResult,
      activePatrolsResult,
      camerasOnlineResult,
      resolvedTodayResult,
    ] = await Promise.all([
      // Active sites
      query(`SELECT COUNT(*) AS count FROM sites WHERE status = 'active'`),

      // Guards currently on an ongoing shift
      query(`SELECT COUNT(*) AS count FROM shifts WHERE status = 'ongoing'`),

      // Open incidents
      query(`SELECT COUNT(*) AS count FROM incidents WHERE status IN ('open', 'investigating')`),

      // Active patrol routes
      query(`SELECT COUNT(*) AS count FROM patrol_routes WHERE status = 'active'`),

      // Cameras online
      query(`SELECT COUNT(*) AS count FROM cameras WHERE status = 'online'`),

      // Incidents resolved today
      query(`
        SELECT COUNT(*) AS count FROM incidents
        WHERE status IN ('resolved', 'closed')
        AND resolved_at >= CURRENT_DATE
      `),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeSites:    parseInt(activeSitesResult.rows[0].count),
        guardsOnDuty:   parseInt(guardsOnDutyResult.rows[0].count),
        openIncidents:  parseInt(openIncidentsResult.rows[0].count),
        activePatrols:  parseInt(activePatrolsResult.rows[0].count),
        camerasOnline:  parseInt(camerasOnlineResult.rows[0].count),
        resolvedToday:  parseInt(resolvedTodayResult.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/v1/dashboard/activity
 * Returns recent activity feed items across incidents, patrols, cameras
 */
const getActivity = async (req, res) => {
  try {
    const result = await query(`
      SELECT 'incident' AS type, title, created_at AS time, severity AS meta
      FROM incidents ORDER BY created_at DESC LIMIT 5
      UNION ALL
      SELECT 'patrol' AS type, 
             CONCAT('Patrol started at site') AS title,
             start_time AS time, status AS meta
      FROM patrol_routes ORDER BY start_time DESC LIMIT 5
      UNION ALL
      SELECT 'camera' AS type,
             CONCAT(name, ' - ', event_type) AS title,
             timestamp AS time, event_type AS meta
      FROM camera_events
      JOIN cameras ON cameras.id = camera_events.camera_id
      ORDER BY timestamp DESC LIMIT 5
      ORDER BY time DESC
      LIMIT 10
    `);

    res.status(200).json({
      success: true,
      data: { activity: result.rows },
    });
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity feed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = { getStats, getActivity };
