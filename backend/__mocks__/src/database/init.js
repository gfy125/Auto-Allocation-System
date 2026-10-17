// backend/__mocks__/src/database/init.js
let users = []; // Simple array to simulate users table

function initializeDatabase() {
  return Promise.resolve();
}

function getDatabase() {
  return {
    get(sql, params, cb) {
      // Compatible with two signatures: get(sql, cb) / get(sql, params, cb)
      if (typeof params === 'function') {
        cb = params;
        params = undefined;
      }

      // 1) SELECT COUNT(*) as count FROM users
      if (/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+users/i.test(sql)) {
        cb && cb(null, { count: users.length });
        return;
      }

      // 2) SELECT * FROM users WHERE Username = ?
      if (/SELECT\s+\*\s+FROM\s+users\s+WHERE\s+Username/i.test(sql)) {
        const username = Array.isArray(params) ? params[0] : params;
        const row = users.find(u => u.Username === username);
        cb && cb(null, row || undefined);
        return;
      }

      // 3) SELECT * FROM users WHERE UserID = ?
      if (/SELECT\s+\*\s+FROM\s+users\s+WHERE\s+UserID/i.test(sql)) {
        const id = Array.isArray(params) ? params[0] : params;
        const row = users.find(u => u.UserID === Number(id));
        cb && cb(null, row || undefined);
        return;
      }

      cb && cb(new Error('Query not supported in mock: ' + sql));
    },

    run(sql, params, cb) {
      // Compatible with run(sql, params, cb) / run(sql, cb)
      if (typeof params === 'function') {
        cb = params;
        params = [];
      }

      // INSERT INTO users (Username, Password, UserType) VALUES (?, ?, ?)
      if (/INSERT\s+INTO\s+users/i.test(sql)) {
        const [Username, Password, UserType] = params;
        const UserID = users.length ? Math.max(...users.map(u => u.UserID)) + 1 : 1;
        users.push({ UserID, Username, Password, UserType });
        cb && cb.call({ lastID: UserID }, null);
        return;
      }

      // UPDATE users SET Password = ? WHERE UserID = ?
      if (/UPDATE\s+users\s+SET\s+Password/i.test(sql)) {
        const [Password, UserID] = params;
        const u = users.find(u => u.UserID === Number(UserID));
        if (!u) {
          cb && cb(new Error('User not found'));
          return;
        }
        u.Password = Password;
        cb && cb.call({}, null);
        return;
      }

      cb && cb(new Error('Mutation not supported in mock: ' + sql));
    }
  };
}

function closeDatabase() { return Promise.resolve(); }
async function runInTransaction(fn) { return fn(getDatabase()); }

// Test helpers: reset and preset data
function __resetMockDb() { users = []; }
function __seedUsers(arr) { users = arr.map(u => ({ ...u })); }

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  runInTransaction,
  __resetMockDb,
  __seedUsers,
};
