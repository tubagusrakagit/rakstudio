const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nama: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' }
});

// Hash Password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password.startsWith('$2b$')) return next(); // Sudah di Hash
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);