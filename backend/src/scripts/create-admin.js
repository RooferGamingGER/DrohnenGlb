
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'dronenglb',
  logging: false
});

// Define User model
const User = sequelize.define('User', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  isAdmin: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  }
});

async function createAdmin() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Verbindung zur Datenbank hergestellt.');

    // Sync the model with the database
    await User.sync();

    rl.question('Admin E-Mail: ', async (email) => {
      rl.question('Admin Passwort (mind. 8 Zeichen): ', async (password) => {
        if (password.length < 8) {
          console.error('Fehler: Passwort muss mindestens 8 Zeichen lang sein.');
          rl.close();
          return;
        }

        try {
          // Check if admin already exists
          const existingAdmin = await User.findOne({ where: { email } });
          if (existingAdmin) {
            console.log(`Benutzer mit E-Mail ${email} existiert bereits.`);
            rl.close();
            return;
          }

          // Hash password
          const hashedPassword = await bcrypt.hash(password, 10);

          // Create admin user
          const admin = await User.create({
            email,
            password: hashedPassword,
            isAdmin: true
          });

          console.log(`Admin-Benutzer wurde erfolgreich erstellt.`);
          console.log(`ID: ${admin.id}`);
          console.log(`E-Mail: ${admin.email}`);

        } catch (error) {
          console.error('Fehler beim Erstellen des Admin-Benutzers:', error);
        } finally {
          rl.close();
          process.exit(0);
        }
      });
    });
  } catch (error) {
    console.error('Fehler bei der Datenbankverbindung:', error);
    rl.close();
    process.exit(1);
  }
}

createAdmin();
