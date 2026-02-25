const Earning = require("../models/Earning");
const Wallet = require("../models/Wallet");
const RiderEarning = require("../models/RiderEarning");
const RiderWallet = require("../models/RiderWallet");
const Order = require("../models/Order");

module.exports = async function finalizeOrderSettlement(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return;

  // Prevent double-run
  if (
    order.vendorEarningRecorded &&
    order.riderPaid &&
    order.platformProfitRecorded
  ) {
    return;
  }

  /**
   * =========================
   * VENDOR PAYOUT LOCK
   * =========================
   */
  if (!order.vendorEarningRecorded && order.vendorNetAmount > 0) {
    const earning = await Earning.findOne({ order: order._id });

    if (earning && earning.status === "pending") {
      earning.status = "available";
      await earning.save();

      const wallet = await Wallet.findOne({ vendor: order.vendor });
      if (wallet) {
        wallet.balance += earning.netAmount;
        wallet.pendingBalance -= earning.netAmount;
        await wallet.save();
      }

      order.vendorEarningRecorded = true;
    }
  }

  /**
   * =========================
   * RIDER PAYOUT LOCK
   * =========================
   */
  if (!order.riderPaid && order.riderPayout > 0) {
    const riderEarning = await RiderEarning.findOne({ order: order._id });

    if (riderEarning && riderEarning.status === "pending") {
      riderEarning.status = "available";
      await riderEarning.save();

      const wallet = await RiderWallet.findOne({ rider: order.rider });
      if (wallet) {
        wallet.balance += riderEarning.amount;
        wallet.pendingBalance -= riderEarning.amount;
        await wallet.save();
      }

      order.riderPaid = true;
    }
  }

  /**
   * =========================
   * PLATFORM PROFIT LOCK
   * =========================
   */
  if (!order.platformProfitRecorded) {
    order.platformProfitRecorded = true;
  }

  await order.save();
};
