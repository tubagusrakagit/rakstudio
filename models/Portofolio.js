const mongoose = require('mongoose');

const portofolioSchema = new mongoose.Schema({
  judul: String,
  deskripsi: String,
  gambar: String,
  tanggal: { 
    type: Date, 
    default: Date.now 
}
});

module.exports = mongoose.model('Portofolio', portofolioSchema);