const SupportTicket = require("../models/SupportTicket");

// ── Customer: create ticket ────────────────────────────────────────────────
exports.createTicket = async (req, res) => {
  try {
    const { orderId, category, subject, description } = req.body;
    if (!category || !subject || !description) {
      return res.status(400).json({ message: "category, subject and description are required" });
    }
    const ticket = await SupportTicket.create({
      customer:    req.user._id,
      orderId:     orderId || null,
      category,
      subject,
      description,
      messages: [{ sender: "customer", text: description }],
    });
    res.status(201).json({ ticket });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Customer: list my tickets ──────────────────────────────────────────────
exports.myTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ customer: req.user._id })
      .sort({ updatedAt: -1 })
      .populate("orderId", "status createdAt total");
    res.json({ tickets });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Customer: get single ticket with messages ──────────────────────────────
exports.getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      customer: req.user._id,
    }).populate("orderId", "status createdAt total");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json({ ticket });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Customer: send a message on existing ticket ────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "text is required" });
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (ticket.status === "closed") {
      return res.status(400).json({ message: "This ticket is closed" });
    }
    ticket.messages.push({ sender: "customer", text });
    if (ticket.status === "resolved") ticket.status = "in_progress";
    await ticket.save();
    res.json({ ticket });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Admin: list all tickets ────────────────────────────────────────────────
exports.adminList = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const tickets = await SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .populate("customer", "name email phone")
      .populate("orderId", "status createdAt total");
    res.json({ tickets });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Admin: reply to ticket ─────────────────────────────────────────────────
exports.adminReply = async (req, res) => {
  try {
    const { text, status } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (text) ticket.messages.push({ sender: "support", text });
    if (status) ticket.status = status;
    await ticket.save();
    res.json({ ticket });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Admin: close ticket ────────────────────────────────────────────────────
exports.adminClose = async (req, res) => {
  try {
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status: "closed" },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json({ ticket });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};