/* 
   ==========================================================================
   NODE.JS BACKEND: CALL HANDLER (controllers/callController.js)
   ==========================================================================
*/

const admin = require('firebase-admin');

// In-memory object to track 10s Acknowledgement timers
const pendingCalls = {}; 

/**
 * PHASE 2: Process Call Request
 * - Performs Busy Validation (with 2-minute "Zombie" cleanup logic)
 * - Fetches FCM token
 * - Dispatches High-Priority Data-Only Message
 * - Starts 10-second Gatekeeper Timer
 */
const handleUserCallRequest = async (req, res) => {
  const { callId, senderId, senderName, receiverId, timestamp } = req.body;

  try {
    // 1. ADVANCED BUSY VALIDATION (Zombie Check)
    // Check if the Receiver is involved in any active doc (as either role)
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
    // A document is considered "Zombie" (stale) if it's older than 2 minutes 
    // and hasn't moved to 'ended/cancelled'
    const isRecent = (doc) => (now - (doc.data().initiationTimestamp || 0)) < 120000; 

    const trulyBusy = 
      asReceiver.docs.some(doc => doc.id !== callId && isRecent(doc)) || 
      asCaller.docs.some(doc => doc.id !== callId && isRecent(doc));

    if (trulyBusy) {
      console.log(`Call Blocked: User ${receiverId} is occupied.`);
      return res.status(200).json({ status: 'busy', message: 'User is on another call' });
    }

    // 2. FETCH FCM TOKEN
    const userDoc = await admin.firestore().collection('users').doc(receiverId).get();
    const receiverFcmToken = userDoc.data()?.userIdFCMtoken;

    if (!receiverFcmToken) {
        console.log(`Call Blocked: User ${receiverId} is offline (No token).`);
        return res.status(200).json({ status: 'offline', message: 'No token found' });
    }

    // 3. DATA-ONLY FCM DISPATCH (Phase 2)
    const message = {
      data: {
        type: 'INCOMING_CALL',
        callId: callId,
        callerName: senderName || 'User',
        initiationTimestamp: (timestamp || Date.now()).toString(),
      },
      token: receiverFcmToken,
      android: { 
        priority: 'high',
        ttl: 10000 // 10s TTL for the message delivery
      }
    };

    await admin.messaging().send(message);

    // 4. START 10-SECOND GATEKEEPER TIMER (Phase 2)
    pendingCalls[callId] = false; 

    setTimeout(async () => {
      // If 10s pass without acknowledgement (confirm-receipt hit)
      if (pendingCalls[callId] === false) {
        console.log(`Call ${callId} Gatekeeper: User unavailable (Timeout).`);
        
        await admin.firestore().collection('calls').doc(callId).update({
          status: 'user_unavailable'
        });

        delete pendingCalls[callId];
      }
    }, 10000);

    return res.status(200).json({ status: 'sent', message: 'Notification triggered' });

  } catch (error) {
    console.error("FCM Controller Error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PHASE 2: Acknowledgement (Confirm Receipt)
 * - Receiver hits this endpoint as soon as FCM arrives
 * - Moves Firestore status from 'initiating' to 'ringing'
 * - Clears the 10s gatekeeper timer
 */
const confirmReceipt = async (req, res) => {
  try {
    const { callId } = req.body;
    console.log(`Call ${callId}: Acknowledgement received.`);

    if (pendingCalls[callId] !== undefined) {
      pendingCalls[callId] = true; // Gatekeeper passed
      
      await admin.firestore().collection('calls').doc(callId).update({
        status: 'ringing'
      });
      
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Call session expired' });
    }
  } catch (error) {
    console.error("Acknowledgement Error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { handleUserCallRequest, confirmReceipt };
