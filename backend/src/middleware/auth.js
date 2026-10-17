const { getDatabase } = require('../database/init');

/**
 * 认证中间件 - 验证Bearer token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        // 检查Authorization头是否存在且格式正确
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or missing token',
                error: {
                    message: 'Authorization header missing or invalid',
                    code: 'MISSING_AUTH_HEADER',
                    details: 'Authorization header must be in format: Bearer <token>'
                }
            });
        }

        const token = authHeader.substring(7);
        
        // 检查token格式
        if (!token.startsWith('token_')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or missing token',
                error: {
                    message: 'Invalid token format',
                    code: 'INVALID_TOKEN_FORMAT',
                    details: 'Token must start with "token_"'
                }
            });
        }

        const tokenParts = token.split('_');
        if (tokenParts.length < 3) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or missing token',
                error: {
                    message: 'Invalid token format',
                    code: 'INVALID_TOKEN_FORMAT',
                    details: 'Token must be in format: token_userId_timestamp'
                }
            });
        }

        const userId = parseInt(tokenParts[1]);
        if (isNaN(userId)) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or missing token',
                error: {
                    message: 'Invalid user ID in token',
                    code: 'INVALID_TOKEN_USER_ID',
                    details: 'Token contains invalid user ID'
                }
            });
        }

        // 查询用户信息
        const db = getDatabase();
        const sql = `SELECT * FROM users WHERE UserID = ?`;
        
        db.get(sql, [userId], (err, user) => {
            if (err) {
                console.error('Database error during token validation:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Internal server error',
                    error: { 
                        message: err.message, 
                        code: 'INTERNAL_ERROR', 
                        details: err.message 
                    } 
                });
            }
            
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid or missing token',
                    error: {
                        message: 'User not found for token',
                        code: 'USER_NOT_FOUND',
                        details: 'The user associated with this token no longer exists'
                    }
                });
            }

            // 将用户信息添加到请求对象中
            req.user = {
                id: user.UserID,
                username: user.Username,
                role: user.UserType === 1 ? 'admin' : 'student',
                displayName: user.Username
            };
            
            next();
        });

    } catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error during token validation',
            error: { 
                message: error.message, 
                code: 'INTERNAL_ERROR', 
                details: error.message 
            } 
        });
    }
};

/**
 * 管理员权限中间件 - 确保用户是管理员
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: {
                message: 'User not authenticated',
                code: 'AUTHENTICATION_REQUIRED',
                details: 'Please login first'
            }
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
            error: {
                message: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                details: 'Admin role required for this operation'
            }
        });
    }

    next();
};

module.exports = {
    authenticateToken,
    requireAdmin
};
