const express = require('express');
const { handleUserCallRequest, confirmReceipt, handleCallCancel } = require('./CallController');

const router = express.Router();

// Call Request Endpoint
router.post('/request', handleUserCallRequest);

// Acknowledgement Endpoint
router.post('/confirm-receipt', confirmReceipt);

// Cancellation Signal Endpoint
router.post('/cancel', handleCallCancel);

module.exports = { router };
