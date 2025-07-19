const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  nama: String,
  harga: Number,
  deskripsi: String,
  gambar: String,
  kategori: String,
  fileZip: String,
  tanggal: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);