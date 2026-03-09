/**
 * Calculate delivery fee based on distance between vendor and customer.
 * Uses the Haversine formula to get distance in km.
 * 
 * Pricing:
 *   Base fee:        ₦500  (covers first 3km)
 *   Per km after:   ₦100/km
 *   Max fee:        ₦2500
 *   Min fee:        ₦500
 */

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateDeliveryFee(vendorLat, vendorLng, customerLat, customerLng) {
  const BASE_FEE = 500;
  const BASE_KM = 3;
  const PER_KM = 100;
  const MAX_FEE = 2500;

  const distanceKm = haversineKm(vendorLat, vendorLng, customerLat, customerLng);
  const extraKm = Math.max(0, distanceKm - BASE_KM);
  const fee = Math.round(BASE_FEE + extraKm * PER_KM);

  return Math.min(fee, MAX_FEE);
}

module.exports = { calculateDeliveryFee, haversineKm };