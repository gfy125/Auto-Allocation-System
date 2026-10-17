const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { validateSchema, loginSchema } = require('../validation/schemas');
const { getDatabase, runAsync, getAsync, allAsync } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// POST /api/auth - User login
router.post('/', validateSchema(loginSchema), async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`Login attempt for user: ${username}`);

        const db = getDatabase();

    // First check if there are any users in the database
    db.get('SELECT COUNT(*) as count FROM users', (err, countResult) => {
        if (err) {
            console.error('DB error checking user count:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
            });
        }

        // If no users in database, return special error code
        if (countResult.count === 0) {
            return res.status(404).json({
                success: false,
                message: 'No users found in database',
                error: { 
                    message: 'Database is empty', 
                    code: 'NO_USERS_FOUND', 
                    details: 'Please create an account first' 
                }
            });
        }

        // Continue with normal login flow
        const sql = `SELECT * FROM users WHERE Username = ?`;
        db.get(sql, [username], (err, user) => {
            if (err) {
                console.error('DB error:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
                });
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials',
                    error: { message: 'Invalid username or password', code: 'INVALID_CREDENTIALS', details: 'The provided username or password is incorrect' }
                });
            }

            // Check password - handle both hashed (production) and plain (test/mock) passwords
            const isPasswordValid = user.Password.startsWith('$2') && user.Password.length > 50
                ? bcrypt.compareSync(password, user.Password)  // bcrypt hash
                : user.Password === password;  // plain password (for tests)

            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials',
                    error: { message: 'Invalid username or password', code: 'INVALID_CREDENTIALS', details: 'The provided username or password is incorrect' }
                });
            }

            const token = `token_${user.UserID}_${Date.now()}`;
            const expiresAt = new Date(Date.now() + 24*60*60*1000).toISOString();

            console.log('✅ Login successful for user:', username);
            console.log('✅ Token generated:', token);
            console.log('✅ User role:', user.UserType);

            res.json({
                success: true,
                message: 'Login successful',
                user: { id: user.UserID, username: user.Username, role: user.UserType === 1 ? 'admin' : 'student', displayName: user.Username },
                token,
                expiresAt
            });
        });
    });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: { message: error.message, code: 'INTERNAL_ERROR', details: error.message } });
    }
});

// GET /api/auth/validate
router.get('/validate', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Invalid or missing token' });
        }

        const token = authHeader.substring(7);
        if (!token.startsWith('token_')) return res.status(401).json({ success: false, message: 'Invalid token format' });

        const tokenParts = token.split('_');
        if (tokenParts.length < 3) return res.status(401).json({ success: false, message: 'Invalid token format' });

        const userId = parseInt(tokenParts[1]);

        const db = getDatabase();

        const sql = `SELECT * FROM users WHERE UserID = ?`;
        db.get(sql, [userId], (err, user) => {
            if (err) return res.status(500).json({ success: false, message: 'Internal server error', error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message } });
            if (!user) return res.status(401).json({ success: false, message: 'User not found for token' });

            res.json({ success: true, user: { id: user.UserID, username: user.Username, role: user.UserType === 1 ? 'admin' : 'student', displayName: user.Username } });
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error during token validation', error: { message: error.message, code: 'INTERNAL_ERROR', details: error.message } });
    }
});

// GET /api/auth/check-registration - check if registration is allowed (first step)
router.get('/check-registration', async (req, res) => {
    try {
        const db = getDatabase();

        // Check if there are any users in the database
        db.get('SELECT COUNT(*) as count FROM users', (err, countResult) => {
            if (err) {
                console.error('DB error checking user count:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
                });
            }

            // If there are already users in the database, registration is not allowed
            if (countResult.count > 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Registration not allowed',
                    error: { 
                        message: 'Users already exist in database', 
                        code: 'REGISTRATION_DISABLED', 
                        details: 'Registration is only allowed when database is empty' 
                    }
                });
            }

            // Database is empty, registration is allowed
            res.json({
                success: true,
                message: 'Registration allowed',
                canRegister: true
            });
        });

    } catch (error) {
        console.error('Check registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error', 
            error: { message: error.message, code: 'INTERNAL_ERROR', details: error.message } 
        });
    }
});

// POST /api/auth/create-user - 创建用户（第二步）
router.post('/create-user', async (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;
        
        // 验证输入
        if (!username || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                error: { message: 'Username, password and confirm password are required', code: 'MISSING_FIELDS' }
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match',
                error: { message: 'Password and confirm password must be the same', code: 'PASSWORD_MISMATCH' }
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username too short',
                error: { message: 'Username must be at least 3 characters long', code: 'USERNAME_TOO_SHORT' }
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password too short',
                error: { message: 'Password must be at least 6 characters long', code: 'PASSWORD_TOO_SHORT' }
            });
        }

        const db = getDatabase();

        // 再次检查数据库中是否有任何用户（双重保险）
        db.get('SELECT COUNT(*) as count FROM users', (err, countResult) => {
            if (err) {
                console.error('DB error checking user count:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
                });
            }

            // 如果数据库中已有用户，不允许注册
            if (countResult.count > 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Registration not allowed',
                    error: { 
                        message: 'Users already exist in database', 
                        code: 'REGISTRATION_DISABLED', 
                        details: 'Registration is only allowed when database is empty' 
                    }
                });
            }

            // 创建新用户（默认为管理员）
            db.run(
                'INSERT INTO users (Username, Password, UserType) VALUES (?, ?, ?)',
                [username, bcrypt.hashSync(password, 10), 1],
                function(err) {
                    if (err) {
                        console.error('DB error creating user:', err.message);
                        return res.status(500).json({
                            success: false,
                            message: 'Internal server error',
                            error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
                        });
                    }

                    console.log('✅ User created successfully:', username);
                    
                    res.json({
                        success: true,
                        message: 'User created successfully. Please refresh the page and login.',
                        user: { 
                            id: this.lastID, 
                            username: username, 
                            role: 'admin', 
                            displayName: username 
                        }
                    });
                }
            );
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error', 
            error: { message: error.message, code: 'INTERNAL_ERROR', details: error.message } 
        });
    }
});

// POST /api/auth/change-password - 修改密码
router.post('/change-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // 验证输入
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                error: { message: 'Current password, new password and confirm password are required', code: 'MISSING_FIELDS' }
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match',
                error: { message: 'New password and confirm password must be the same', code: 'PASSWORD_MISMATCH' }
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password too short',
                error: { message: 'New password must be at least 6 characters long', code: 'PASSWORD_TOO_SHORT' }
            });
        }

        const db = getDatabase();
        const userId = req.user.id;

        // 验证当前密码
        db.get('SELECT * FROM users WHERE UserID = ?', [userId], (err, user) => {
            if (err) {
                console.error('DB error checking current password:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
                });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                    error: { message: 'User not found', code: 'USER_NOT_FOUND' }
                });
            }

            // 验证当前密码 - handle both hashed (production) and plain (test/mock) passwords
            const isPasswordValid = user.Password.startsWith('$2') && user.Password.length > 50
                ? bcrypt.compareSync(currentPassword, user.Password)  // bcrypt hash
                : user.Password === currentPassword;  // plain password (for tests)

            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid current password',
                    error: { message: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD' }
                });
            }

            // 更新密码
            db.run(
                'UPDATE users SET Password = ? WHERE UserID = ?',
                [bcrypt.hashSync(newPassword, 10), userId],
                function(err) {
                    if (err) {
                        console.error('DB error updating password:', err.message);
                        return res.status(500).json({
                            success: false,
                            message: 'Internal server error',
                            error: { message: err.message, code: 'INTERNAL_ERROR', details: err.message }
                        });
                    }

                    console.log('✅ Password updated successfully for user:', user.Username);
                    
                    res.json({
                        success: true,
                        message: 'Password changed successfully. Please login again.'
                    });
                }
            );
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error', 
            error: { message: error.message, code: 'INTERNAL_ERROR', details: error.message } 
        });
    }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    console.log('Logout successful');
    res.json({ success: true, message: 'Logout successful' });
});

module.exports = router;
