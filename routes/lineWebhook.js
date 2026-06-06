// routes/lineWebhook.js
const express = require("express");
const router = express.Router();

router.post("/webhook", express.json(), (req, res) => {
  const events = req.body.events || [];
  events.forEach((event) => {
    console.log("LINE source:", JSON.stringify(event.source, null, 2));
  });
  res.sendStatus(200);
});

module.exports = router;
