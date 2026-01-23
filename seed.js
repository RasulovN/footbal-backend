const pool = require('./lib/db');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  console.log('Seeding database...');

  // Create default admin user
  const adminEmail = 'nurbekrasulov711@gmail.com';
  const adminPassword = 'legioners123';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Check if admin user exists
  const userQuery = 'SELECT id FROM users WHERE email = $1';
  const userResult = await pool.query(userQuery, [adminEmail]);

  if (userResult.rows.length === 0) {
    // Generate a simple ID for seeding
    const id = 'admin-' + Date.now();
    const insertUser = 'INSERT INTO users (id, email, password, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())';
    await pool.query(insertUser, [id, adminEmail, hashedPassword]);
    console.log('Default admin user created');
  } else {
    console.log('Admin user already exists');
  }

  // Create default categories
  const categories = [
    { nameUz: 'Legionerlar', nameRu: 'Легионеры', slug: 'legionnaires' },
    { nameUz: "O'zPFL", nameRu: 'УзПФЛ', slug: 'uzpfl' },
    { nameUz: 'Transferlar', nameRu: 'Трансферы', slug: 'transfers' },
    { nameUz: 'Intervyular', nameRu: 'Интервью', slug: 'interviews' },
  ];

  for (const category of categories) {
    const catQuery = 'SELECT id FROM categories WHERE slug = $1';
    const catResult = await pool.query(catQuery, [category.slug]);

    if (catResult.rows.length === 0) {
      const id = category.slug + '-' + Date.now();
      const insertCat = 'INSERT INTO categories (id, "nameUz", "nameRu", slug, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())';
      await pool.query(insertCat, [id, category.nameUz, category.nameRu, category.slug]);
      console.log(`Category ${category.slug} created`);
    }
  }

  console.log('Seeding completed');
}

async function main() {
  try {
    await seedDatabase();
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export the seed function for use in index.js
module.exports = seedDatabase;

// Run main if this file is executed directly
if (require.main === module) {
  main();
}






// dsss

// const pool = require('./lib/db');
// const bcrypt = require('bcryptjs');

// async function createTablesIfNotExist() {
//   await pool.query(`
//     CREATE TABLE IF NOT EXISTS users (
//       id VARCHAR(255) PRIMARY KEY,
//       email VARCHAR(255) UNIQUE NOT NULL,
//       password VARCHAR(255) NOT NULL,
//       "createdAt" TIMESTAMP DEFAULT NOW(),
//       "updatedAt" TIMESTAMP DEFAULT NOW()
//     );
//   `);

//   await pool.query(`
//     CREATE TABLE IF NOT EXISTS categories (
//       id VARCHAR(255) PRIMARY KEY,
//       "nameUz" VARCHAR(255) NOT NULL,
//       "nameRu" VARCHAR(255) NOT NULL,
//       slug VARCHAR(255) UNIQUE NOT NULL,
//       "createdAt" TIMESTAMP DEFAULT NOW(),
//       "updatedAt" TIMESTAMP DEFAULT NOW()
//     );
//   `);
// }

// async function seedDatabase() {
//   console.log('🌱 Seeding database...');

//   // 🔑 ENG MUHIM QATOR
//   await createTablesIfNotExist();

//   const adminEmail = 'nurbekrasulov711@gmail.com';
//   const adminPassword = 'legioners123';
//   const hashedPassword = await bcrypt.hash(adminPassword, 10);

//   const userResult = await pool.query(
//     'SELECT id FROM users WHERE email = $1',
//     [adminEmail]
//   );

//   if (userResult.rows.length === 0) {
//     await pool.query(
//       `INSERT INTO users (id, email, password, "createdAt", "updatedAt")
//        VALUES ($1, $2, $3, NOW(), NOW())`,
//       ['admin-' + Date.now(), adminEmail, hashedPassword]
//     );
//     console.log('✅ Admin user created');
//   } else {
//     console.log('ℹ️ Admin user already exists');
//   }

//   console.log('✅ Seeding completed');
// }

// module.exports = seedDatabase;
