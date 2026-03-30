/* 
   ==========================================================================
   NODE.JS BACKEND: CALL HANDLER (controllers/callController.js)
   ==========================================================================
*/

const admin = require('firebase-admin');

// In-memory object to track 10s Acknowledgement timers
const pendingCalls = {};

/**
 * 1. Process Call Request
 */
const handleUserCallRequest = async (req, res) => {
  const { callId, senderId, senderName, receiverId, timestamp } = req.body;

  try {
    const [asReceiver, asCaller] = await Promise.all([
      admin.firestore().collection('calls')
        .where('receiverId', '==', receiverId)
        .where('status', 'in', ['initiating', 'ringing', 'accepted'])
        .get(),
      admin.firestore().collection('calls')
        .where('callerId', '==', receiverId)
        .where('status', 'in', ['initiating', 'ringing', 'accepted'])
        .get()
    ]);

    const now = Date.now();
    const isRecent = (doc) => (now - (doc.data().initiationTimestamp || 0)) < 120000;

    const trulyBusy =
      asReceiver.docs.some(doc => doc.id !== callId && isRecent(doc)) ||
      asCaller.docs.some(doc => doc.id !== callId && isRecent(doc));

    if (trulyBusy) {
      // console.log(`[CallRequest] Blocked: User ${receiverId} is occupied.`);
      return res.status(200).json({ status: 'busy', message: 'User is on another call' });
    }

    const userDoc = await admin.firestore().collection('users').doc(receiverId).get();
    const receiverFcmToken = userDoc.data()?.userIdFCMtoken;

    if (!receiverFcmToken) {
      // console.log(`[CallRequest] Blocked: User ${receiverId} has no FCM token.`);
      return res.status(200).json({ status: 'offline', message: 'User token missing' });
    }

    const message = {
      data: {
        type: 'INCOMING_CALL',
        callId: callId,
        callerName: senderName || 'User',
        initiationTimestamp: (timestamp || Date.now()).toString(),
      },
      token: receiverFcmToken,
      android: { priority: 'high', ttl: 10000 }
    };

    await admin.messaging().send(message);
    // console.log(`[CallRequest] Signaling sent for ${callId}.`);

    pendingCalls[callId] = false;
    setTimeout(async () => {
      if (pendingCalls[callId] === false) {
        // console.log(`[CallRequest] Gatekeeper: Call ${callId} timed out.`);
        await admin.firestore().collection('calls').doc(callId).update({ status: 'user_unavailable' });
        delete pendingCalls[callId];
      }
    }, 10000);

    return res.status(200).json({ status: 'sent', message: 'Notification triggered' });

  } catch (error) {
    console.error("[CallRequest] FCM Controller Error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * 2. Acknowledgement (Confirm Receipt)
 */
const confirmReceipt = async (req, res) => {
  try {
    const { callId } = req.body;
    if (pendingCalls[callId] !== undefined) {
      pendingCalls[callId] = true; 
      await admin.firestore().collection('calls').doc(callId).update({ status: 'ringing' });
      // console.log(`[CallAck] Call ${callId} acknowledged.`);
      return res.status(200).json({ success: true });
    } else {
      // If session is gone, it's likely already cancelled/ended. No need to error.
      return res.status(200).json({ success: true, message: 'Session handled' });
    }
  } catch (error) {
    console.error("[CallAck] Error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * 3. Handle Call Cancellation
 */
const handleCallCancel = async (req, res) => {
  const { callId, receiverId } = req.body;
  try {
    const userDoc = await admin.firestore().collection('users').doc(receiverId).get();
    const token = userDoc.data()?.userIdFCMtoken;

    if (token) {
      const message = {
        data: { type: 'CALL_CANCELLED', callId: callId },
        token: token,
        android: { priority: 'high' }
      };
      await admin.messaging().send(message);
      // console.log(`[CallCancel] Signal sent for ${callId} to ${receiverId}`);
    }
    
    delete pendingCalls[callId];
    res.status(200).json({ success: true });

  } catch (error) {
    console.error("[CallCancel] Error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { handleUserCallRequest, confirmReceipt, handleCallCancel };
