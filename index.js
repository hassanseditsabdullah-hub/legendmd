const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Sessions folder check
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Web API Route for Multi-User Pairing Code
app.get('/pair', async (req, res) => {
    let phoneNumber = req.query.phone;
    if (!phoneNumber) return res.json({ error: "Number missing!" });
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    const userSessionPath = path.join(sessionsDir, `session_${phoneNumber}`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(userSessionPath);

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            auth: state,
            browsers: ["Chrome", "Desktop", "Legend-MD"]
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    // Auto reconnect logic for specific user session can go here if needed
                }
            } else if (connection === 'open') {
                console.log(`User ${phoneNumber} Connected Successfully!`);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Agar already registered nahi hai toh pairing code mangwayein
        if (!sock.authState.creds.registered) {
            // Thora wait karein taake socket initialization mukammal ho jaye
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    return res.json({ code: code });
                } catch (e) {
                    console.log("Pairing Code Error:", e);
                    return res.json({ error: "Failed to generate code. Try again." });
                }
            }, 3000);
        } else {
            return res.json({ error: "This number is already registered/connected!" });
        }

    } catch (err) {
        console.log("Server Error:", err);
        return res.json({ error: "Internal server error." });
    }
});

// Global Command Handler for all active bots/sessions
// (Aap chahein toh har session ke andar bhi command handler laga sakte hain)

app.listen(PORT, () => {
    console.log(`Legend-MD Multi-User Server running on port ${PORT}`);
});
