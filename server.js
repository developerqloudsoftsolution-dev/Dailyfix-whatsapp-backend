require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes/api');
const whatsappService = require('./src/services/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const EXPECTED_API_KEY = process.env.API_KEY || 'local-development-key';
const API_AUTH_ENABLED = process.env.API_AUTH_ENABLED === 'true';
const USING_FALLBACK_KEY = !process.env.API_KEY;

app.use((req, res, next) => {
    if (req.path === '/health') return next();

    if (!API_AUTH_ENABLED) {
        return next();
    }

    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Missing API Key. Send the x-api-key header with your requests.'
        });
    }

    if (apiKey !== EXPECTED_API_KEY) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid API Key. The x-api-key header value does not match the server configured API_KEY.'
        });
    }
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', memory: process.memoryUsage() });
});

// API Routes
app.use('/api', apiRoutes);

// Process safety handlers to prevent server from shutting down on Baileys disconnects/errors
process.on('uncaughtException', (err) => {
    console.error('[WhatsApp API Server] Caught unhandled exception safely:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.warn('[WhatsApp API Server] Caught unhandled promise rejection safely:', reason?.message || reason);
});

// Initialize WhatsApp on startup if there is an existing session
whatsappService.connect().catch((err) => {
    console.warn('[WhatsApp API Server] Initial connection notice:', err.message);
});

// Mask API key for safe logging: show only first 3 and last 3 chars
function maskKey(key) {
    if (!key || key.length <= 6) return '***';
    return key.substring(0, 3) + '...' + key.substring(key.length - 3);
}

// Startup diagnostics
if (!API_AUTH_ENABLED) {
    console.warn('[SECURITY WARNING] ============================================');
    console.warn('[SECURITY WARNING] API AUTHENTICATION IS DISABLED (default, API_AUTH_ENABLED not set to true)');
    console.warn('[SECURITY WARNING] Anyone on the internet can access /api routes without a key!');
    console.warn('[SECURITY WARNING] To re-enable auth: set API_AUTH_ENABLED=true and set API_KEY in Render env vars.');
    console.warn('[SECURITY WARNING] ============================================');
} else if (USING_FALLBACK_KEY) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
        console.warn('[SECURITY WARNING] ============================================');
        console.warn('[SECURITY WARNING] API_KEY environment variable is NOT SET!');
        console.warn('[SECURITY WARNING] Using insecure fallback key: "local-development-key"');
        console.warn('[SECURITY WARNING] Set API_KEY in Render Dashboard -> Environment -> Environment Variables');
        console.warn('[SECURITY WARNING] ============================================');
    } else {
        console.log('[Dev] API_KEY not set, using fallback local-development-key');
    }
} else {
    console.log(`[Config] API_KEY configured: ${maskKey(EXPECTED_API_KEY)} (${EXPECTED_API_KEY.length} chars)`);
}

app.listen(PORT, () => {
    console.log(`WhatsApp API Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (!API_AUTH_ENABLED) {
        console.log('[Auth] API_KEY authentication is OFF — all /api routes are open to everyone.');
    } else if (USING_FALLBACK_KEY) {
        console.log('Reminder: All /api routes require header: x-api-key: local-development-key');
    }
});
