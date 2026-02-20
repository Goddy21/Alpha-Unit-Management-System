const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all clients with pagination and filters
 */
const getClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      industry,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    // Whitelist sortBy to prevent SQL injection
    const allowedSortFields = ['created_at', 'name', 'industry', 'monthly_value', 'total_guards'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // Build filter params separately from pagination params
    // so the count query can reuse them cleanly
    let whereConditions = [];
    let filterParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(c.name ILIKE $${paramIndex} OR c.contact_person ILIKE $${paramIndex})`
      );
      filterParams.push(`%${search}%`);
      paramIndex++;
    }

    if (industry) {
      whereConditions.push(`c.industry = $${paramIndex}`);
      filterParams.push(industry);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`cnt.status = $${paramIndex}`);
      filterParams.push(status);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Main query: LATERAL join guarantees at most one contract row per client
    const clientsQuery = `
      SELECT
        c.*,
        cnt.id            AS contract_id,
        cnt.status        AS contract_status,
        cnt.start_date,
        cnt.end_date,
        cnt.value         AS contract_value,
        cnt.billing_cycle,
        cnt.sla_response,
        cnt.auto_renew,
        (SELECT COUNT(*) FROM sites s WHERE s.client_id = c.id) AS site_count
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT *
        FROM contracts
        WHERE client_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cnt ON true
      ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Pagination params come AFTER filter params
    const clientsParams = [...filterParams, parseInt(limit), parseInt(offset)];
    const clientsResult = await query(clientsQuery, clientsParams);

    // Count query uses only filter params (no pagination params)
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) AS total
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT status
        FROM contracts
        WHERE client_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cnt ON true
      ${whereClause}
    `;
    // filterParams may be empty [] when no filters — that's fine, pg handles it correctly
    const countResult = await query(countQuery, filterParams);
    const total = parseInt(countResult.rows[0].total);

    res.status(200).json({
      success: true,
      data: {
        clients: clientsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clients.',
      error: error.message,
    });
  }
};

/**
 * Get client by ID with full details
 */
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const clientResult = await query('SELECT * FROM clients WHERE id = $1', [id]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.',
      });
    }

    const client = clientResult.rows[0];

    const sitesResult = await query(
      'SELECT * FROM sites WHERE client_id = $1 ORDER BY name',
      [id]
    );

    const contractResult = await query(
      'SELECT * FROM contracts WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    const invoicesResult = await query(
      'SELECT * FROM invoices WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5',
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...client,
        sites: sitesResult.rows,
        contract: contractResult.rows[0] || null,
        recent_invoices: invoicesResult.rows,
      },
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client.',
      error: error.message,
    });
  }
};

/**
 * Create new client with sites and contract
 */
const createClient = async (req, res) => {
  try {
    const {
      name,
      industry,
      contactPerson,
      email,
      phone,
      address,
      sites,
      contract,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required.',
      });
    }

    const clientCode = `CLI${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    const result = await transaction(async (client) => {
      const clientResult = await client.query(
        `INSERT INTO clients (client_code, name, industry, contact_person, email, phone, address, total_guards, monthly_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          clientCode,
          name,
          industry || null,
          contactPerson || null,
          email,
          phone || null,
          address || null,
          0,
          0,
        ]
      );

      const newClient = clientResult.rows[0];

      let createdSites = [];
      if (sites && Array.isArray(sites) && sites.length > 0) {
        for (const site of sites) {
          const siteCode = `SITE${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
          const siteResult = await client.query(
            `INSERT INTO sites (site_code, client_id, name, address, guards_required)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [siteCode, newClient.id, site.name, site.address || null, site.guardsRequired || 0]
          );
          createdSites.push(siteResult.rows[0]);
        }
      }

      let createdContract = null;
      if (contract) {
        const contractCode = `CNT${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        const contractResult = await client.query(
          `INSERT INTO contracts (contract_code, client_id, start_date, end_date, value, status, billing_cycle, sla_response, auto_renew)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            contractCode,
            newClient.id,
            contract.startDate,
            contract.endDate,
            contract.value,
            contract.status || 'pending',
            contract.billingCycle || 'monthly',
            contract.slaResponse || null,
            contract.autoRenew || false,
          ]
        );
        createdContract = contractResult.rows[0];
      }

      return { client: newClient, sites: createdSites, contract: createdContract };
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully.',
      data: result,
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating client.',
      error: error.message,
    });
  }
};

/**
 * Update client
 */
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, industry, contactPerson, email, phone, address, totalGuards, monthlyValue } =
      req.body;

    const result = await query(
      `UPDATE clients SET
        name          = COALESCE($1, name),
        industry      = COALESCE($2, industry),
        contact_person = COALESCE($3, contact_person),
        email         = COALESCE($4, email),
        phone         = COALESCE($5, phone),
        address       = COALESCE($6, address),
        total_guards  = COALESCE($7, total_guards),
        monthly_value = COALESCE($8, monthly_value)
       WHERE id = $9
       RETURNING *`,
      [name, industry, contactPerson, email, phone, address, totalGuards, monthlyValue, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Client updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client.',
      error: error.message,
    });
  }
};

/**
 * Delete client
 */
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    res.status(200).json({ success: true, message: 'Client deleted successfully.' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting client.',
      error: error.message,
    });
  }
};

/**
 * Get client statistics
 */
const getClientStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(DISTINCT c.id)                                     AS total_clients,
        COUNT(DISTINCT CASE WHEN cnt.status = 'active' THEN c.id END) AS active_contracts,
        SUM(c.monthly_value)                                     AS total_monthly_revenue,
        SUM(c.total_guards)                                      AS total_guards_deployed
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT status
        FROM contracts
        WHERE client_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cnt ON true
    `;

    const result = await query(statsQuery);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client statistics.',
      error: error.message,
    });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
};