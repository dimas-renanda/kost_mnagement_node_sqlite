const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 4000;
const rootDir = process.cwd();
const dbPath = path.join(rootDir, 'database.sqlite');
const uploadsDir = path.join(rootDir, 'public', 'uploads');
const adminPassword = 's2a2026';
const adminTokens = new Map();
const allModules = ['overview', 'rooms', 'guests', 'stats', 'guestStats', 'cardManagement', 'access'];

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/node_modules', express.static(path.join(rootDir, 'node_modules')));
app.use(express.static(path.join(rootDir, 'public')));

function createAdminToken() {
  return `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeModules(modules) {
  if (!Array.isArray(modules)) {
    if (typeof modules === 'string') {
      try {
        const parsed = JSON.parse(modules);
        return normalizeModules(parsed);
      } catch (_error) {
        return modules.split(',').map((item) => item.trim()).filter(Boolean);
      }
    }
    return [];
  }

  return Array.from(new Set(modules.filter((module) => allModules.includes(module))));
}

function serializeModules(modules) {
  return JSON.stringify(normalizeModules(modules));
}

function parseModulesValue(modules) {
  return normalizeModules(modules);
}

function getRequiredModule(pathname) {
  if (pathname.startsWith('/api/rooms')) return 'rooms';
  if (pathname.startsWith('/api/guests')) return ['guests', 'cardManagement'];
  if (pathname.startsWith('/api/stats')) return 'stats';
  if (pathname.startsWith('/api/guest-stats')) return 'guestStats';
  if (pathname.startsWith('/api/roles') || pathname.startsWith('/api/users')) return 'access';
  return null;
}

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
});

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
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

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function columnExists(table, column) {
  const columns = await dbAll(`PRAGMA table_info(${table})`);
  return columns.some((item) => item.name === column);
}

function nowIso() {
  return new Date().toISOString();
}

async function initializeDatabase() {
  await dbRun(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available',
    createdAt TEXT NOT NULL
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    phone TEXT,
    roomId INTEGER,
    cardNumber TEXT,
    notes TEXT,
    ktpPath TEXT,
    checkinAt TEXT,
    checkoutAt TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(roomId) REFERENCES rooms(id)
  )`);

  if (!(await columnExists('guests', 'checkinAt'))) {
    await dbRun('ALTER TABLE guests ADD COLUMN checkinAt TEXT');
  }
  if (!(await columnExists('guests', 'checkoutAt'))) {
    await dbRun('ALTER TABLE guests ADD COLUMN checkoutAt TEXT');
  }

  await dbRun(`CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modules TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    roleId INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(roleId) REFERENCES roles(id)
  )`);

  const adminRole = await dbGet('SELECT * FROM roles WHERE name = ?', ['admin']);
  if (!adminRole) {
    const roleResult = await dbRun('INSERT INTO roles (name, modules, createdAt) VALUES (?, ?, ?)', ['admin', serializeModules(allModules), nowIso()]);
    const adminUser = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
      await dbRun('INSERT INTO users (username, password, roleId, status, createdAt) VALUES (?, ?, ?, ?, ?)', ['admin', adminPassword, roleResult.id, 'active', nowIso()]);
    }
  } else {
    const adminUser = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
      await dbRun('INSERT INTO users (username, password, roleId, status, createdAt) VALUES (?, ?, ?, ?, ?)', ['admin', adminPassword, adminRole.id, 'active', nowIso()]);
    }
  }
}

initializeDatabase().catch((error) => {
  console.error('Database initialization error', error);
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/login' || req.path === '/logout' || req.path === '/me') {
    return next();
  }

  const token = req.header('x-admin-token');
  const session = token ? adminTokens.get(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Admin access required' });
  }

  const moduleName = getRequiredModule(req.path);
  if (moduleName) {
    const allowed = Array.isArray(moduleName)
      ? moduleName.some((name) => session.user.modules.includes(name))
      : session.user.modules.includes(moduleName);
    if (!allowed) {
      return res.status(403).json({ error: 'Module access denied' });
    }
  }

  return next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Kost management API is running' });
});

app.get('/api/me', (req, res) => {
  const token = req.header('x-admin-token');
  const session = token ? adminTokens.get(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: session.user });
});

app.get('/api/stats', async (_req, res) => {
  try {
    const rooms = await dbAll('SELECT * FROM rooms ORDER BY createdAt DESC');
    const guests = await dbAll('SELECT * FROM guests');
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter((room) => room.status === 'available').length;
    const occupiedRooms = rooms.filter((room) => room.status === 'occupied').length;
    const activeGuests = guests.filter((guest) => guest.status === 'active').length;
    const monthlyIncome = rooms
      .filter((room) => room.status === 'occupied')
      .reduce((sum, room) => sum + Number(room.price || 0), 0);
    const potentialMonthlyIncome = rooms.reduce((sum, room) => sum + Number(room.price || 0), 0);

    res.json({
      totalRooms,
      availableRooms,
      occupiedRooms,
      activeGuests,
      monthlyIncome,
      potentialMonthlyIncome,
      occupiedRoomsList: rooms.filter((room) => room.status === 'occupied')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/guest-stats', async (_req, res) => {
  try {
    const guests = await dbAll(`
      SELECT g.*, r.name AS roomName
      FROM guests g
      LEFT JOIN rooms r ON r.id = g.roomId
      ORDER BY g.createdAt DESC
    `);

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? null : date;
    };

    const enriched = guests.map((guest) => {
      const checkin = parseDate(guest.checkinAt);
      const checkout = parseDate(guest.checkoutAt);
      const stayDays = checkin && checkout ? Math.max(0, Math.round((checkout - checkin) / 86400000)) : null;
      return { ...guest, stayDays };
    });

    const currentGuests = enriched.filter((guest) => guest.checkinAt && !guest.checkoutAt).length;
    const checkedOutGuests = enriched.filter((guest) => guest.stayDays !== null);
    const totalGuests = guests.length;
    const activeGuests = guests.filter((guest) => guest.status === 'active').length;
    const registeredCards = guests.filter((guest) => guest.cardNumber && String(guest.cardNumber).trim() !== '').length;
    const inactiveGuestCards = guests.filter((guest) => guest.status === 'inactive' && guest.cardNumber && String(guest.cardNumber).trim() !== '').length;
    const stayDaysList = checkedOutGuests.map((guest) => guest.stayDays);
    const averageStayDays = stayDaysList.length ? Math.round(stayDaysList.reduce((sum, days) => sum + days, 0) / stayDaysList.length) : 0;
    const longestStayDays = stayDaysList.length ? Math.max(...stayDaysList) : 0;
    const shortestStayDays = stayDaysList.length ? Math.min(...stayDaysList) : 0;

    res.json({
      totalGuests,
      activeGuests,
      registeredCards,
      inactiveGuestCards,
      currentGuests,
      checkedOutGuests: checkedOutGuests.length,
      averageStayDays,
      longestStayDays,
      shortestStayDays,
      guestStatsList: enriched
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username = 'admin', password } = req.body || {};
  const userRow = await dbGet(`
    SELECT u.id, u.username, u.password, u.status, u.roleId, r.name AS roleName, r.modules
    FROM users u
    LEFT JOIN roles r ON r.id = u.roleId
    WHERE u.username = ? AND u.status = ?
  `, [username, 'active']);

  if (!userRow || userRow.password !== password) {
    if (username === 'admin' && password === adminPassword) {
      const fallbackRole = await dbGet('SELECT * FROM roles WHERE name = ?', ['admin']);
      const modules = parseModulesValue(fallbackRole?.modules || allModules);
      const token = createAdminToken();
      const user = { id: 1, username: 'admin', roleName: 'admin', modules, status: 'active' };
      adminTokens.set(token, { user, token });
      return res.json({ success: true, token, user });
    }
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  const modules = parseModulesValue(userRow.modules || []);
  const token = createAdminToken();
  const user = {
    id: userRow.id,
    username: userRow.username,
    roleName: userRow.roleName || 'user',
    modules,
    status: userRow.status
  };
  adminTokens.set(token, { user, token });
  return res.json({ success: true, token, user });
});

app.post('/api/logout', (req, res) => {
  const token = req.header('x-admin-token');
  if (token) {
    adminTokens.delete(token);
  }
  res.json({ success: true });
});

app.get('/api/roles', async (_req, res) => {
  try {
    const roles = await dbAll('SELECT * FROM roles ORDER BY createdAt DESC');
    res.json(roles.map((role) => ({ ...role, modules: parseModulesValue(role.modules) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roles', async (req, res) => {
  try {
    const { name, modules } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    const result = await dbRun('INSERT INTO roles (name, modules, createdAt) VALUES (?, ?, ?)', [name, serializeModules(modules || []), nowIso()]);
    res.status(201).json({ id: result.id, name, modules: normalizeModules(modules || []), createdAt: nowIso() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/roles/:id', async (req, res) => {
  try {
    const { name, modules } = req.body;
    await dbRun('UPDATE roles SET name = ?, modules = ? WHERE id = ?', [name, serializeModules(modules || []), req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/roles/:id', async (req, res) => {
  try {
    await dbRun('UPDATE users SET roleId = NULL WHERE roleId = ?', [req.params.id]);
    await dbRun('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    const users = await dbAll(`
      SELECT u.*, r.name AS roleName
      FROM users u
      LEFT JOIN roles r ON r.id = u.roleId
      ORDER BY u.createdAt DESC
    `);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, roleId, status } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    const result = await dbRun('INSERT INTO users (username, password, roleId, status, createdAt) VALUES (?, ?, ?, ?, ?)', [username, password, roleId || null, status || 'active', nowIso()]);
    res.status(201).json({ id: result.id, username, roleId: roleId || null, status: status || 'active', createdAt: nowIso() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { username, password, roleId, status } = req.body;
    const updateParts = [];
    const values = [];

    if (username !== undefined) {
      updateParts.push('username = ?');
      values.push(username);
    }
    if (password !== undefined && password !== '') {
      updateParts.push('password = ?');
      values.push(password);
    }
    if (roleId !== undefined) {
      updateParts.push('roleId = ?');
      values.push(roleId || null);
    }
    if (status !== undefined) {
      updateParts.push('status = ?');
      values.push(status);
    }

    if (!updateParts.length) return res.json({ success: true });

    values.push(req.params.id);
    await dbRun(`UPDATE users SET ${updateParts.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    const { fullName, phone, roomId, cardNumber, notes, status, checkinAt, checkoutAt } = req.body;
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    const result = await dbRun(
      'INSERT INTO guests (fullName, phone, roomId, cardNumber, notes, ktpPath, checkinAt, checkoutAt, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fullName, phone || '', roomId || null, cardNumber || '', notes || '', '', checkinAt || null, checkoutAt || null, status || 'active', nowIso()]
    );
    res.status(201).json({ id: result.id, fullName, phone: phone || '', roomId: roomId || null, cardNumber: cardNumber || '', notes: notes || '', checkinAt: checkinAt || null, checkoutAt: checkoutAt || null, status: status || 'active', createdAt: nowIso() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/guests/:id', async (req, res) => {
  try {
    const { fullName, phone, roomId, cardNumber, notes, status, checkinAt, checkoutAt } = req.body;
    await dbRun('UPDATE guests SET fullName = ?, phone = ?, roomId = ?, cardNumber = ?, notes = ?, checkinAt = ?, checkoutAt = ?, status = ? WHERE id = ?', [fullName, phone || '', roomId || null, cardNumber || '', notes || '', checkinAt || null, checkoutAt || null, status, req.params.id]);
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
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Kost management app running on http://localhost:${PORT}`);
});
