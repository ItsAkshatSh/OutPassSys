const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('tickets.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name TEXT,
        grade TEXT,
        reason TEXT,
        time TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME
    )`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/api/tickets', (req, res) => {
    const { studentName, grade, reason, time } = req.body;

    db.run(
        'INSERT INTO tickets (student_name, grade, reason, time) VALUES (?, ?, ?, ?)',
        [studentName, grade, reason, time],
        function(err) {
            if (err) {
                console.error('Error creating ticket:', err);
                return res.status(500).json({ error: 'Error creating ticket' });
            }
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.get('/api/tickets/active', (req, res) => {
    const query = `
        SELECT 
            id,
            student_name as studentName,
            grade,
            reason,
            time,
            created_at,
            status
        FROM tickets
        WHERE status = 'active'
        ORDER BY created_at DESC
    `;

    db.all(query, (err, tickets) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching tickets' });
        }
        res.json(tickets);
    });
});

app.get('/api/tickets/history', (req, res) => {
    const { search, startDate, endDate } = req.query;
    let query = `
        SELECT 
            id,
            student_name as studentName,
            grade,
            reason,
            time,
            created_at,
            closed_at,
            status
        FROM tickets
        WHERE status = 'closed'
    `;
    const params = [];

    if (search) {
        query += ' AND student_name LIKE ?';
        params.push(`%${search}%`);
    }
    if (startDate) {
        query += ' AND closed_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND closed_at <= ?';
        params.push(endDate);
    }

    query += ' ORDER BY closed_at DESC';

    db.all(query, params, (err, tickets) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching ticket history' });
        }
        res.json(tickets);
    });
});

app.put('/api/tickets/:id/close', (req, res) => {
    const ticketId = req.params.id;

    db.run(
        'UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['closed', ticketId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error closing ticket' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            res.json({ success: true });
        }
    );
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`\nOpen http://localhost:${PORT}/dashboard.html in your browser`);
}); 