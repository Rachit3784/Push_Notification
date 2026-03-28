const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5221; // Match this with your local tunnel/server port

app.use(cors());
app.use(express.json());

// 1. Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 2. The Endpoint (Matches your 'send-notification' path)
app.post('/send-notification', async (req, res) => {
  try {
    const { receiverId, senderId, cipherText, iv, chatId } = req.body;
    console.log('Received notification request:', { receiverId, senderId, chatId , cipherText, iv });
    const userDoc = await db.collection('users').doc(receiverId).get();
    const senderDoc = await db.collection('users').doc(senderId).get();

    if (!userDoc.exists || !senderDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fcmToken = userDoc.data().userIdFCMtoken;
    const senderData = senderDoc.data();

    const payload = {
      token: fcmToken,
      // CRITICAL: We do NOT include a 'notification' object here.
      // If we did, the OS would show the encrypted text immediately.
      // We use 'data' so the app can decrypt it first.
      data: {
        type: 'encrypted_chat',
        senderId: senderId,
        chatId: chatId,
        cipherText: cipherText,
        iv: iv,
        senderPhoto: senderData.photo || '',
        senderPhone: senderData.phoneNumber || senderData.mobileNumber || '',
      },
      android: {
        priority: 'high',
      },
      apns: {
        payload: { aps: { contentAvailable: true } },
      },
    };

    const response = await admin.messaging().send(payload);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.post('/send-status-like-notification', async (req, res) => {
  try {
    const { receiverId, senderId, senderName, statusId } = req.body;
    console.log('Received status like notification request:', { receiverId, senderId, senderName, statusId });
    const userDoc = await db.collection('users').doc(receiverId).get();
    const fcmToken = userDoc.data()?.userIdFCMtoken;
    if (!fcmToken) return res.status(200).json({ skipped: true });

    await admin.messaging().send({
      token: fcmToken,
      data: {
        type: 'status_like',
        senderId, senderName, statusId,
      },
      android: { priority: 'high' },
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





app.post('/send-call-notification', async (req, res) => {
  const {
    receiverUid,      // UID of the person being called
    callerUid,        // UID of the caller
    callerName,       // Display name of the caller
    callerPhoto,      // Profile photo URL (nullable)
    callId,           // Firestore call document ID  (uid1_uid2 sorted)
    callType,         // 'video' | 'audio'
    notificationType, // 'incoming_call' | 'call_cancelled' | 'call_missed'
    type,             // Always 'call' (for routing in the app)
  } = req.body;
  // ── Validate ────────────────────────────────────────────────────────────
  if (!receiverUid || !callerUid || !callerName || !callId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // ── 1. Get receiver's FCM token from Firestore ───────────────────────
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(receiverUid)
      .get();
    const fcmToken = userDoc.data()?.userIdFCMtoken;
    if (!fcmToken) {
      // Receiver has no FCM token (offline or hasn't granted permission)
      // The IncomingCallOverlay will handle this via Firestore real-time listener
      console.log(`[CallNotif] No FCM token for receiver ${receiverUid} — Firestore overlay will handle.`);
      return res.status(200).json({ status: 'no_token', message: 'Receiver has no FCM token' });
    }
    // ── 2. Build notification payload ────────────────────────────────────
    const isIncoming = notificationType === 'incoming_call';
    const isCancelled = notificationType === 'call_cancelled';
    const title = isIncoming
      ? (callType === 'video' ? '📹 Incoming Video Call' : '🎤 Incoming Voice Call')
      : isCancelled
        ? `${callerName} cancelled the call`
        : 'Missed Call';
    const body = isIncoming
      ? `${callerName} is calling you...`
      : isCancelled
        ? 'The call was cancelled'
        : `Missed ${callType === 'video' ? 'video' : 'voice'} call from ${callerName}`;
    // ── 3. Send FCM message ───────────────────────────────────────────────
    const message = {
      token: fcmToken,
      // Data payload (always delivered, even when app is killed)
      data: {
        type: 'call',
        notificationType: notificationType || 'incoming_call',
        callId: callId,
        callType: callType || 'audio',
        callerId: callerUid,
        receiverId: receiverUid,
        callerName: callerName,
        callerPhoto: callerPhoto || '',
        // These match what NotificationService.handleCallNotification() expects:
        senderId: callerUid,
        receiverUid: receiverUid,
        senderName: callerName,
      },
      // Android-specific config: Data-only payload required for Notifee background handler
      android: {
        priority: 'high',
        ttl: 45 * 1000, // 45s TTL
      },
      // APNS (iOS) config: Data-only background fetch
      apns: {
        headers: {
          'apns-priority': '5', // 5 for background push, 10 requires alert
          'apns-push-type': 'background',
        },
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    };
    await admin.messaging().send(message);
    console.log(`[CallNotif] ✅ Notification sent to ${receiverUid} — type: ${notificationType}, callType: ${callType}`);
    return res.status(200).json({ status: 'sent', callId });
  } catch (error) {
    console.error('[CallNotif] ❌ Error sending call notification:', error);
    return res.status(500).json({ error: 'Failed to send call notification', details: error.message });
  }
});



app.listen(PORT, () => {
  console.log(`🚀 Node.js Notification Server running on http://localhost:${PORT}`);
});