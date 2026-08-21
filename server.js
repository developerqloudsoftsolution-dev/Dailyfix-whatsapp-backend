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

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}

app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/') return next();

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

// Root endpoint - Live API Welcome & Status
app.get('/', (req, res) => {
    const waStatus = whatsappService.getStatus();
    const serverUptime = formatUptime(process.uptime());
    const isHtml = req.accepts(['html', 'json']) === 'html' && !req.query.format?.includes('json');

    const jsonResponse = {
        success: true,
        message: 'Dailyfix WhatsApp API Server is live and running!',
        status: 'online',
        server: {
            uptime: serverUptime,
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'production',
            timestamp: new Date().toISOString()
        },
        whatsapp: {
            status: waStatus.status,
            phone: waStatus.phone || null,
            name: waStatus.name || null,
            qrAvailable: waStatus.qrAvailable
        },
        endpoints: {
            health: { method: 'GET', path: '/health', description: 'Server health check & memory info' },
            status: { method: 'GET', path: '/api/status', description: 'WhatsApp connection status' },
            qr: { method: 'GET', path: '/api/qr', description: 'WhatsApp QR pairing code' },
            connect: { method: 'POST', path: '/api/connect', description: 'Initiate or reconnect WhatsApp session' },
            logout: { method: 'POST', path: '/api/logout', description: 'Disconnect and clear active session' },
            sendMessage: { method: 'POST', path: '/api/messages/send', description: 'Send text message' },
            sendMedia: { method: 'POST', path: '/api/messages/send-media', description: 'Send image or media file' }
        }
    };

    if (isHtml) {
        const statusColors = {
            connected: '#10b981',
            connecting: '#f59e0b',
            disconnected: '#ef4444'
        };
        const statusBadgeColor = statusColors[waStatus.status] || '#6b7280';

        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dailyfix WhatsApp API - Live Status</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0a0f1d 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
        }
        .container {
            width: 100%;
            max-width: 780px;
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .logo-icon {
            width: 46px;
            height: 46px;
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px rgba(37, 211, 102, 0.35);
        }
        .logo-icon svg {
            width: 26px;
            height: 26px;
            fill: #ffffff;
        }
        .brand h1 {
            font-size: 21px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #ffffff;
        }
        .brand p {
            font-size: 13px;
            color: #94a3b8;
        }
        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
        }
        .pulse-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }
        .card {
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 14px 16px;
        }
        .card-label {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
        }
        .card-value {
            font-size: 15px;
            font-weight: 600;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 12px;
        }
        .endpoints {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
        }
        .endpoint-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 9px 14px;
            transition: all 0.2s ease;
        }
        .endpoint-row:hover {
            background: rgba(30, 41, 59, 0.8);
            border-color: rgba(255, 255, 255, 0.12);
        }
        .endpoint-left {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
        }
        .badge-get {
            background: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
            padding: 2px 7px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 700;
        }
        .badge-post {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
            padding: 2px 7px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 700;
        }
        .endpoint-desc {
            font-size: 12px;
            color: #94a3b8;
        }
        .endpoint-link {
            color: #38bdf8;
            text-decoration: none;
            font-size: 12px;
            font-weight: 500;
        }
        .endpoint-link:hover {
            text-decoration: underline;
        }
        .json-toggle-box {
            background: #090d16;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            overflow: hidden;
        }
        .json-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 12px;
            color: #94a3b8;
        }
        .json-content {
            padding: 12px 14px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #38bdf8;
            overflow-x: auto;
            max-height: 200px;
            line-height: 1.5;
        }
        .footer {
            margin-top: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #64748b;
            padding-top: 14px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .footer a {
            color: #94a3b8;
            text-decoration: none;
        }
        .footer a:hover {
            color: #38bdf8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="brand">
                <div class="logo-icon">
                    <svg viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zM12.05 20.2c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.214 8.214 0 0 1-1.26-4.43c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z"/></svg>
                </div>
                <div>
                    <h1>Dailyfix WhatsApp API</h1>
                    <p>Live Backend Service & Webhook Forwarder</p>
                </div>
            </div>
            <div class="status-pill">
                <span class="pulse-dot"></span>
                <span>API Live & Active</span>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-label">WhatsApp Status</div>
                <div class="card-value">
                    <span class="dot" style="background: ${statusBadgeColor};"></span>
                    <span style="text-transform: capitalize;">${waStatus.status}</span>
                </div>
            </div>
            <div class="card">
                <div class="card-label">Linked Phone</div>
                <div class="card-value">${waStatus.phone ? '+' + waStatus.phone : 'Not linked'}</div>
            </div>
            <div class="card">
                <div class="card-label">Server Uptime</div>
                <div class="card-value">${serverUptime}</div>
            </div>
            <div class="card">
                <div class="card-label">Environment</div>
                <div class="card-value">${process.env.NODE_ENV || 'production'}</div>
            </div>
        </div>

        <div class="section-title">Available Endpoints</div>

        <div class="endpoints">
            <div class="endpoint-row">
                <div class="endpoint-left">
                    <span class="badge-get">GET</span>
                    <span>/health</span>
                </div>
                <span class="endpoint-desc">System health & memory info</span>
                <a class="endpoint-link" href="/health" target="_blank">Open &rarr;</a>
            </div>
            <div class="endpoint-row">
                <div class="endpoint-left">
                    <span class="badge-get">GET</span>
                    <span>/api/status</span>
                </div>
                <span class="endpoint-desc">WhatsApp connection status</span>
                <a class="endpoint-link" href="/api/status" target="_blank">Open &rarr;</a>
            </div>
            <div class="endpoint-row">
                <div class="endpoint-left">
                    <span class="badge-get">GET</span>
                    <span>/api/qr</span>
                </div>
                <span class="endpoint-desc">Live QR code pairing payload</span>
                <a class="endpoint-link" href="/api/qr" target="_blank">Open &rarr;</a>
            </div>
            <div class="endpoint-row">
                <div class="endpoint-left">
                    <span class="badge-post">POST</span>
                    <span>/api/messages/send</span>
                </div>
                <span class="endpoint-desc">Send text message</span>
                <span style="font-size: 11px; color: #64748b;">JSON Body</span>
            </div>
            <div class="endpoint-row">
                <div class="endpoint-left">
                    <span class="badge-post">POST</span>
                    <span>/api/messages/send-media</span>
                </div>
                <span class="endpoint-desc">Send image / attachment</span>
                <span style="font-size: 11px; color: #64748b;">JSON Body</span>
            </div>
        </div>

        <div class="json-toggle-box">
            <div class="json-header">
                <span>Raw JSON Response</span>
                <a href="/?format=json" style="color: #38bdf8; text-decoration: none;">View as JSON</a>
            </div>
            <pre class="json-content"><code>${JSON.stringify(jsonResponse, null, 2)}</code></pre>
        </div>

        <div class="footer">
            <span>Dailyfix WhatsApp Gateway</span>
            <a href="/health">Health Check</a>
        </div>
    </div>
</body>
</html>`);
    }

    return res.json(jsonResponse);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: formatUptime(process.uptime()), memory: process.memoryUsage() });
});

// API Routes
app.use('/api', apiRoutes);

// Fallback 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: {
            root: 'GET /',
            health: 'GET /health',
            status: 'GET /api/status',
            qr: 'GET /api/qr',
            sendMessage: 'POST /api/messages/send',
            sendMedia: 'POST /api/messages/send-media'
        }
    });
});

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
