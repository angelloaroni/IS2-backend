const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  return res.json({ mensaje: "API Objetos Perdidos - Campus", code: 200 });
});

module.exports = app;