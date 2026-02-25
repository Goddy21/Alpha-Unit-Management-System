const { query } = require('../config/database');

function mapItem(i) {
  return {
    id:              i.id,
    itemCode:        i.item_code,
    name:            i.name,
    category:        i.category,
    serialNumber:    i.serial_number || null,
    quantity:        i.quantity ?? 1,
    status:          i.status,
    condition:       i.condition,
    assignedTo:      i.assigned_to_name || null,
    assignedToId:    i.assigned_to || null,
    location:        i.location || '—',
    purchaseDate:    i.purchase_date || null,
    purchasePrice:   parseFloat(i.purchase_price) || 0,
    currentValue:    parseFloat(i.current_value) || 0,
    lastMaintenance: i.last_maintenance || null,
    nextMaintenance: i.next_maintenance || null,
    warrantyExpiry:  i.warranty_expiry || null,
    supplier:        i.supplier || '—',
    notes:           i.notes || null,
    createdAt:       i.created_at,
  };
}

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category, search } = req.query;
    const offset = (page - 1) * limit;

    let where = []; let params = []; let idx = 1;
    if (status && status !== 'all')   { where.push(`i.status = $${idx++}`);   params.push(status); }
    if (category && category !== 'all') { where.push(`i.category = $${idx++}`); params.push(category); }
    if (search) {
      where.push(`(i.name ILIKE $${idx} OR i.item_code ILIKE $${idx} OR i.serial_number ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         i.*,
         p.name AS assigned_to_name
       FROM inventory i
       LEFT JOIN personnel p ON i.assigned_to = p.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM inventory i ${whereClause}`, params
    );

    res.json({
      success: true,
      data: {
        inventory: result.rows.map(mapItem),
        pagination: {
          page: parseInt(page), limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, message: 'Error fetching inventory.', error: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, p.name AS assigned_to_name
       FROM inventory i
       LEFT JOIN personnel p ON i.assigned_to = p.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, data: mapItem(result.rows[0]) });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ success: false, message: 'Error fetching item.', error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                                     AS total_records,
        COALESCE(SUM(quantity), 0)                                   AS total_items,
        COUNT(CASE WHEN status = 'available'   THEN 1 END)           AS available,
        COUNT(CASE WHEN status = 'assigned'    THEN 1 END)           AS assigned,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END)           AS maintenance,
        COUNT(CASE WHEN status = 'retired'     THEN 1 END)           AS retired,
        COALESCE(SUM(current_value * COALESCE(quantity, 1)), 0)      AS total_value,
        COALESCE(SUM((purchase_price - current_value) * COALESCE(quantity, 1)), 0) AS total_depreciation
      FROM inventory
    `);

    const catResult = await query(`
      SELECT category, COALESCE(SUM(quantity), COUNT(*)) AS count
      FROM inventory
      GROUP BY category
    `);

    const r = result.rows[0];
    const byCategory = {};
    catResult.rows.forEach(c => { byCategory[c.category] = parseInt(c.count); });

    res.json({
      success: true,
      data: {
        totalItems:       parseInt(r.total_items),
        totalRecords:     parseInt(r.total_records),
        available:        parseInt(r.available),
        assigned:         parseInt(r.assigned),
        maintenance:      parseInt(r.maintenance),
        retired:          parseInt(r.retired),
        totalValue:       parseFloat(r.total_value),
        totalDepreciation: parseFloat(r.total_depreciation),
        byCategory,
      },
    });
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats.', error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const {
      name, category, serialNumber, quantity = 1, status = 'available',
      condition = 'new', assignedToId, location, purchaseDate, purchasePrice,
      currentValue, lastMaintenance, nextMaintenance, warrantyExpiry, supplier, notes,
    } = req.body;

    if (!name || !category)
      return res.status(400).json({ success: false, message: 'Name and category are required.' });

    const itemCode = `INV${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const cv = currentValue ?? purchasePrice ?? 0;

    const result = await query(
      `INSERT INTO inventory
         (item_code, name, category, serial_number, quantity, status, condition,
          assigned_to, location, purchase_date, purchase_price, current_value,
          last_maintenance, next_maintenance, warranty_expiry, supplier, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [itemCode, name, category, serialNumber || null, quantity, status, condition,
       assignedToId || null, location || null, purchaseDate || null,
       purchasePrice || 0, cv, lastMaintenance || null, nextMaintenance || null,
       warrantyExpiry || null, supplier || null, notes || null]
    );
    res.status(201).json({ success: true, message: 'Item added.', data: mapItem(result.rows[0]) });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ success: false, message: 'Error creating item.', error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const {
      name, category, serialNumber, quantity, status, condition,
      assignedToId, location, purchaseDate, purchasePrice, currentValue,
      lastMaintenance, nextMaintenance, warrantyExpiry, supplier, notes,
    } = req.body;

    const result = await query(
      `UPDATE inventory SET
        name             = COALESCE($1,  name),
        category         = COALESCE($2,  category),
        serial_number    = COALESCE($3,  serial_number),
        quantity         = COALESCE($4,  quantity),
        status           = COALESCE($5,  status),
        condition        = COALESCE($6,  condition),
        assigned_to   = COALESCE($7,  assigned_to),
        location         = COALESCE($8,  location),
        purchase_date    = COALESCE($9,  purchase_date),
        purchase_price   = COALESCE($10, purchase_price),
        current_value    = COALESCE($11, current_value),
        last_maintenance = COALESCE($12, last_maintenance),
        next_maintenance = COALESCE($13, next_maintenance),
        warranty_expiry  = COALESCE($14, warranty_expiry),
        supplier         = COALESCE($15, supplier),
        notes            = COALESCE($16, notes)
       WHERE id = $17 RETURNING *`,
      [name, category, serialNumber, quantity, status, condition,
       assignedToId, location, purchaseDate, purchasePrice, currentValue,
       lastMaintenance, nextMaintenance, warrantyExpiry, supplier, notes, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, message: 'Item updated.', data: mapItem(result.rows[0]) });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ success: false, message: 'Error updating item.', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const result = await query('DELETE FROM inventory WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, message: 'Item deleted.' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ success: false, message: 'Error deleting item.', error: error.message });
  }
};

module.exports = { getAll, getById, getStats, create, update, deleteItem };