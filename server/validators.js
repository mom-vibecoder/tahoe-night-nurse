const { body, validationResult } = require('express-validator');

const parentLeadValidation = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email address is too long'),

  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\d\s\-\(\)\+\.]+$/)
    .withMessage('Please provide a valid phone number'),

  body('location')
    .trim()
    .isIn(['South Lake Tahoe', 'North Lake Tahoe', 'Truckee', 'Visiting (not local)', 'Other (in region)'])
    .withMessage('Please select a valid location'),

  body('due_or_age')
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Please provide due date or child age'),

  body('start_timeframe')
    .trim()
    .isIn(['ASAP', 'Next 2-4 weeks', '1-3 months', '3+ months', 'Just researching'])
    .withMessage('Please select a valid timeframe'),

  body('notes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),

  body('_hp')
    .isEmpty()
    .withMessage('Invalid submission')
];

const caregiverApplicationValidation = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email address is too long'),

  body('phone')
    .trim()
    .matches(/^[\d\s\-\(\)\+\.]+$/)
    .withMessage('Please provide a valid phone number'),

  body('location')
    .trim()
    .isIn(['South Lake Tahoe', 'North Lake Tahoe', 'Truckee', 'Other Tahoe Area'])
    .withMessage('Please select a valid location'),

  body('years_experience')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 50 })
    .withMessage('Years of experience must be a number between 0 and 50'),

  body('certs')
    .isArray({ min: 1 })
    .withMessage('Please select at least one certification'),

  body('availability')
    .trim()
    .isIn(['Primarily weeknights', 'Primarily weekends', 'Open to both weeknights and weekends', 'Very flexible - open to discuss'])
    .withMessage('Please select a valid availability preference'),

  body('_hp')
    .isEmpty()
    .withMessage('Invalid submission')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, remove the 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  
  return digits;
};

module.exports = {
  parentLeadValidation,
  caregiverApplicationValidation,
  handleValidationErrors,
  normalizePhone
};