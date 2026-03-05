const nodemailer = require('nodemailer');

// Create reusable transporter — falls back gracefully when credentials are missing
const createTransporter = () => {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
    return null; // No email configured
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const transporter = createTransporter();

// Base HTML wrapper for emails
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:20px; }
    .container { max-width:580px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:32px 40px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px; }
    .header p { color:rgba(255,255,255,.8); margin:8px 0 0; font-size:14px; }
    .body { padding:32px 40px; color:#374151; }
    .body p { line-height:1.7; margin:0 0 16px; }
    .btn { display:inline-block; padding:14px 28px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; margin:8px 0; }
    .info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px 20px; margin:16px 0; }
    .info-box p { margin:4px 0; font-size:14px; }
    .footer { padding:20px 40px; background:#f8fafc; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 JobSphere</h1>
      <p>Your AI-Powered Career Platform</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} JobSphere. All rights reserved.</p>
      <p>This email was sent automatically. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

/**
 * Send a generic email
 */
// Reusable helper to get the primary client URL (handles commas if multiple)
const getClientURL = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();

const sendEmail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    console.log('\n' + '='.repeat(50));
    console.log(`📬 [EMAIL] SKIP - Not configured in .env`);
    console.log(`To: ${to} | Sub: ${subject}`);
    console.log('-'.repeat(50));
    console.log('To fix this, provide EMAIL_USER and EMAIL_PASS in backend/.env');
    console.log('='.repeat(50) + '\n');
    return { skipped: true };
  }
  try {
    const info = await transporter.sendMail({
      from: `"JobSphere" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || '',
      html
    });
    console.log(`[Email] Sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    // Don't throw — email errors shouldn't crash the main flow
    return { error: err.message };
  }
};

/**
 * Welcome email after registration
 */
const sendWelcomeEmail = (user) => sendEmail({
  to: user.email,
  subject: '🎉 Welcome to JobSphere!',
  html: baseTemplate(`
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Welcome to <strong>JobSphere</strong>! We're excited to have you on board.</p>
        ${user.role === 'jobseeker'
      ? `<p>Start exploring thousands of jobs tailored for you, save your favourites, and let our AI assistant guide your career journey.</p>`
      : `<p>You can now post jobs, review applications, and find the perfect candidates for your team.</p>`
    }
        <p style="text-align:center;margin-top:24px;">
          <a class="btn" href="${getClientURL()}/dashboard">Go to Dashboard</a>
        </p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br/>The JobSphere Team</p>
    `)
});

/**
 * Password reset email
 */
const sendPasswordResetEmail = (user, resetToken) => {
  const resetUrl = `${getClientURL()}/reset-password/${resetToken}`;
  return sendEmail({
    to: user.email,
    subject: '🔑 Reset Your JobSphere Password',
    html: baseTemplate(`
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to set a new password.</p>
            <p style="text-align:center;margin:24px 0;">
              <a class="btn" href="${resetUrl}">Reset Password</a>
            </p>
            <div class="info-box">
              <p>⏰ This link expires in <strong>15 minutes</strong>.</p>
              <p>🔒 If you didn't request this, you can safely ignore this email.</p>
            </div>
            <p>Or copy and paste this URL into your browser:</p>
            <p style="word-break:break-all;font-size:13px;color:#6366f1;">${resetUrl}</p>
        `)
  });
};

/**
 * Application status update email to applicant
 */
const sendApplicationStatusEmail = (applicant, job, company, status) => {
  const statusMessages = {
    reviewing: { emoji: '🔍', text: 'Your application is being reviewed', detail: 'Our team is carefully reviewing your profile.' },
    shortlisted: { emoji: '⭐', text: 'You\'ve been shortlisted!', detail: 'Great news! You\'ve been shortlisted for the next round.' },
    interview: { emoji: '🎯', text: 'Interview Scheduled!', detail: 'Congratulations! You\'ve been selected for an interview.' },
    offered: { emoji: '🎉', text: 'Job Offer Extended!', detail: 'Congratulations! You\'ve received a job offer.' },
    rejected: { emoji: '📋', text: 'Application Update', detail: 'Thank you for applying. Unfortunately, we\'ve moved forward with other candidates.' },
    withdrawn: { emoji: '↩️', text: 'Application Withdrawn', detail: 'Your application has been successfully withdrawn.' }
  };

  const msg = statusMessages[status] || { emoji: '📬', text: 'Application Update', detail: `Your application status has been updated to: ${status}` };

  return sendEmail({
    to: applicant.email,
    subject: `${msg.emoji} Application Update — ${job.title} at ${company.name}`,
    html: baseTemplate(`
            <p>Hi <strong>${applicant.name}</strong>,</p>
            <p>${msg.detail}</p>
            <div class="info-box">
              <p><strong>Position:</strong> ${job.title}</p>
              <p><strong>Company:</strong> ${company.name}</p>
              <p><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}</p>
            </div>
            <p style="text-align:center;margin-top:24px;">
              <a class="btn" href="${getClientURL()}/applications">View My Applications</a>
            </p>
            <p>Best of luck on your career journey!</p>
            <p>The JobSphere Team</p>
        `)
  });
};

/**
 * Interview scheduled email to applicant — includes date, time, and type
 */
const sendInterviewScheduledEmail = (applicant, job, company, interviewDate, interviewType, notes) => {
  const dateStr = new Date(interviewDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = new Date(interviewDate).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  const typeLabels = {
    phone: '📞 Phone Call',
    video: '🎥 Video Call',
    'in-person': '🏢 In-Person Meeting',
    technical: '💻 Technical Round'
  };
  const typeLabel = typeLabels[interviewType] || interviewType || 'Interview';

  return sendEmail({
    to: applicant.email,
    subject: `🎯 Interview Scheduled — ${job.title} at ${company.name}`,
    html: baseTemplate(`
      <p>Hi <strong>${applicant.name}</strong>,</p>
      <p>Great news! You have been selected for an interview for the <strong>${job.title}</strong> position at <strong>${company.name}</strong>.</p>
      <div class="info-box">
        <p><strong>📋 Position:</strong> ${job.title}</p>
        <p><strong>🏢 Company:</strong> ${company.name}</p>
        <p><strong>📅 Date:</strong> ${dateStr}</p>
        <p><strong>⏰ Time:</strong> ${timeStr}</p>
        <p><strong>🎤 Interview Type:</strong> ${typeLabel}</p>
        ${notes ? `<p><strong>📝 Notes:</strong> ${notes}</p>` : ''}
      </div>
      <p>Please make sure to be prepared and available at the scheduled time. If you have any questions or need to reschedule, contact the employer directly through the platform.</p>
      <p style="text-align:center;margin-top:24px;">
        <a class="btn" href="${getClientURL()}/applications">View My Applications</a>
      </p>
      <p>Best of luck!</p>
      <p>The JobSphere Team</p>
    `)
  });
};

/**
 * New application notification to employer
 */
const sendNewApplicationEmail = (employer, applicant, job) => sendEmail({
  to: employer.email,
  subject: `📥 New Application — ${job.title}`,
  html: baseTemplate(`
        <p>Hi <strong>${employer.name}</strong>,</p>
        <p>You have a new application for the <strong>${job.title}</strong> position.</p>
        <div class="info-box">
          <p><strong>Applicant:</strong> ${applicant.name}</p>
          <p><strong>Email:</strong> ${applicant.email}</p>
          <p><strong>Skills:</strong> ${applicant.skills?.slice(0, 5).join(', ') || 'Not specified'}</p>
        </div>
        <p style="text-align:center;margin-top:24px;">
          <a class="btn" href="${getClientURL()}/my-jobs">Review Application</a>
        </p>
        <p>The JobSphere Team</p>
    `)
});

/**
 * Send OTP email
 */
const sendOTPEmail = (user, otp) => sendEmail({
  to: user.email,
  subject: '🔐 Your JobSphere Password Reset OTP',
  html: baseTemplate(`
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your one-time password (OTP) for resetting your password is:</p>
        <div style="background:#f1f5f9; border:2px dashed #6366f1; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
          <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#6366f1;">${otp}</span>
        </div>
        <div class="info-box">
          <p>⏰ This OTP is valid for <strong>10 minutes</strong>.</p>
          <p>🔒 If you didn't request this, please secure your account.</p>
        </div>
        <p>Best regards,<br/>The JobSphere Team</p>
    `)
});

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOTPEmail,
  sendApplicationStatusEmail,
  sendInterviewScheduledEmail,
  sendNewApplicationEmail
};
