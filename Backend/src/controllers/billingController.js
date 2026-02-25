const { query } = require('../config/database');

function mapInvoice(i) {
  return {
    id:            i.id,
    invoiceCode:   i.invoice_code || i.id,
    clientId:      i.client_id,
    clientName:    i.client_name || '—',
    amount:        parseFloat(i.amount) || 0,
    amountPaid:    i.status === 'paid' ? parseFloat(i.amount) || 0 : 0,
    balance:       i.status === 'paid' ? 0 : parseFloat(i.amount) || 0,
    dueDate:       i.due_date || null,
    issueDate:     i.created_at || null,
    status:        i.status,
    period:        i.billing_period || null,
    periodStart:   i.period_start || null,
    periodEnd:     i.period_end || null,
    paymentDate:   i.payment_date || null,
    paymentMethod: i.payment_method || null,
    notes:         i.notes || null,
    createdAt:     i.created_at,
  };
}

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, clientId, search } = req.query;
    const offset = (page - 1) * limit;

    let where = []; let params = []; let idx = 1;
    if (status && status !== 'all') { where.push(`i.status = $${idx++}`); params.push(status); }
    if (clientId) { where.push(`i.client_id = $${idx++}`); params.push(clientId); }
    if (search) {
      where.push(`(i.invoice_code ILIKE $${idx} OR c.name ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT i.*, c.name AS client_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM invoices i LEFT JOIN clients c ON i.client_id = c.id ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        invoices: result.rows.map(mapInvoice),
        pagination: {
          page: parseInt(page), limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, message: 'Error fetching invoices.', error: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, c.name AS client_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Invoice not found.' });

    // Also fetch line items
    const itemsResult = await query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: { ...mapInvoice(result.rows[0]), items: itemsResult.rows },
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ success: false, message: 'Error fetching invoice.', error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                                     AS total,
        COUNT(CASE WHEN status = 'paid'    THEN 1 END)              AS paid,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)              AS pending,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END)              AS overdue,
        COUNT(CASE WHEN status = 'draft'   THEN 1 END)              AS draft,
        COALESCE(SUM(amount), 0)                                     AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'paid'    THEN amount END), 0) AS collected,
        COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount END), 0) AS outstanding
      FROM invoices
    `);
    const r = result.rows[0];
    res.json({
      success: true,
      data: {
        total:        parseInt(r.total),
        paid:         parseInt(r.paid),
        pending:      parseInt(r.pending),
        overdue:      parseInt(r.overdue),
        draft:        parseInt(r.draft),
        totalRevenue: parseFloat(r.total_revenue),
        collected:    parseFloat(r.collected),
        outstanding:  parseFloat(r.outstanding),
      },
    });
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching billing stats.', error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const {
      clientId, billingPeriod, totalAmount, dueDate, issueDate,
      status = 'draft', notes, items = [],
    } = req.body;

    if (!clientId || !totalAmount)
      return res.status(400).json({ success: false, message: 'Client and amount are required.' });

    const invoiceCode = `INV${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO invoices
        (invoice_code, client_id, billing_period, amount, due_date, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [invoiceCode, clientId, billingPeriod || null, totalAmount,
      dueDate || null, status, notes || null]
    );

    const invoice = result.rows[0];

    // Insert line items if provided
    if (items.length > 0) {
      for (const item of items) {
        await query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
           VALUES ($1,$2,$3,$4,$5)`,
          [invoice.id, item.description, item.quantity || 1,
           item.unitPrice || item.amount, item.amount]
        );
      }
    }

    res.status(201).json({ success: true, message: 'Invoice created.', data: mapInvoice(invoice) });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ success: false, message: 'Error creating invoice.', error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { status, dueDate, billingPeriod, totalAmount, paymentDate, paymentMethod, notes } = req.body;

    const result = await query(
      `UPDATE invoices SET
        status         = COALESCE($1, status),
        due_date       = COALESCE($2, due_date),
        billing_period = COALESCE($3, billing_period),
        amount         = COALESCE($4, amount),
        payment_date   = COALESCE($5, payment_date),
        payment_method = COALESCE($6, payment_method),
        notes          = COALESCE($7, notes)
       WHERE id = $8 RETURNING *`,
      [status, dueDate, billingPeriod, totalAmount, paymentDate, paymentMethod, notes, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, message: 'Invoice updated.', data: mapInvoice(result.rows[0]) });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ success: false, message: 'Error updating invoice.', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    // Delete line items first (FK constraint)
    await query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
    const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, message: 'Invoice deleted.' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ success: false, message: 'Error deleting invoice.', error: error.message });
  }
};

module.exports = { getAll, getById, getStats, create, update, deleteItem };