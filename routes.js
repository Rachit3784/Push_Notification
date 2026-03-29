const express = require('express');
const admin = require('firebase-admin');
const { handleUserCallRequest, confirmReceipt } = require('./CallController');

const router = express.Router();

// Call Request Endpoint
router.post('/request', handleUserCallRequest);

// Acknowledgement Endpoint
router.post('/confirm-receipt', confirmReceipt);

module.exports = { router };
