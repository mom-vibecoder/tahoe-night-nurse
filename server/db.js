const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'db.sqlite');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        baby_timing TEXT,
        start_timeframe TEXT NOT NULL,
        notes TEXT,
        updates_opt_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS caregivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        certs TEXT,
        years_experience INTEGER,
        availability TEXT NOT NULL,
        notes TEXT,
        updates_opt_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS newsletter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_parents_email 
    ON parents(email);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_caregivers_email 
    ON caregivers(email);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email 
    ON newsletter(email);
`);

// Prepared statements
const insertParent = db.prepare(`
    INSERT OR REPLACE INTO parents 
    (full_name, email, phone, baby_timing, start_timeframe, notes, updates_opt_in, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCaregiver = db.prepare(`
    INSERT OR REPLACE INTO caregivers 
    (full_name, email, phone, certs, years_experience, availability, notes, updates_opt_in, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertNewsletter = db.prepare(`
    INSERT OR REPLACE INTO newsletter 
    (email, created_at)
    VALUES (?, ?)
`);

const getAllParents = db.prepare('SELECT * FROM parents ORDER BY created_at DESC');
const getAllCaregivers = db.prepare('SELECT * FROM caregivers ORDER BY created_at DESC');
const getAllNewsletter = db.prepare('SELECT * FROM newsletter ORDER BY created_at DESC');

function addParent(data) {
    const created_at = new Date().toISOString();
    return insertParent.run(
        data.full_name,
        data.email,
        data.phone || null,
        data.baby_timing || null,
        data.start_timeframe,
        data.notes || null,
        data.updates_opt_in ? 1 : 0,
        created_at
    );
}

function addCaregiver(data) {
    const created_at = new Date().toISOString();
    const certs = Array.isArray(data.certs) ? data.certs.join(', ') : data.certs;
    
    return insertCaregiver.run(
        data.full_name,
        data.email,
        data.phone,
        certs || null,
        data.years_experience || null,
        data.availability,
        data.notes || null,
        data.updates_opt_in ? 1 : 0,
        created_at
    );
}

function addNewsletter(email) {
    const created_at = new Date().toISOString();
    return insertNewsletter.run(email, created_at);
}

module.exports = {
    db,
    addParent,
    addCaregiver,
    addNewsletter,
    getAllParents,
    getAllCaregivers,
    getAllNewsletter
};