const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.resolve();
const dbPath = path.join(__dirname, 'database.sqlite');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${safeName}`);
  }
});

const upload = multer({ storage });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) throw err;
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      createdAt TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      phone TEXT,
      roomId INTEGER,
      cardNumber TEXT,
      notes TEXT,
      ktpPath TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    )`);
  });
});

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function nowIso() {
  return new Date().toISOString();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Kost management API is running' });
});

app.get('/api/rooms', async (_req, res) => {
  try {
    const rooms = await dbAll('SELECT * FROM rooms ORDER BY createdAt DESC');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, type, price, status } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    const result = await dbRun(
      'INSERT INTO rooms (name, type, price, status, createdAt) VALUES (?, ?, ?, ?, ?)',
      [name, type, Number(price) || 0, status || 'available', nowIso()]
    );
    res.status(201).json({ id: result.id, name, type, price: Number(price) || 0, status: status || 'available', createdAt: nowIso() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/rooms/:id', async (req, res) => {
  try {
    const { name, type, price, status } = req.body;
    await dbRun('UPDATE rooms SET name = ?, type = ?, price = ?, status = ? WHERE id = ?', [name, type, Number(price) || 0, status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    await dbRun('UPDATE guests SET roomId = NULL WHERE roomId = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/guests', async (_req, res) => {
  try {
    const guests = await dbAll(`
      SELECT g.*, r.name AS roomName
      FROM guests g
      LEFT JOIN rooms r ON r.id = g.roomId
      ORDER BY g.createdAt DESC
    `);
    res.json(guests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/guests', async (req, res) => {
  try {
    const { fullName, phone, roomId, cardNumber, notes, status } = req.body;
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    const result = await dbRun(
      'INSERT INTO guests (fullName, phone, roomId, cardNumber, notes, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [fullName, phone || '', roomId || null, cardNumber || '', notes || '', status || 'active', nowIso()]
    );
    res.status(201).json({ id: result.id, fullName, phone: phone || '', roomId: roomId || null, cardNumber: cardNumber || '', notes: notes || '', status: status || 'active', createdAt: nowIso() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/guests/:id', async (req, res) => {
  try {
    const { fullName, phone, roomId, cardNumber, notes, status } = req.body;
    await dbRun('UPDATE guests SET fullName = ?, phone = ?, roomId = ?, cardNumber = ?, notes = ?, status = ? WHERE id = ?', [fullName, phone || '', roomId || null, cardNumber || '', notes || '', status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM guests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/guests/:id/ktp', upload.single('ktp'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'KTP file is required' });
    }
    const relativePath = `/uploads/${req.file.filename}`;
    await dbRun('UPDATE guests SET ktpPath = ? WHERE id = ?', [relativePath, req.params.id]);
    res.json({ success: true, path: relativePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Kost management app running on http://localhost:${PORT}`);
});
