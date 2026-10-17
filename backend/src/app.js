const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Config path and lightweight YAML parser (must be defined before first use)
const CONFIG_PATH = path.join(__dirname, '../../config.yml');
function parseSimpleYaml(content) {
  const lines = content.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value === '') { obj[key] = ''; continue; }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      obj[key] = Number(value);
    } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      obj[key] = value.toLowerCase() === 'true';
    } else {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }
      obj[key] = value;
    }
  }
  return obj;
}

// Import routes
const groupsRouter = require('./routes/groups');
const projectsRouter = require('./routes/projects');
const authRouter = require('./routes/auth');
const allocationRouter = require('./routes/allocation');

// Import database initialization
const { initializeDatabase } = require('./database/init');

const app = express();
let configBackendPort = 3001;
let configBackendPortSource = 'default';
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = parseSimpleYaml(raw);
    if (typeof cfg.backendPort === 'number' && cfg.backendPort > 0) {
      configBackendPort = cfg.backendPort;
      configBackendPortSource = 'config.yml';
    }
  }
} catch (_) {}
const PORT = process.env.PORT || configBackendPort;
const portSource = process.env.PORT ? 'env PORT' : configBackendPortSource;
console.log(`[Config] Using backend port ${PORT} (source: ${portSource})`);
console.log(`[Config] Config file: ${CONFIG_PATH} ${fs.existsSync(CONFIG_PATH) ? '(exists)' : '(missing)'}`);

// Security middleware
app.use(helmet());

// Load base config (for rate limiting)
let rateLimitMax = 50;
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = parseSimpleYaml(raw);
    if (typeof cfg.rateLimitMax === 'number' && cfg.rateLimitMax > 0) {
      rateLimitMax = cfg.rateLimitMax;
    }
  }
} catch (e) {
  // Fallback to default
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: rateLimitMax, // configurable per config.yml
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  }
});
app.use(limiter);

// CORS configuration - allow all origins for external access
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/groups', groupsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/auth', authRouter);
app.use('/api/allocation', allocationRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.isJoi) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: err.details.reduce((acc, detail) => {
          acc[detail.path.join('.')] = detail.message;
          return acc;
        }, {})
      }
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
      console.log('Press Ctrl+C to stop the server');
    });

    const gracefulShutdown = (signal) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

      server.close((err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        console.log('✅ HTTP server closed');
        console.log('🛑 Server shutdown complete');
        process.exit(0);
      });

      setTimeout(() => {
        console.log('⚠️  Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 关键：测试环境不启动服务器
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
// 新增：导出测试可调用的启动函数
module.exports.__startForTest = startServer;

// 404 handler（保持你原来的逻辑，只是提成具名函数，方便导出）
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'API endpoint not found' }
  });
};
app.use('*', notFoundHandler);

// —— 全局错误处理器改为具名函数 —— //
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err && err.isJoi) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: (err.details || []).reduce((acc, d) => {
          acc[d.path.join('.')] = d.message;
          return acc;
        }, {})
      }
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}
app.use(errorHandler);

// ====== 关键：保持你原来的 startServer 定义和 NODE_ENV 判断不变 ======
// 正常导出 app
module.exports = app;

// ====== 仅测试用的导出：提供函数入口，不影响运行时行为 ======
module.exports.__parseYamlForTest = parseSimpleYaml;
module.exports.__errorHandlerForTest = errorHandler;
module.exports.__makeGraceForTest = function makeGraceForTest(server) {
  // 复刻 app.js 里的关机逻辑，返回一个可调用的 handler
  return function gracefulShutdown(signal) {
    server.close((err) => {
      if (err) {
        process.exit(1);
        return;
      }
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 10000);
  };
};
