const express = require('express');
const { getDB, getAll, getOne, runQuery, generateTicketNo } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/tickets — list all (with filters)
router.get('/', authMiddleware, (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = [];
  let params = [];

  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push(`(title LIKE ? OR location LIKE ? OR reporter_name LIKE ? OR asset_id LIKE ? OR ticket_no LIKE ? OR category LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = getOne(`SELECT COUNT(*) as c FROM tickets ${whereClause}`, params);
  const tickets = getAll(
    `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  res.json({ status: 'success', tickets, total: total.c, page: Number(page), limit: Number(limit) });
});

// GET /api/tickets/:id
router.get('/:id', authMiddleware, (req, res) => {
  const ticket = getOne('SELECT * FROM tickets WHERE id = ?', [Number(req.params.id)]);
  if (!ticket) return res.status(404).json({ status: 'error', message: 'ไม่พบงาน' });
  res.json({ status: 'success', ticket });
});

// POST /api/tickets — create new
router.post('/', authMiddleware, (req, res) => {
  const {
    category, category_detail, priority, location, location_detail,
    asset_id, title, photo_url, reporter_name
  } = req.body;

  if (!category || !location || !title) {
    return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  const ticket_no = generateTicketNo();
  const final_category = category_detail ? `${category} — ${category_detail}` : category;
  const final_location = location_detail ? `${location} — ${location_detail}` : location;
  const rep_name = reporter_name?.trim() || req.user.name;

  const insertParams = [ticket_no, req.user.id, rep_name, final_category, category_detail || null,
    priority || 'ปกติ', final_location, location_detail || null,
    asset_id || null, title, photo_url || null];

  let result;
  try {
    result = runQuery(`
      INSERT INTO tickets (ticket_no, reporter_id, reporter_name, category, category_detail,
        priority, location, location_detail, asset_id, title, photo_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')
    `, insertParams);
  } catch (err) {
    console.error('[tickets.js] INSERT failed:', err.message);
    console.error('[tickets.js] params types:', insertParams.map(p => p === null ? 'null' : typeof p));
    return res.status(500).json({ status: 'error', message: err.message });
  }

  const ticketId = result.lastInsertRowid;

  // SLA log
  runQuery('INSERT INTO sla_log (ticket_id, to_status, changed_by) VALUES (?, ?, ?)',
    [ticketId, 'รอดำเนินการ', req.user.id]);

  const ticket = getOne('SELECT * FROM tickets WHERE id = ?', [ticketId]);

  // Emit socket event
  const io = req.app.get('io');
  if (io) io.emit('ticket:created', ticket);

  require('../services/notification').notifyNewTicket(ticket).catch(() => {});

  res.json({ status: 'success', ticket, message: 'บันทึกสำเร็จ' });
});

// PUT /api/tickets/:id — update
router.put('/:id', authMiddleware, (req, res) => {
  const ticket = getOne('SELECT * FROM tickets WHERE id = ?', [Number(req.params.id)]);
  if (!ticket) return res.status(404).json({ status: 'error', message: 'ไม่พบงาน' });

  const { status, technician, cost, notes, category, priority, location, asset_id, title } = req.body;

  let updates = [];
  let params = [];

  const statusChanged = status && status !== ticket.status;
  if (statusChanged) {
    updates.push('status = ?');
    params.push(status);
    runQuery('INSERT INTO sla_log (ticket_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)',
      [ticket.id, ticket.status, status, req.user.id]);
  }
  if (technician !== undefined) { updates.push('technician = ?'); params.push(technician || '-'); }
  if (cost !== undefined) { updates.push('cost = ?'); params.push(Number(cost) || 0); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (location !== undefined) { updates.push('location = ?'); params.push(location); }
  if (asset_id !== undefined) { updates.push('asset_id = ?'); params.push(asset_id); }
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }

  updates.push("updated_at = datetime('now','localtime')");

  if (updates.length > 1) {
    params.push(Number(req.params.id));
    runQuery(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const updated = getOne('SELECT * FROM tickets WHERE id = ?', [Number(req.params.id)]);
  const io = req.app.get('io');
  if (io) io.emit('ticket:updated', updated);

  if (statusChanged) require('../services/notification').notifyStatusUpdate(updated, ticket.status);

  res.json({ status: 'success', ticket: updated, message: 'อัปเดตสำเร็จ' });
});

// DELETE /api/tickets/:id (admin only)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const ticket = getOne('SELECT * FROM tickets WHERE id = ?', [Number(req.params.id)]);
  if (!ticket) return res.status(404).json({ status: 'error', message: 'ไม่พบงาน' });

  runQuery('DELETE FROM sla_log WHERE ticket_id = ?', [Number(req.params.id)]);
  runQuery('DELETE FROM tickets WHERE id = ?', [Number(req.params.id)]);

  const io = req.app.get('io');
  if (io) io.emit('ticket:deleted', { id: Number(req.params.id) });

  res.json({ status: 'success', message: 'ลบงานสำเร็จ' });
});

// GET /api/tickets/sla/:id — SLA history
router.get('/sla/:id', authMiddleware, (req, res) => {
  const logs = getAll(`
    SELECT s.*, u.name as changed_by_name
    FROM sla_log s LEFT JOIN users u ON s.changed_by = u.id
    WHERE s.ticket_id = ? ORDER BY s.changed_at ASC
  `, [Number(req.params.id)]);
  res.json({ status: 'success', logs });
});

module.exports = router;
