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

/**
 * Optimized Chat Notification Endpoint (Universal: Text & Image)
 * Handles encrypted payloads, sender metadata, and image flags.
 */
app.post('/send-notification', async (req, res) => {
  try {
    // Destructure all possible fields from the client app
    const { 
      receiverId, 
      senderId, 
      senderName, 
      senderPhone, 
      cipherText, 
      iv, 
      chatId, 
      msgId, 
      type, 
      isImage, 
      imageUrl 
    } = req.body;

    // 1. Fetch recipient's FCM token from Firestore
    const userDoc = await db.collection('users').doc(receiverId).get();
    const fcmToken = userDoc.data()?.userIdFCMtoken;
    
    if (!fcmToken) {
      console.log(`[Push] Token not found for user: ${receiverId}`);
      return res.status(404).json({ error: 'Token not found' });
    }

    // 2. Build the FCM Data Payload
    // IMPORTANT: All values in the 'data' object must be strings for Firebase FCM
    const messagePayload = {
      token: fcmToken,
      data: {
        type: type || 'encrypted_chat',
        senderId: String(senderId),
        senderName: String(senderName || 'New Message'),
        senderPhone: String(senderPhone || ''),
        chatId: String(chatId),
        msgId: String(msgId || ''),
        cipherText: String(cipherText || ''),
        iv: String(iv || ''),
        isImage: String(isImage || 'false'),
        imageUrl: String(imageUrl || ''),
      },
      android: {
        priority: 'high',
        ttl: 3600 * 1000, // 1 hour TTL
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true, // Wake up iOS app for background processing
          },
        },
      },
    };

    // 3. Send via Firebase Admin SDK
    await admin.messaging().send(messagePayload);
    
    console.log(`[Push] Sent to ${receiverId} from ${senderId} (Type: ${isImage === 'true' ? 'Image' : 'Text'})`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('[Push] Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Status/Life Cycle Notifications
 */
app.post('/send-status-like-notification', async (req, res) => {
  try {
    const { receiverId, senderId, senderName, statusId } = req.body;
    const userDoc = await db.collection('users').doc(receiverId).get();
    const fcmToken = userDoc.data()?.userIdFCMtoken;
    if (!fcmToken) return res.status(200).json({ skipped: true });

    await admin.messaging().send({
      token: fcmToken,
      data: { 
        type: 'status_like', 
        senderId: String(senderId), 
        senderName: String(senderName), 
        statusId: String(statusId) 
      },
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
