const nodemailer = require('nodemailer');
const pool = require('../lib/db');
const Joi = require('joi');
const { mapBodyToDb } = require('../lib/utils');

// Email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: false,
  auth: {
    user: 'nurbekrasulov71@gmail.com',
    pass: 'uauq pwdu otsm ajeh',
  },
});

// Validation schema (camelCase for API)
const contactSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  message: Joi.string().min(10).max(1000).required(),
  captcha: Joi.string().required(),
});

// Submit contact form
const submitContact = async (req, res) => {
  try {
    const { error, value } = contactSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, email, message, captcha } = value;

    if (!captcha) {
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }

    // Map to snake_case
    const data = {
      name: name,
      email: email,
      message: message,
      captcha: captcha
    };

    // Generate ID
    const id = 'msg-' + Date.now();

    // Insert (timestamps handled by database)
    const insertQuery = `
      INSERT INTO contact_messages (id, name, email, message, captcha)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const insertResult = await pool.query(insertQuery, [id, data.name, data.email, data.message, data.captcha]);
    const contactMessage = insertResult.rows[0];

    // Send email notification
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
      from: 'nurbekrasulov71@gmail.com',
      to: 'nurbekrasulov71@gmail.com',
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
    const query = 'SELECT * FROM contact_messages ORDER BY created_at DESC';
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
