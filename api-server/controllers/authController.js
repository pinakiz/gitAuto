const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../db");

const jwt_secret = process.env.JWT_TOKEN;

exports.signup = async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "EMAIL ALREADY IN USE" });

    const hashed_password = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { first_name, last_name, email, password: hashed_password },
    });

    const token = jwt.sign({ id: user.id }, jwt_secret, { expiresIn: "3h" });
    res.status(200).json({ message: "Success", token });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};

exports.signin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Invalid Credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid Credentials" });

    const token = jwt.sign({ id: user.id }, jwt_secret, { expiresIn: "3h" });
    res.status(200).json({ message: "Success", token });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getToken = (req, res) => {
  res.status(200).json({ token: req.decodedId.id });
};

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.decodedId.id },
      include: { Project: true },
    });
    res.status(200).json({ user });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};
