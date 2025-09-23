const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'tahoe-night-nurse.db');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeTables();
  }

  initializeTables() {
    const createParentsTable = `
      CREATE TABLE IF NOT EXISTS parents_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL CHECK(length(full_name) >= 2 AND length(full_name) <= 100),
        email TEXT NOT NULL CHECK(length(email) <= 254),
        phone TEXT,
        location TEXT NOT NULL CHECK(
          location IN (
            'South Lake Tahoe',
            'North Lake Tahoe',
            'Truckee',
            'Visiting (not local)',
            'Other (in region)'
          )
        ),
        due_or_age TEXT NOT NULL CHECK(length(due_or_age) >= 1 AND length(due_or_age) <= 60),
        start_timeframe TEXT NOT NULL CHECK(
          start_timeframe IN (
            'ASAP',
            'Next 2-4 weeks',
            '1-3 months',
            '3+ months',
            'Just researching'
          )
        ),
        notes TEXT CHECK(length(notes) <= 1000),
        user_agent TEXT,
        ip_addr TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_duplicate BOOLEAN DEFAULT 0
      )
    `;

    const createCaregiversTable = `
      CREATE TABLE IF NOT EXISTS caregiver_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL CHECK(length(full_name) >= 2 AND length(full_name) <= 100),
        email TEXT NOT NULL CHECK(length(email) <= 254),
        phone TEXT NOT NULL,
        base_location TEXT NOT NULL CHECK(length(base_location) >= 2 AND length(base_location) <= 120),
        willing_regions TEXT NOT NULL,
        experience_years INTEGER CHECK(experience_years >= 0 AND experience_years <= 50),
        certifications TEXT NOT NULL,
        availability_notes TEXT CHECK(length(availability_notes) <= 280),
        experience_summary TEXT CHECK(length(experience_summary) <= 600),
        user_agent TEXT,
        ip_addr TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_duplicate BOOLEAN DEFAULT 0
      )
    `;

    const createNewsletterTable = `
      CREATE TABLE IF NOT EXISTS newsletter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.exec(createParentsTable);
    this.db.exec(createCaregiversTable);
    this.db.exec(createNewsletterTable);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_parents_email ON parents_leads(email);
      CREATE INDEX IF NOT EXISTS idx_parents_created ON parents_leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_caregivers_email ON caregiver_applications(email);
      CREATE INDEX IF NOT EXISTS idx_caregivers_created ON caregiver_applications(created_at);
    `);
  }

  insertParentLead(data) {
    const stmt = this.db.prepare(`
      INSERT INTO parents_leads (
        full_name, email, phone, location, due_or_age,
        start_timeframe, notes, user_agent, ip_addr, is_duplicate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const isDuplicate = this.checkDuplicate('parents_leads', data.email);

    const result = stmt.run(
      data.full_name,
      data.email.toLowerCase(),
      data.phone || null,
      data.location,
      data.due_or_age,
      data.start_timeframe,
      data.notes || null,
      data.user_agent || null,
      data.ip_addr || null,
      isDuplicate ? 1 : 0
    );

    return { id: result.lastInsertRowid, isDuplicate };
  }

  insertCaregiverApplication(data) {
    const stmt = this.db.prepare(`
      INSERT INTO caregiver_applications (
        full_name, email, phone, base_location, willing_regions,
        experience_years, certifications, availability_notes,
        experience_summary, user_agent, ip_addr, is_duplicate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const isDuplicate = this.checkDuplicate('caregiver_applications', data.email);
    const willingRegions = data.location || null; // Use single location from dropdown
    const certifications = Array.isArray(data.certs)
      ? data.certs.join(',')
      : data.certs;

    const result = stmt.run(
      data.full_name,
      data.email.toLowerCase(),
      data.phone,
      data.location || null, // base_location = location from form
      willingRegions, // willing_regions = same as location for now
      data.years_experience ? parseInt(data.years_experience) : null, // experience_years = years_experience from form
      certifications,
      data.availability || null, // availability_notes = availability from form  
      data.notes || null, // experience_summary = notes from form
      data.user_agent || null,
      data.ip_addr || null,
      isDuplicate ? 1 : 0
    );

    return { id: result.lastInsertRowid, isDuplicate };
  }

  checkDuplicate(table, email) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM ${table}
      WHERE email = ? AND created_at > ?
    `);

    const result = stmt.get(email.toLowerCase(), thirtyDaysAgo.toISOString());
    return result.count > 0;
  }

  getParentLeads(filters = {}) {
    let query = 'SELECT * FROM parents_leads WHERE 1=1';
    const params = [];

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.location) {
      query += ' AND location = ?';
      params.push(filters.location);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getCaregiverApplications(filters = {}) {
    let query = 'SELECT * FROM caregiver_applications WHERE 1=1';
    const params = [];

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.experience_years) {
      query += ' AND experience_years = ?';
      params.push(filters.experience_years);
    }

    if (filters.certification) {
      query += ' AND certifications LIKE ?';
      params.push(`%${filters.certification}%`);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  addNewsletter(email) {
    const stmt = this.db.prepare('INSERT INTO newsletter (email) VALUES (?)');
    return stmt.run(email.toLowerCase());
  }

  getAllNewsletter() {
    const stmt = this.db.prepare('SELECT * FROM newsletter ORDER BY created_at DESC');
    return stmt.all();
  }

  getStats() {
    const parentCount = this.db.prepare('SELECT COUNT(*) as count FROM parents_leads').get();
    const caregiverCount = this.db.prepare('SELECT COUNT(*) as count FROM caregiver_applications').get();
    const recentParents = this.db.prepare(`
      SELECT COUNT(*) as count FROM parents_leads
      WHERE created_at > datetime('now', '-7 days')
    `).get();
    const recentCaregivers = this.db.prepare(`
      SELECT COUNT(*) as count FROM caregiver_applications
      WHERE created_at > datetime('now', '-7 days')
    `).get();

    return {
      totalParents: parentCount.count,
      totalCaregivers: caregiverCount.count,
      recentParents: recentParents.count,
      recentCaregivers: recentCaregivers.count
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = new DatabaseManager();