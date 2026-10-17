const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { exec } = require('child_process');

// Path to your Python script
const PYTHON_SETUP = path.join(__dirname, '../../../Database/database.py');
// Path to your DB
const dbPath = path.join(__dirname, "..", "..", "..", "student_project.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error connecting:", err.message);
  } else {
    console.log("Connected to SQLite database:", dbPath);
  }
});


// Initialize database tables by calling Python functions
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log('Running Python setup script...');

    exec(`python3 ${PYTHON_SETUP}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error running Python script:', error.message);
        return reject(error);
      }
      if (stderr) {
        console.error('Python stderr:', stderr);
      }
      console.log('Python stdout:', stdout);

      // Check if users exist in database
      db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
        if (err) {
          console.error('Error checking users table:', err.message);
          return reject(err);
        }
        
        if (result.count > 0) {
          console.log(`Found ${result.count} existing user(s) in database`);
        } else {
          console.log('No users found in database. Please add users manually.');
        }
        
        resolve();
      });
    });
  });
}

// Helper function to get database instance
function getDatabase() {
  return db;
}

// Helper function to close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  // Run a function within a SQLite transaction. Commits on success, rolls back on error.
  runInTransaction: async function(callback) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE', async (beginErr) => {
          if (beginErr) return reject(beginErr);
          try {
            const result = await callback(db);
            db.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve(result);
            });
          } catch (err) {
            db.run('ROLLBACK', (rollbackErr) => {
              if (rollbackErr) {
                // Prefer original error but attach rollback error info
                const combined = new Error(`${err.message}; ROLLBACK failed: ${rollbackErr.message}`);
                return reject(combined);
              }
              reject(err);
            });
          }
        });
      });
    });
  }
};
