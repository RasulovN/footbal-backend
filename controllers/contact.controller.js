const nodemailer = require('nodemailer');
const pool = require('../lib/db');
const Joi = require('joi');

// Email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: false,
  auth: {
    user: 'nurbekrasulov71@gmail.com',
    pass: 'xtys vjsu jwfc ipxt',
  },
});

// Validation schema
const contactSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  message: Joi.string().min(10).max(1000).required(),
  captcha: Joi.string().required(), // In production, verify with reCAPTCHA API
});

// Submit contact form
const submitContact = async (req, res) => {
  try {
    const { error, value } = contactSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, email, message, captcha } = value;

    // In production, verify captcha with Google reCAPTCHA
    // For now, just check if it's not empty
    if (!captcha) {
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }

    // Save to database
    const insertQuery = 'INSERT INTO contact_messages (name, email, message, captcha) VALUES ($1, $2, $3, $4) RETURNING id';
    const insertResult = await pool.query(insertQuery, [name, email, message, captcha]);
    const contactMessage = insertResult.rows[0];

    // Send email notification to admin
    const adminEmailHtml = `
      <h2>New Contact Message</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p>This message was sent from the contact form.</p>
    `;

    await transporter.sendMail({
      from: 'noreply@legioners.uz',
      to: 'admin@legioners.uz',
      subject: 'New Contact Message from Football News Website',
      html: adminEmailHtml,
    });

    res.status(201).json({
      message: 'Message sent successfully',
      id: contactMessage.id,
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all contact messages (admin only)
const getContacts = async (req, res) => {
  try {
    const query = 'SELECT * FROM contact_messages ORDER BY "createdAt" DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  submitContact,
  getContacts,
};
