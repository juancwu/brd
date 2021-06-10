const R = require("express").Router();

R.get("/all", (req, res) => {
  res.send(req.app.get("bookmark").getAll());
});

module.exports = R;
