const { query } = require('../config/database');

const getReports = async (req, res) => {
  try {
    // Aggregate KPIs from real tables
    const [incidents, shifts, personnel, sites, invoices] = await Promise.all([
      query(`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) AS critical,
          COUNT(CASE WHEN severity = 'high'     THEN 1 END) AS high,
          COUNT(CASE WHEN status   = 'resolved' THEN 1 END) AS resolved,
          AVG(response_time)                                AS avg_response_time,
          COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '30 days' THEN 1 END) AS this_month,
          COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '60 days'
                      AND timestamp <  NOW() - INTERVAL '30 days' THEN 1 END) AS last_month
        FROM incidents
      `),
      query(`
        SELECT
          COUNT(*)                                           AS total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)  AS completed,
          COUNT(CASE WHEN status = 'missed'    THEN 1 END)  AS missed,
          COUNT(CASE WHEN status = 'active'    THEN 1 END)  AS active
        FROM shifts
      `),
      query(`SELECT COUNT(*) AS total FROM personnel WHERE status = 'active'`),
      query(`SELECT COUNT(*) AS total FROM sites`),
      query(`
        SELECT
          COALESCE(SUM(amount), 0)                              AS total_revenue,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) AS collected,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END)        AS overdue_count
        FROM invoices
      `),
    ]);

    const inc  = incidents.rows[0];
    const shft = shifts.rows[0];
    const inv  = invoices.rows[0];

    const thisMonth  = parseInt(inc.this_month) || 0;
    const lastMonth  = parseInt(inc.last_month) || 1;
    const incidentTrend = lastMonth > 0
      ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)
      : '0';

    const totalShifts     = parseInt(shft.total) || 1;
    const completedShifts = parseInt(shft.completed) || 0;
    const attendance      = ((completedShifts / totalShifts) * 100).toFixed(1);

    res.json({
      success: true,
      data: {
        kpis: {
          incidentsThisMonth: thisMonth,
          incidentTrend:      parseFloat(incidentTrend),
          avgResponseTime:    Math.round(parseFloat(inc.avg_response_time) || 0),
          guardAttendance:    parseFloat(attendance),
          totalPersonnel:     parseInt(personnel.rows[0].total),
          totalSites:         parseInt(sites.rows[0].total),
          totalRevenue:       parseFloat(inv.total_revenue),
          collected:          parseFloat(inv.collected),
          overdueInvoices:    parseInt(inv.overdue_count),
        },
        incidents: {
          total:    parseInt(inc.total),
          critical: parseInt(inc.critical),
          high:     parseInt(inc.high),
          resolved: parseInt(inc.resolved),
        },
        shifts: {
          total:     parseInt(shft.total),
          completed: completedShifts,
          missed:    parseInt(shft.missed),
          active:    parseInt(shft.active),
        },
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reports.', error: error.message });
  }
};

const getIncidentTrends = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', timestamp), 'Mon YYYY') AS month,
        DATE_TRUNC('month', timestamp)                       AS month_date,
        COUNT(*)                                             AS total,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END)   AS critical,
        COUNT(CASE WHEN severity = 'high'     THEN 1 END)   AS high,
        COUNT(CASE WHEN status   = 'resolved' THEN 1 END)   AS resolved,
        AVG(response_time)                                   AS avg_response
      FROM incidents
      WHERE timestamp >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', timestamp)
      ORDER BY month_date ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get incident trends.', error: error.message });
  }
};

const getGuardPerformance = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        p.id, p.name, p.guard_code,
        COUNT(DISTINCT s.id)                                    AS total_shifts,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) AS completed_shifts,
        COUNT(DISTINCT i.id)                                    AS incidents_reported,
        ROUND(
          COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END)::numeric /
          NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1
        )                                                       AS attendance_rate
      FROM personnel p
      LEFT JOIN shifts    s ON s.personnel_id = p.id
      LEFT JOIN incidents i ON i.reported_by  = p.id
      WHERE p.status = 'active'
      GROUP BY p.id, p.name, p.guard_code
      ORDER BY completed_shifts DESC
      LIMIT 10
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get guard performance.', error: error.message });
  }
};

const getSiteCoverage = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id, s.name, s.status,
        COUNT(DISTINCT sh.id)                                    AS total_shifts,
        COUNT(DISTINCT CASE WHEN sh.status = 'active' THEN sh.id END) AS active_shifts,
        COUNT(DISTINCT i.id)                                     AS incident_count,
        COUNT(DISTINCT c.id)                                     AS camera_count
      FROM sites s
      LEFT JOIN shifts    sh ON sh.site_id = s.id
      LEFT JOIN incidents i  ON i.site_id  = s.id
      LEFT JOIN cameras   c  ON c.site_id  = s.id
      GROUP BY s.id, s.name, s.status
      ORDER BY total_shifts DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get site coverage.', error: error.message });
  }
};

// Keep route contract — generateReport now calls getReports summary
const generateReport = async (req, res) => {
  return getReports(req, res);
};

const getReportById = async (req, res) => {
  res.status(404).json({ success: false, message: 'Individual report storage not implemented.' });
};

const deleteReport = async (req, res) => {
  res.json({ success: true, message: 'Report cleared.' });
};

const exportReport = async (req, res) => {
  res.json({ success: true, message: 'Export feature coming soon.', data: { downloadUrl: null } });
};

module.exports = {
  getReports, getReportById, generateReport, deleteReport, exportReport,
  getIncidentTrends, getGuardPerformance, getSiteCoverage,
};