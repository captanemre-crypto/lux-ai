// LUX_ai Loglama ve Hata Yönetim Modülü
const fs = require('fs');
const path = require('path');

function logMessage(level, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}]: ${message}\n`;
    console.log(logLine.trim());
    
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, 'app.log'), logLine);
}

module.exports = {
    info: (msg) => logMessage('info', msg),
    error: (msg) => logMessage('error', msg),
    warn: (msg) => logMessage('warn', msg)
};