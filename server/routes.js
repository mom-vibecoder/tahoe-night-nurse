const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const basicAuth = require('basic-auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const os = require('os');

const database = require('./db');
const emailService = require('./email');
const {
  parentLeadValidation,
  caregiverApplicationValidation,
  handleValidationErrors,
  normalizePhone
} = require('./validators');

const router = express.Router();

// Rate limiting for form submissions
const formLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many submissions. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for form submissions
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: { error: 'Too many submission attempts. Please try again later.' },
  skipSuccessfulRequests: true
});

// Basic auth middleware for admin routes
function authenticate(req, res, next) {
  const credentials = basicAuth(req);
  
  if (!credentials ||
      credentials.name !== process.env.BASIC_AUTH_USER ||
      credentials.pass !== process.env.BASIC_AUTH_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    res.status(401).send('Access denied');
    return;
  }
  
  next();
}

// Serve static files
router.use(express.static(path.join(__dirname, '..', 'public')));

// Helper function to serve HTML files
function serveHTML(filename) {
  return (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', filename));
  };
}

// Page routes
router.get('/', serveHTML('home.html'));
router.get('/parents', serveHTML('parents.html'));
router.get('/caregivers', serveHTML('caregivers.html'));
router.get('/thank-you', serveHTML('thank-you.html'));
router.get('/privacy', serveHTML('privacy.html'));

// Middleware to combine first_name and last_name into full_name
const combineNames = (req, res, next) => {
  if (req.body.first_name && req.body.last_name) {
    req.body.full_name = `${req.body.first_name.trim()} ${req.body.last_name.trim()}`;
  }
  next();
};

// API Routes with new validation and architecture
router.post('/api/parents',
  formLimiter,
  strictLimiter,
  combineNames,
  parentLeadValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const data = {
        ...req.body,
        phone: normalizePhone(req.body.phone),
        user_agent: req.get('user-agent'),
        ip_addr: req.ip || req.connection.remoteAddress
      };

      // Remove honeypot field
      delete data._hp;

      const result = database.insertParentLead(data);

      // Send email notifications
      try {
        await emailService.sendAdminNotification('parent', { ...data, is_duplicate: result.isDuplicate });
        
        if (process.env.NODE_ENV === 'production' && data.email) {
          await emailService.sendUserConfirmation('parent', data);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }

      res.redirect('/thank-you');
    } catch (error) {
      console.error('Parent lead submission error:', error);
      res.status(500).json({
        ok: false,
        message: 'Sorry, something went wrong. Please try again or email us directly.'
      });
    }
  }
);

router.post('/api/caregivers',
  formLimiter,
  strictLimiter,
  combineNames,
  caregiverApplicationValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const data = {
        ...req.body,
        phone: normalizePhone(req.body.phone),
        user_agent: req.get('user-agent'),
        ip_addr: req.ip || req.connection.remoteAddress
      };

      // Remove honeypot field
      delete data._hp;

      const result = database.insertCaregiverApplication(data);

      // Send email notifications
      try {
        await emailService.sendAdminNotification('caregiver', { ...data, is_duplicate: result.isDuplicate });
        
        if (process.env.NODE_ENV === 'production' && data.email) {
          await emailService.sendUserConfirmation('caregiver', data);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }

      res.redirect('/thank-you');
    } catch (error) {
      console.error('Caregiver application submission error:', error);
      res.status(500).json({
        ok: false,
        message: 'Sorry, something went wrong. Please try again or email us directly.'
      });
    }
  }
);

router.post('/api/newsletter', formLimiter, (req, res) => {
  try {
    const { email, company } = req.body;
    
    // Honeypot check
    if (company && company.length > 0) {
      return res.status(400).json({ error: 'Bot detected' });
    }
    
    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    
    const result = database.addNewsletter(email);
    
    res.redirect('/thank-you');
  } catch (error) {
    console.error('Error adding newsletter signup:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.redirect('/thank-you'); // Already subscribed, redirect anyway
    } else {
      res.status(500).json({ error: 'We couldn\'t submit right now. Please try again shortly.' });
    }
  }
});

// API Stats endpoint
router.get('/api/stats', (req, res) => {
  try {
    const stats = database.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// Admin routes
router.use('/admin', authenticate);

router.get('/admin', (req, res) => {
  const stats = database.getStats();
  const parents = database.getParentLeads({ limit: 10 });
  const caregivers = database.getCaregiverApplications({ limit: 10 });

  res.render('admin/dashboard', {
    title: 'Admin Dashboard - Tahoe Night Nanny',
    stats,
    recentParents: parents,
    recentCaregivers: caregivers
  });
});

router.get('/admin/parents', (req, res) => {
  const filters = {
    startDate: req.query.start_date,
    endDate: req.query.end_date,
    location: req.query.location
  };

  const parents = database.getParentLeads(filters);
  const stats = database.getStats();

  const parentsWithDuplicateFlag = parents.map(parent => {
    const duplicates = parents.filter(p =>
      p.email === parent.email && p.id !== parent.id
    );
    return {
      ...parent,
      hasDuplicates: duplicates.length > 0
    };
  });

  res.render('admin/parents', {
    title: 'Parent Leads - Admin - Tahoe Night Nanny',
    parents: parentsWithDuplicateFlag,
    totalParents: stats.totalParents || 0,
    parentsThisWeek: stats.parentsThisWeek || 0,
    parentsThisMonth: stats.parentsThisMonth || 0,
    filters,
    locations: [
      'South Lake Tahoe',
      'North Lake Tahoe',
      'Truckee',
      'Visiting (not local)',
      'Other (in region)'
    ]
  });
});

router.get('/admin/caregivers', (req, res) => {
  const filters = {
    startDate: req.query.start_date,
    endDate: req.query.end_date,
    experience_years: req.query.experience,
    certification: req.query.certification
  };

  const caregivers = database.getCaregiverApplications(filters);
  const stats = database.getStats();

  const caregiversWithDuplicateFlag = caregivers.map(caregiver => {
    const duplicates = caregivers.filter(c =>
      c.email === caregiver.email && c.id !== caregiver.id
    );
    return {
      ...caregiver,
      hasDuplicates: duplicates.length > 0
    };
  });

  res.render('admin/caregivers', {
    title: 'Caregiver Applications - Admin - Tahoe Night Nanny',
    caregivers: caregiversWithDuplicateFlag,
    totalCaregivers: stats.totalCaregivers || 0,
    caregiversThisWeek: stats.caregiversThisWeek || 0,
    caregiversThisMonth: stats.caregiversThisMonth || 0,
    filters,
    experienceOptions: ['<1', '1-2', '2-5', '5+'],
    certificationOptions: ['ncs', 'doula', 'rn_lpn', 'cpr', 'none']
  });
});

router.get('/admin/newsletter', (req, res) => {
  const stats = database.getNewsletterStats();
  const subscribers = database.getAllNewsletter();

  res.render('admin/newsletter', {
    title: 'Newsletter Subscriptions - Admin - Tahoe Night Nanny',
    stats,
    subscribers
  });
});

// CSV export routes (admin only)
router.get('/admin/export/parents', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      location: req.query.location
    };

    const parents = database.getParentLeads(filters);

    const tempPath = path.join(os.tmpdir(), `parents_${Date.now()}.csv`);

    const csvWriter = createCsvWriter({
      path: tempPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'created_at', title: 'Date' },
        { id: 'full_name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'phone', title: 'Phone' },
        { id: 'location', title: 'Location' },
        { id: 'due_or_age', title: 'Due/Age' },
        { id: 'start_timeframe', title: 'Start Timeframe' },
        { id: 'notes', title: 'Notes' },
        { id: 'is_duplicate', title: 'Duplicate' }
      ]
    });

    await csvWriter.writeRecords(parents);

    res.download(tempPath, `tahoe_night_nurse_parents_${new Date().toISOString().split('T')[0]}.csv`, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).send('Failed to download file');
      }
      fs.unlinkSync(tempPath);
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).send('Failed to export data');
  }
});

router.get('/admin/export/caregivers', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      experience_years: req.query.experience,
      certification: req.query.certification
    };

    const caregivers = database.getCaregiverApplications(filters);

    const tempPath = path.join(os.tmpdir(), `caregivers_${Date.now()}.csv`);

    const csvWriter = createCsvWriter({
      path: tempPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'created_at', title: 'Date' },
        { id: 'full_name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'phone', title: 'Phone' },
        { id: 'base_location', title: 'Base Location' },
        { id: 'willing_regions', title: 'Willing Regions' },
        { id: 'experience_years', title: 'Experience' },
        { id: 'certifications', title: 'Certifications' },
        { id: 'availability_notes', title: 'Availability' },
        { id: 'experience_summary', title: 'Experience Summary' },
        { id: 'is_duplicate', title: 'Duplicate' }
      ]
    });

    await csvWriter.writeRecords(caregivers);

    res.download(tempPath, `tahoe_night_nurse_caregivers_${new Date().toISOString().split('T')[0]}.csv`, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).send('Failed to download file');
      }
      fs.unlinkSync(tempPath);
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).send('Failed to export data');
  }
});

// Legacy CSV export (backward compatibility)
router.get('/admin/export.csv', authenticate, (req, res) => {
  const type = req.query.type;
  
  if (type === 'parents') {
    return res.redirect('/admin/export/parents');
  } else if (type === 'caregivers') {
    return res.redirect('/admin/export/caregivers');
  } else if (type === 'newsletter') {
    const subscribers = database.getAllNewsletter();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="newsletter.csv"');
    
    let csv = 'ID,Email,Created At\n';
    
    subscribers.forEach(subscriber => {
      csv += `${subscriber.id},"${subscriber.email}","${subscriber.created_at}"\n`;
    });
    
    res.send(csv);
  } else {
    res.status(400).send('Invalid export type. Use ?type=parents, ?type=caregivers, or ?type=newsletter');
  }
});

module.exports = router;