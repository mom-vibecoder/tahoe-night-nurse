const formData = require('form-data');
const Mailgun = require('mailgun.js');

class EmailService {
  constructor() {
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      const mailgun = new Mailgun(formData);
      this.mg = mailgun.client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY,
        url: process.env.MAILGUN_API_URL || 'https://api.mailgun.net'
      });
      this.domain = process.env.MAILGUN_DOMAIN;
      this.provider = 'mailgun';
    } else {
      this.provider = 'console';
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Email service not configured. Using console output.');
      }
    }
  }

  async sendAdminNotification(type, data) {
    const subject = type === 'parent'
      ? `[TNN] New Parent Lead - ${data.full_name}`
      : `[TNN] New Caregiver Application - ${data.full_name}`;

    const textContent = this.formatAdminEmail(type, data);
    const htmlContent = this.formatAdminEmailHtml(type, data);

    const msg = {
      to: process.env.ADMIN_EMAIL,
      from: process.env.FROM_EMAIL || 'noreply@tahoenightnurse.com',
      subject,
      text: textContent,
      html: htmlContent
    };

    if (process.env.BCC_ARCHIVE_EMAIL) {
      msg.bcc = process.env.BCC_ARCHIVE_EMAIL;
    }

    return this.send(msg);
  }

  async sendUserConfirmation(type, data) {
    let subject, text, html;

    if (type === 'parent') {
      subject = 'Thanks — You\'re on the Tahoe Night Nurse Priority List';
      text = this.formatParentConfirmationText(data);
      html = this.formatParentConfirmationHtml(data);
    } else {
      subject = 'Thanks for Your Caregiver Application — Tahoe Night Nurse';
      text = this.formatCaregiverConfirmationText(data);
      html = this.formatCaregiverConfirmationHtml(data);
    }

    const msg = {
      to: data.email,
      from: process.env.FROM_EMAIL || 'noreply@tahoenightnurse.com',
      subject,
      text,
      html
    };

    return this.send(msg);
  }

  async send(msg) {
    if (this.provider === 'console') {
      console.log('📧 Email would be sent:', {
        to: msg.to,
        subject: msg.subject,
        text: msg.text
      });
      return { success: true, provider: 'console' };
    }

    try {
      const result = await this.mg.messages.create(this.domain, msg);
      console.log('✅ Email sent via Mailgun:', result.id);
      return { success: true, id: result.id, provider: 'mailgun' };
    } catch (error) {
      console.error('❌ Email send failed:', error);
      throw error;
    }
  }

  formatAdminEmail(type, data) {
    if (type === 'parent') {
      return `
New Parent Lead Received!

Name: ${data.full_name}
Email: ${data.email}
Phone: ${data.phone || 'Not provided'}
Location: ${data.location}
Due/Age: ${data.due_or_age}
Start Timeframe: ${data.start_timeframe}
Notes: ${data.notes || 'None'}

${data.is_duplicate ? '⚠️  DUPLICATE EMAIL DETECTED (within 30 days)' : ''}

Submitted: ${new Date().toLocaleString()}
User Agent: ${data.user_agent || 'Unknown'}
IP Address: ${data.ip_addr || 'Unknown'}
      `.trim();
    } else {
      return `
New Caregiver Application Received!

Name: ${data.full_name}
Email: ${data.email}
Phone: ${data.phone}
Base Location: ${data.base_location}
Willing Regions: ${data.willing_regions}
Experience: ${data.experience_years} years
Certifications: ${data.certifications}
Availability: ${data.availability_notes || 'Not specified'}
Experience Summary: ${data.experience_summary || 'Not provided'}

${data.is_duplicate ? '⚠️  DUPLICATE EMAIL DETECTED (within 30 days)' : ''}

Submitted: ${new Date().toLocaleString()}
User Agent: ${data.user_agent || 'Unknown'}
IP Address: ${data.ip_addr || 'Unknown'}
      `.trim();
    }
  }

  formatAdminEmailHtml(type, data) {
    const duplicateWarning = data.is_duplicate 
      ? '<p style="color: #dc2626; font-weight: bold;">⚠️ DUPLICATE EMAIL DETECTED (within 30 days)</p>' 
      : '';

    if (type === 'parent') {
      return `
        <h2>New Parent Lead Received!</h2>
        ${duplicateWarning}
        <p><strong>Name:</strong> ${data.full_name}</p>
        <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
        <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
        <p><strong>Location:</strong> ${data.location}</p>
        <p><strong>Due/Age:</strong> ${data.due_or_age}</p>
        <p><strong>Start Timeframe:</strong> ${data.start_timeframe}</p>
        <p><strong>Notes:</strong> ${data.notes || 'None'}</p>
        <hr>
        <p><small>Submitted: ${new Date().toLocaleString()}</small></p>
      `;
    } else {
      return `
        <h2>New Caregiver Application Received!</h2>
        ${duplicateWarning}
        <p><strong>Name:</strong> ${data.full_name}</p>
        <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Base Location:</strong> ${data.base_location}</p>
        <p><strong>Willing Regions:</strong> ${data.willing_regions}</p>
        <p><strong>Experience:</strong> ${data.experience_years} years</p>
        <p><strong>Certifications:</strong> ${data.certifications}</p>
        <p><strong>Availability:</strong> ${data.availability_notes || 'Not specified'}</p>
        <p><strong>Experience Summary:</strong> ${data.experience_summary || 'Not provided'}</p>
        <hr>
        <p><small>Submitted: ${new Date().toLocaleString()}</small></p>
      `;
    }
  }

  formatParentConfirmationText(data) {
    return `
Hi ${data.full_name.split(' ')[0]},

Thanks for joining the Tahoe Night Nurse priority list! 

We're building a trusted network of certified night nurses right here in the Lake Tahoe region, and you're among the first to know when we launch.

What happens next?
• We'll keep you updated on our progress
• Priority access when we launch in your area (${data.location})
• No spam, just the important updates

Have questions? Just reply to this email.

Best,
The Tahoe Night Nurse Team

P.S. Feel free to forward this to other parents who might be interested!
    `.trim();
  }

  formatParentConfirmationHtml(data) {
    return `
      <p>Hi ${data.full_name.split(' ')[0]},</p>
      
      <p>Thanks for joining the Tahoe Night Nurse priority list!</p>
      
      <p>We're building a trusted network of certified night nurses right here in the Lake Tahoe region, and you're among the first to know when we launch.</p>
      
      <h3>What happens next?</h3>
      <ul>
        <li>We'll keep you updated on our progress</li>
        <li>Priority access when we launch in your area (${data.location})</li>
        <li>No spam, just the important updates</li>
      </ul>
      
      <p>Have questions? Just reply to this email.</p>
      
      <p>Best,<br>The Tahoe Night Nurse Team</p>
      
      <p><small>P.S. Feel free to forward this to other parents who might be interested!</small></p>
    `;
  }

  formatCaregiverConfirmationText(data) {
    return `
Hi ${data.full_name.split(' ')[0]},

Thank you for your interest in joining the Tahoe Night Nurse team!

We received your application and we're excited to learn more about your background in newborn care. Our team will review your application and reach out within the next few days.

In the meantime, feel free to reach out if you have any questions about the role or our service.

Best regards,
The Tahoe Night Nurse Team
    `.trim();
  }

  formatCaregiverConfirmationHtml(data) {
    return `
      <p>Hi ${data.full_name.split(' ')[0]},</p>
      
      <p>Thank you for your interest in joining the Tahoe Night Nurse team!</p>
      
      <p>We received your application and we're excited to learn more about your background in newborn care. Our team will review your application and reach out within the next few days.</p>
      
      <p>In the meantime, feel free to reach out if you have any questions about the role or our service.</p>
      
      <p>Best regards,<br>The Tahoe Night Nurse Team</p>
    `;
  }
}

module.exports = new EmailService();