const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { router } = require('./routes');
require('dotenv').config();

const app = express();
const PORT = 5221;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mount Call Routes (/call/request, /call/confirm-receipt, /call/cancel)
app.use('/call', router);

// Legacy/Chat Notification Endpoints
app.post('/send-notification', async (req, res) => {
  try {
    const { receiverId, senderId, cipherText, iv, chatId } = req.body;
    const userDoc = await db.collection('users').doc(receiverId).get();
    const fcmToken = userDoc.data()?.userIdFCMtoken;
    if (!fcmToken) return res.status(404).json({ error: 'Token not found' });

    await admin.messaging().send({
      token: fcmToken,
      data: { type: 'encrypted_chat', senderId, chatId, cipherText, iv },
      android: { priority: 'high' }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send-status-like-notification', async (req, res) => {
  try {
    const { receiverId, senderId, senderName, statusId } = req.body;
    const userDoc = await db.collection('users').doc(receiverId).get();
    const fcmToken = userDoc.data()?.userIdFCMtoken;
    if (!fcmToken) return res.status(200).json({ skipped: true });

    await admin.messaging().send({
      token: fcmToken,
      data: { type: 'status_like', senderId, senderName, statusId },
      android: { priority: 'high' }
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Node.js Notification Server running on http://localhost:${PORT}`);
});