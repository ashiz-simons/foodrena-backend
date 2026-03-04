const router = require("express").Router();
const protect = require("../middleware/protectRider");
const auth = require("../middleware/auth");
const allow = require("../middleware/allow");

const { getMyWallet } = require("../controllers/riderWalletController");
const {
  requestWithdrawal,
  getMyWithdrawals
} = require("../controllers/riderWithdrawalsController");

const {
  createRider,
  getRiders,
  getRider,
  updateAvailability,
  updateLocation,
  assignRider,
  getMyOrders,
  acceptDelivery,
  rejectDelivery,
  markArrivedPickup,
  startTrip,
  completeDelivery,
  updateRiderStatus,
  getRiderDashboard,
  updateProfileImage
} = require("../controllers/riderController");

// imports
const {
  getMyBank,
  saveMyBank,
} = require("../controllers/riderBankController");

// ...

// ================= BANK DETAILS =================
router.get("/me/bank", protect, getMyBank);
router.post("/me/bank", protect, saveMyBank);

// ================= RIDER =================

router.get("/dashboard", protect, getRiderDashboard);

router.patch("/availability", protect, updateAvailability);
router.patch("/location", protect, updateLocation);

router.get("/me/orders", protect, getMyOrders);

router.post("/order/:orderId/accept", protect, acceptDelivery);
router.post("/order/:orderId/reject", protect, rejectDelivery);
router.post("/order/:orderId/arrived", protect, markArrivedPickup);
router.post("/order/:orderId/start-trip", protect, startTrip);
router.post("/order/:orderId/complete", protect, completeDelivery);
router.patch(
  "/profile-image",
  auth,
  allow("rider"),
  updateProfileImage
);
// ================= WALLET =================

router.get("/me/wallet", protect, getMyWallet);

// ================= WITHDRAWALS =================

router.post("/withdrawals", protect, requestWithdrawal);
router.get("/withdrawals", protect, getMyWithdrawals);

// ================= ADMIN =================

router.get("/", getRiders);
router.get("/:id", getRider);
router.post("/", createRider);
router.post("/assign/:orderId", assignRider);
router.patch("/riders/:id", updateRiderStatus);

module.exports = router;
