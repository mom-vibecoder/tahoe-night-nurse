const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { addParent, addCaregiver, addNewsletter, getAllParents, getAllCaregivers, getAllNewsletter } = require('./db');
const { sendParentNotification, sendCaregiverNotification } = require('./mailer');

const router = express.Router();

// Rate limiting for form submissions
const formLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    message: { error: 'Too many submissions. Please try again shortly.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Basic auth middleware for admin routes
function basicAuth(req, res, next) {
    const auth = req.headers.authorization;
    
    if (!auth || !auth.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Admin"');
        return res.status(401).send('Authentication required');
    }
    
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];
    
    if (username === process.env.BASIC_AUTH_USER && password === process.env.BASIC_AUTH_PASS) {
        next();
    } else {
        res.set('WWW-Authenticate', 'Basic realm="Admin"');
        res.status(401).send('Invalid credentials');
    }
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

// Validation helpers
function validateParentForm(data) {
    const errors = [];
    
    if (!data.full_name || data.full_name.trim().length === 0) {
        errors.push('Full name is required');
    }
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Valid email is required');
    }
    
    if (!data.start_timeframe) {
        errors.push('Start timeframe is required');
    }
    
    // Honeypot check
    if (data.company && data.company.length > 0) {
        errors.push('Bot detected');
    }
    
    return errors;
}

function validateCaregiverForm(data) {
    const errors = [];
    
    if (!data.full_name || data.full_name.trim().length === 0) {
        errors.push('Full name is required');
    }
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Valid email is required');
    }
    
    if (!data.phone || data.phone.trim().length === 0) {
        errors.push('Phone number is required');
    }
    
    if (!data.availability) {
        errors.push('Availability is required');
    }
    
    // Honeypot check
    if (data.company && data.company.length > 0) {
        errors.push('Bot detected');
    }
    
    return errors;
}

// API routes
router.post('/api/parents', formLimiter, (req, res) => {
    try {
        const errors = validateParentForm(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json({ error: errors[0] });
        }
        
        const result = addParent(req.body);
        
        // Send email notification
        sendParentNotification(req.body);
        
        res.redirect('/thank-you');
    } catch (error) {
        console.error('Error adding parent:', error);
        res.status(500).json({ error: 'We couldn\'t submit right now. Please try again shortly.' });
    }
});

router.post('/api/caregivers', formLimiter, (req, res) => {
    try {
        const errors = validateCaregiverForm(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json({ error: errors[0] });
        }
        
        const result = addCaregiver(req.body);
        
        // Send email notification
        sendCaregiverNotification(req.body);
        
        res.redirect('/thank-you');
    } catch (error) {
        console.error('Error adding caregiver:', error);
        res.status(500).json({ error: 'We couldn\'t submit right now. Please try again shortly.' });
    }
});

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
        
        const result = addNewsletter(email);
        
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

// CSV export routes (admin only)
router.get('/admin/export.csv', basicAuth, (req, res) => {
    const type = req.query.type;
    
    if (type === 'parents') {
        const parents = getAllParents.all();
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="parents.csv"');
        
        let csv = 'ID,Full Name,Email,Phone,Baby Timing,Start Timeframe,Notes,Email Updates,Created At\n';
        
        parents.forEach(parent => {
            csv += `${parent.id},"${parent.full_name}","${parent.email}","${parent.phone || ''}","${parent.baby_timing || ''}","${parent.start_timeframe}","${parent.notes || ''}","${parent.updates_opt_in ? 'Yes' : 'No'}","${parent.created_at}"\n`;
        });
        
        res.send(csv);
    } else if (type === 'caregivers') {
        const caregivers = getAllCaregivers.all();
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="caregivers.csv"');
        
        let csv = 'ID,Full Name,Email,Phone,Certifications,Years Experience,Availability,Notes,Email Updates,Created At\n';
        
        caregivers.forEach(caregiver => {
            csv += `${caregiver.id},"${caregiver.full_name}","${caregiver.email}","${caregiver.phone}","${caregiver.certs || ''}","${caregiver.years_experience || ''}","${caregiver.availability}","${caregiver.notes || ''}","${caregiver.updates_opt_in ? 'Yes' : 'No'}","${caregiver.created_at}"\n`;
        });
        
        res.send(csv);
    } else if (type === 'newsletter') {
        const subscribers = getAllNewsletter.all();
        
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