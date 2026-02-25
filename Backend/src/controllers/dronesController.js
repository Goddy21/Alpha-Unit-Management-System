const { query } = require('../config/database');

// ── helpers ──────────────────────────────────────────────────────────────────
function mapDrone(d) {
  return {
    id:              d.id,
    droneCode:       d.drone_code,
    name:            d.name,
    model:           d.model,
    serialNumber:    d.serial_number,
    status:          d.status,
    batteryLevel:    d.battery_level ?? 0,
    flightHours:     parseFloat(d.flight_hours) || 0,
    lastMaintenance: d.last_maintenance || null,
    nextMaintenance: d.next_maintenance || null,
    features:        d.features || [],
    notes:           d.notes || null,
    createdAt:       d.created_at,
  };
}

function mapFlight(f) {
  return {
    id:             f.id,
    flightCode:     f.flight_code,
    missionName:    f.mission_name,
    droneId:        f.drone_id,
    droneName:      f.drone_name || '—',
    droneModel:     f.drone_model || '—',
    pilotId:        f.pilot_id,
    pilotName:      f.pilot_name || '—',
    siteId:         f.site_id,
    siteName:       f.site_name || '—',
    flightDate:     f.flight_date,
    takeoffTime:    f.takeoff_time,
    landingTime:    f.landing_time || null,
    duration:       f.duration || null,
    status:         f.status,
    purpose:        f.purpose,
    altitude:       f.altitude || null,
    distance:       f.distance || null,
    batteryUsed:    f.battery_used ?? 0,
    videoFootage:   f.video_footage ?? false,
    photoCount:     f.photo_count ?? 0,
    incidentLinked: f.incident_linked || null,
    weather:        f.weather || null,
    notes:          f.notes || null,
    createdAt:      f.created_at,
  };
}

// ── Drone CRUD ────────────────────────────────────────────────────────────────

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * limit;

    let where = []; let params = []; let idx = 1;
    if (status && status !== 'all') { where.push(`status = $${idx++}`); params.push(status); }
    if (search) {
      where.push(`(name ILIKE $${idx} OR model ILIKE $${idx} OR drone_code ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM drones ${whereClause} ORDER BY name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const countResult = await query(`SELECT COUNT(*) AS total FROM drones ${whereClause}`, params);

    res.json({
      success: true,
      data: {
        drones: result.rows.map(mapDrone),
        pagination: {
          page: parseInt(page), limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get drones error:', error);
    res.status(500).json({ success: false, message: 'Error fetching drones.', error: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await query('SELECT * FROM drones WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Drone not found.' });
    res.json({ success: true, data: mapDrone(result.rows[0]) });
  } catch (error) {
    console.error('Get drone error:', error);
    res.status(500).json({ success: false, message: 'Error fetching drone.', error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const droneStats = await query(`
      SELECT
        COUNT(*)                                                AS total_drones,
        COUNT(CASE WHEN status = 'available'   THEN 1 END)    AS available,
        COUNT(CASE WHEN status = 'in-flight'   THEN 1 END)    AS in_flight,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END)    AS maintenance,
        COUNT(CASE WHEN status = 'charging'    THEN 1 END)    AS charging
      FROM drones
    `);

    const flightStats = await query(`
      SELECT
        COUNT(*)                                                AS total_flights,
        COUNT(CASE WHEN status = 'in-flight'  THEN 1 END)     AS active_flights,
        COUNT(CASE WHEN status = 'completed'  THEN 1 END)     AS completed,
        COUNT(CASE WHEN status = 'aborted'    THEN 1 END)     AS aborted,
        COALESCE(SUM(battery_used), 0)                        AS total_battery_used
      FROM flight_logs
    `);

    const d = droneStats.rows[0];
    const f = flightStats.rows[0];

    res.json({
      success: true,
      data: {
        drones: {
          total:       parseInt(d.total_drones),
          available:   parseInt(d.available),
          inFlight:    parseInt(d.in_flight),
          maintenance: parseInt(d.maintenance),
          charging:    parseInt(d.charging),
        },
        flights: {
          total:     parseInt(f.total_flights),
          active:    parseInt(f.active_flights),
          completed: parseInt(f.completed),
          aborted:   parseInt(f.aborted),
        },
      },
    });
  } catch (error) {
    console.error('Get drone stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching drone stats.', error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, model, serialNumber, status = 'available', batteryLevel = 100,
            features = [], lastMaintenance, nextMaintenance, notes } = req.body;

    if (!name || !model)
      return res.status(400).json({ success: false, message: 'Name and model are required.' });

    const droneCode = `DRN${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO drones
         (drone_code, name, model, serial_number, status, battery_level, features,
          last_maintenance, next_maintenance, notes, flight_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0) RETURNING *`,
      [droneCode, name, model, serialNumber || null, status, batteryLevel,
       JSON.stringify(features), lastMaintenance || null, nextMaintenance || null, notes || null]
    );
    res.status(201).json({ success: true, message: 'Drone added successfully.', data: mapDrone(result.rows[0]) });
  } catch (error) {
    console.error('Create drone error:', error);
    res.status(500).json({ success: false, message: 'Error creating drone.', error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, model, serialNumber, status, batteryLevel, features,
            lastMaintenance, nextMaintenance, notes } = req.body;

    const result = await query(
      `UPDATE drones SET
        name             = COALESCE($1,  name),
        model            = COALESCE($2,  model),
        serial_number    = COALESCE($3,  serial_number),
        status           = COALESCE($4,  status),
        battery_level    = COALESCE($5,  battery_level),
        features         = COALESCE($6,  features),
        last_maintenance = COALESCE($7,  last_maintenance),
        next_maintenance = COALESCE($8,  next_maintenance),
        notes            = COALESCE($9,  notes)
       WHERE id = $10 RETURNING *`,
      [name, model, serialNumber, status, batteryLevel,
       features ? JSON.stringify(features) : null,
       lastMaintenance, nextMaintenance, notes, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Drone not found.' });
    res.json({ success: true, message: 'Drone updated.', data: mapDrone(result.rows[0]) });
  } catch (error) {
    console.error('Update drone error:', error);
    res.status(500).json({ success: false, message: 'Error updating drone.', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const result = await query('DELETE FROM drones WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Drone not found.' });
    res.json({ success: true, message: 'Drone deleted.' });
  } catch (error) {
    console.error('Delete drone error:', error);
    res.status(500).json({ success: false, message: 'Error deleting drone.', error: error.message });
  }
};

// ── Flight Log CRUD ───────────────────────────────────────────────────────────

const getFlights = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, droneId, siteId, date, search } = req.query;
    const offset = (page - 1) * limit;

    let where = []; let params = []; let idx = 1;
    if (status && status !== 'all') { where.push(`f.status = $${idx++}`); params.push(status); }
    if (droneId) { where.push(`f.drone_id = $${idx++}`); params.push(droneId); }
    if (siteId)  { where.push(`f.site_id = $${idx++}`);  params.push(siteId); }
    if (date)    { where.push(`f.flight_date = $${idx++}`); params.push(date); }
    if (search)  {
      where.push(`(f.mission_name ILIKE $${idx} OR f.flight_code ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         f.*,
         d.name  AS drone_name, d.model AS drone_model,
         p.name  AS pilot_name,
         s.name  AS site_name
       FROM flight_logs f
       LEFT JOIN drones    d ON f.drone_id = d.id
       LEFT JOIN personnel p ON f.pilot_id = p.id
       LEFT JOIN sites     s ON f.site_id  = s.id
       ${whereClause}
       ORDER BY f.flight_date DESC, f.takeoff_time DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM flight_logs f ${whereClause}`, params
    );

    res.json({
      success: true,
      data: {
        flights: result.rows.map(mapFlight),
        pagination: {
          page: parseInt(page), limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get flights error:', error);
    res.status(500).json({ success: false, message: 'Error fetching flights.', error: error.message });
  }
};

const createFlight = async (req, res) => {
  try {
    const { missionName, droneId, pilotId, siteId, flightDate, takeoffTime,
            purpose, altitude, weather, incidentLinked, notes } = req.body;

    if (!missionName || !droneId || !flightDate || !takeoffTime || !purpose)
      return res.status(400).json({ success: false, message: 'Mission name, drone, date, time, and purpose are required.' });

    const flightCode = `FLT${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO flight_logs
         (flight_code, mission_name, drone_id, pilot_id, site_id, flight_date,
          takeoff_time, status, purpose, altitude, weather, incident_linked, notes,
          battery_used, video_footage, photo_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$10,$11,$12,0,false,0) RETURNING *`,
      [flightCode, missionName, droneId, pilotId || null, siteId || null,
       flightDate, takeoffTime, purpose, altitude || null,
       weather || null, incidentLinked || null, notes || null]
    );

    // Mark drone as in upcoming mission (optional status update)
    res.status(201).json({ success: true, message: 'Mission scheduled.', data: result.rows[0] });
  } catch (error) {
    console.error('Create flight error:', error);
    res.status(500).json({ success: false, message: 'Error scheduling mission.', error: error.message });
  }
};

const updateFlight = async (req, res) => {
  try {
    const { status, landingTime, duration, batteryUsed, videoFootage,
            photoCount, altitude, distance, weather, notes } = req.body;

    const result = await query(
      `UPDATE flight_logs SET
        status        = COALESCE($1,  status),
        landing_time  = COALESCE($2,  landing_time),
        duration      = COALESCE($3,  duration),
        battery_used  = COALESCE($4,  battery_used),
        video_footage = COALESCE($5,  video_footage),
        photo_count   = COALESCE($6,  photo_count),
        altitude      = COALESCE($7,  altitude),
        distance      = COALESCE($8,  distance),
        weather       = COALESCE($9,  weather),
        notes         = COALESCE($10, notes)
       WHERE id = $11 RETURNING *`,
      [status, landingTime, duration, batteryUsed, videoFootage,
       photoCount, altitude, distance, weather, notes, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Flight not found.' });

    // If completed/aborted, bump drone's flight_hours
    if ((status === 'completed' || status === 'aborted') && duration) {
      const mins = parseInt(duration);
      if (!isNaN(mins)) {
        const sh = result.rows[0];
        await query(
          `UPDATE drones SET flight_hours = flight_hours + $1 WHERE id = $2`,
          [parseFloat((mins / 60).toFixed(2)), sh.drone_id]
        );
      }
    }

    res.json({ success: true, message: 'Flight updated.', data: result.rows[0] });
  } catch (error) {
    console.error('Update flight error:', error);
    res.status(500).json({ success: false, message: 'Error updating flight.', error: error.message });
  }
};

const deleteFlight = async (req, res) => {
  try {
    const result = await query('DELETE FROM flight_logs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Flight not found.' });
    res.json({ success: true, message: 'Flight deleted.' });
  } catch (error) {
    console.error('Delete flight error:', error);
    res.status(500).json({ success: false, message: 'Error deleting flight.', error: error.message });
  }
};

module.exports = { getAll, getById, getStats, create, update, deleteItem,
                   getFlights, createFlight, updateFlight, deleteFlight };