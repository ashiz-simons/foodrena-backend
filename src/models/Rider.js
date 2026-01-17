const mongoose = require('mongoose');

const RiderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: String,
  phone: String,
  isAvailable: { type: Boolean, default: true },
  lastLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0,0] } // [lon, lat]
  },
  createdAt: { type: Date, default: Date.now }
});
RiderSchema.index({ lastLocation: '2dsphere' });

module.exports = mongoose.model('Rider', RiderSchema);
