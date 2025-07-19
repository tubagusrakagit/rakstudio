// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  produkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product'},
  nama: String,
  email: String,
  paket: String,
  deskripsi: String,
  fileReferensi: String,
  fileAsli: String,
  jenisLayanan: String,
  status: { type: String, default: 'Baru' },
  tanggal: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
