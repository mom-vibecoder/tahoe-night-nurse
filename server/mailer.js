const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

// Initialize transporter only if SMTP credentials are provided
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

function sendParentNotification(parentData) {
    if (!transporter || !process.env.ADMIN_EMAIL) {
        console.log('Email not configured, skipping parent notification');
        return;
    }

    const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Parent Registration - Tahoe Night Nurse',
        text: `
New parent registration:

Name: ${parentData.full_name}
Email: ${parentData.email}
Phone: ${parentData.phone || 'Not provided'}
Baby timing: ${parentData.baby_timing || 'Not provided'}
Start timeframe: ${parentData.start_timeframe}
Notes: ${parentData.notes || 'None'}
Email updates: ${parentData.updates_opt_in ? 'Yes' : 'No'}

Submitted at: ${new Date().toLocaleString()}
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending parent notification:', error);
        } else {
            console.log('Parent notification sent:', info.messageId);
        }
    });
}

function sendCaregiverNotification(caregiverData) {
    if (!transporter || !process.env.ADMIN_EMAIL) {
        console.log('Email not configured, skipping caregiver notification');
        return;
    }

    const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Caregiver Application - Tahoe Night Nurse',
        text: `
New caregiver application:

Name: ${caregiverData.full_name}
Email: ${caregiverData.email}
Phone: ${caregiverData.phone}
Certifications: ${caregiverData.certs || 'None'}
Years of experience: ${caregiverData.years_experience || 'Not specified'}
Availability: ${caregiverData.availability}
Notes: ${caregiverData.notes || 'None'}
Email updates: ${caregiverData.updates_opt_in ? 'Yes' : 'No'}

Submitted at: ${new Date().toLocaleString()}
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending caregiver notification:', error);
        } else {
            console.log('Caregiver notification sent:', info.messageId);
        }
    });
}

module.exports = {
    sendParentNotification,
    sendCaregiverNotification
};