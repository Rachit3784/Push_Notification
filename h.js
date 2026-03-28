// here calling is not happening properly not the state management not the database management not any thing properly handling 

// this is call notification function of nodejs 


// app.post('/send-call-notification', async (req, res) => {
//   const {
//     receiverUid,      // UID of the person being called
//     callerUid,        // UID of the caller
//     callerName,       // Display name of the caller
//     callerPhoto,      // Profile photo URL (nullable)
//     callId,           // Firestore call document ID  (uid1_uid2 sorted)
//     callType,         // 'video' | 'audio'
//     notificationType, // 'incoming_call' | 'call_cancelled' | 'call_missed'
//     type,             // Always 'call' (for routing in the app)
//   } = req.body;
//   // ── Validate ────────────────────────────────────────────────────────────
//   if (!receiverUid || !callerUid || !callerName || !callId) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }
//   try {
//     // ── 1. Get receiver's FCM token from Firestore ───────────────────────
//     const userDoc = await admin.firestore()
//       .collection('users')
//       .doc(receiverUid)
//       .get();
//     const fcmToken = userDoc.data()?.userIdFCMtoken;
//     if (!fcmToken) {
//       // Receiver has no FCM token (offline or hasn't granted permission)
//       // The IncomingCallOverlay will handle this via Firestore real-time listener
//       console.log(`[CallNotif] No FCM token for receiver ${receiverUid} — Firestore overlay will handle.`);
//       return res.status(200).json({ status: 'no_token', message: 'Receiver has no FCM token' });
//     }
//     // ── 2. Build notification payload ────────────────────────────────────
//     const isIncoming = notificationType === 'incoming_call';
//     const isCancelled = notificationType === 'call_cancelled';
//     const title = isIncoming
//       ? (callType === 'video' ? '📹 Incoming Video Call' : '🎤 Incoming Voice Call')
//       : isCancelled
//         ? `${callerName} cancelled the call`
//         : 'Missed Call';
//     const body = isIncoming
//       ? `${callerName} is calling you...`
//       : isCancelled
//         ? 'The call was cancelled'
//         : `Missed ${callType === 'video' ? 'video' : 'voice'} call from ${callerName}`;
//     // ── 3. Send FCM message ───────────────────────────────────────────────
//     const message = {
//       token: fcmToken,
//       // Data payload (always delivered, even when app is killed)
//       data: {
//         type: 'call',
//         notificationType: notificationType || 'incoming_call',
//         callId: callId,
//         callType: callType || 'audio',
//         callerId: callerUid,
//         receiverId: receiverUid,
//         callerName: callerName,
//         callerPhoto: callerPhoto || '',
//         // These match what NotificationService.handleCallNotification() expects:
//         senderId: callerUid,
//         receiverUid: receiverUid,
//         senderName: callerName,
//       },
//       // Android-specific config
//       android: {
//         priority: 'high',         // Required for heads-up / lock screen display
//         ttl: 30 * 1000,           // 30 seconds — call expires quickly
//         notification: isIncoming ? {
//           title: title,
//           body: body,
//           channelId: 'video_calls_v3',   // Must match createDefaultChannels() in NotificationService
//           sound: 'default',
//           // Full-screen intent (shows even on lock screen)
//           // Notifee handles this from the data payload on the app side
//         } : {
//           title: title,
//           body: body,
//           channelId: 'video_calls_v3',
//         },
//       },
//       // APNS (iOS) config
//       apns: {
//         headers: {
//           'apns-priority': '10',
//           'apns-push-type': 'alert',
//         },
//         payload: {
//           aps: {
//             alert: { title, body },
//             sound: 'default',
//             badge: 1,
//             'interruption-level': 'time-sensitive',  // iOS 15+ — bypass Focus modes
//           },
//         },
//       },
//     };
//     await admin.messaging().send(message);
//     console.log(`[CallNotif] ✅ Notification sent to ${receiverUid} — type: ${notificationType}, callType: ${callType}`);
//     return res.status(200).json({ status: 'sent', callId });
//   } catch (error) {
//     console.error('[CallNotif] ❌ Error sending call notification:', error);
//     return res.status(500).json({ error: 'Failed to send call notification', details: error.message });
//   }
// });


// @beautifulMention @beautifulMention @beautifulMention 