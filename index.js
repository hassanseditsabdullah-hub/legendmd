const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let sock;

async function startLegendMD() {
    const { state, saveCreds } = await useMultiFileAuthState('legend_session');

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browsers: ["Chrome", "Desktop", "Legend-MD"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startLegendMD();
        } else if (connection === 'open') {
            console.log('Legend-MD Online & Connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Command Handler (Aapka Menu System)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const messageType = Object.keys(msg.message)[0];
        let textBody = '';
        if (messageType === 'conversation') textBody = msg.message.conversation;
        else if (messageType === 'extendedTextMessage') textBody = msg.message.extendedTextMessage.text;

        const remoteJid = msg.key.remoteJid;
        const prefix = '.';
        if (!textBody.startsWith(prefix)) return;

        const args = textBody.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'menu' || command === 'help') {
            const menuText = `
┌─────────────────────────┐
│   💀 *L E G E N D - M D* 💀    │
└─────────────────────────┘
*ACCESS LEVEL:* ROOT / ADMIN
*CODENAME:* CYBER-BOT v1.0
*OWNER:* Legend Hassan

⚡ *SYSTEM COMMANDS:*
┌  
├ 🛠️ \`.menu\` - System Commands List
├ 🏓 \`.ping\` - Check Server Latency
├ 🛡️ \`.status\` - Security Status
└ 💀 \`.owner\` - Contact Root Creator
═════════════════════════
📢 *WHATSAPP CHANNEL:*
https://whatsapp.com/channel/0029Vb7VcqlBlHpdhAL7f80S
*(JID: 120363407511472969@newsletter)*

🤖 *Powered by Legend Hassan*`.trim();
            await sock.sendMessage(remoteJid, { text: menuText });
        } else if (command === 'ping') {
            await sock.sendMessage(remoteJid, { text: '⚡ *SYSTEM SPEED:* 0.00ms (Hyper-Fast Matrix)\n\n🤖 *Powered by Legend Hassan*' });
        } else if (command === 'owner') {
            await sock.sendMessage(remoteJid, { text: '💀 *ROOT USER:* Legend Hassan\n\n📢 *Channel:* https://whatsapp.com/channel/0029Vb7VcqlBlHpdhAL7f80S' });
        }
    });
}

// Fixed Web API Route for Pairing Code without 502 Error
app.get('/pair', async (req, res) => {
    let phoneNumber = req.query.phone;
    if (!phoneNumber) return res.json({ error: "Number missing!" });
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    try {
        if (!sock) {
            await startLegendMD();
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (!sock.authState.creds.registered) {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            return res.json({ code: code });
        } else {
            return res.json({ error: "Bot is already paired and connected!" });
        }
    } catch (err) {
        console.log("Pairing Error:", err);
        return res.json({ error: "Failed to generate code. Try again in 10 seconds." });
    }
});

app.listen(PORT, () => {
    console.log(`Legend-MD Web Server running on port ${PORT}`);
    startLegendMD();
});
