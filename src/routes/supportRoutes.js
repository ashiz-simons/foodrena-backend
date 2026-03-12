const router      = require("express").Router();
const auth        = require("../middleware/auth");
const protectAdmin= require("../middleware/protectAdmin");
const {
  createTicket, myTickets, getTicket, sendMessage,
  adminList, adminReply, adminClose,
} = require("../controllers/supportController");

// ── Customer ───────────────────────────────────────────────────────────────
router.post  ("/",              auth, createTicket);
router.get   ("/mine",          auth, myTickets);
router.get   ("/:id",           auth, getTicket);
router.post  ("/:id/message",   auth, sendMessage);

// ── Admin ──────────────────────────────────────────────────────────────────
router.get   ("/admin/all",          protectAdmin, adminList);
router.post  ("/admin/:id/reply",    protectAdmin, adminReply);
router.patch ("/admin/:id/close",    protectAdmin, adminClose);

module.exports = router;