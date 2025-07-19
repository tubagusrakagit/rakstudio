// midtrans.js
const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
clientKey: process.env.MIDTRANS_CLIENT_KEY
});

router.post('/bayar-midtrans', async (req, res) => {
  try {
    const orderId = 'ORDER-' + Date.now();
    const amount = 150000; // bisa dinamis tergantung paket

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      customer_details: {
        first_name: req.body.nama,
        email: req.body.email
      }
    };

    const transaction = await snap.createTransaction(parameter);
    res.redirect(transaction.redirect_url); // Redirect ke halaman Snap Midtrans
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memproses pembayaran');
  }
});

module.exports = router;