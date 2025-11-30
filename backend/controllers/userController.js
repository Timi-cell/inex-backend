const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Token = require("../models/tokenModel");
const sendEmail = require("../utils/sendEmail");
const Item = require("../models/itemModel");
// const { fileSizeFormatter } = require("../utils/fileUpload");
// const cloudinary = require("cloudinary").v2;

// Generate JWT Token
const generateToken = (_id) => {
  return jwt.sign({ _id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

const isProduction = process.env.NODE_ENV === "production";

// Register User
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, password2 } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please fill in the required fields." });
  }
  if (password !== password2) {
    return res.status(400).json({ message: "Passwords do not match!" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be up to six characters." });
  }
  // Check if User exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Save User to DB
  const user = await User.create({ name, email, password });

  // Generate Token
  const token = generateToken(user._id);

  // Send HTTP-Only Token
  res.cookie("token", token, {
    path: "/",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProduction, // only true on HTTPS
    sameSite: isProduction ? "None" : "lax", // "lax" works on localhost
  });

  // Check if User was saved to the DB
  if (user) {
    const { _id, name, email, photo, phone } = user;
    res.status(201).json({ _id, name, email, photo, phone });
  } else {
    return res.status(400).json({ message: "Invalid User Data" });
  }
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please fill in the required fields." });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User Not Found, Please signup" });
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.status(400).json({ message: "Invalid Password" });
  }
  const token = generateToken(user._id);

  res.cookie("token", token, {
    path: "/",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProduction, // only true on HTTPS
    sameSite: isProduction ? "None" : "lax", // "lax" works on localhost
  });

  if (user && isPasswordCorrect) {
    const { _id, name, email, password, photo, phone } = user;
    res.status(200).json({
      _id,
      name,
      email,
      password,
      photo,
      phone,
    });
  } else {
    return res.status(400).json({ message: "Invalid Email or Password" });
  }
});

// Get Login Status
const loginStatus = asyncHandler(async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json(false);

  // Verify Token
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    return res.json(!!verified);
  } catch {
    return res.json(false);
  }
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
  res.cookie("token", "", {
    path: "/",
    httpOnly: true,
    expires: new Date(0), // expire the cookie right away
    maxAge: 0,
    secure: isProduction, // only true on HTTPS
    sameSite: isProduction ? "None" : "lax", // "lax" works on localhost
  });
  return res.status(200).json({ message: "Successfully Logged Out" });
});

// Get User Data
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(400).json({ message: "User not found." });

  const { _id, name, email, photo, phone, createdAt } = user;
  return res.status(200).json({ _id, name, email, photo, phone, createdAt });
});

// Update User
const updateUser = asyncHandler(async (req, res) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      email: req.body.email,
      name: req.body.name,
      photo: req.file ? req.file.path : req.body.photo,
      phone: req.body.phone,
    },
    { new: true, runValidators: true }
  );

  if (!updatedUser) return res.status(400).json({ message: "User not found." });

  return res.status(200).json(updatedUser);
});

// Change Password
const changePassword = asyncHandler(async (req, res) => {
  const { password, password2 } = req.body;
  if (!password || !password2) {
    return res
      .status(400)
      .json({ message: "Please fill in the required fields!" });
  }

  const user = await User.findById(req.user._id);
  if (!user) return res.status(400).json({ message: "User not found!" });

  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect)
    return res.status(400).json({ message: "Old password is incorrect!" });

  user.password = password2;
  await user.save();

  return res.status(200).json({ message: "Password updated successfully!" });
});

// Forgot Password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Please enter your email" });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }
  // Delete Token if it exists in the DB
  let token = await Token.findOne({ userId: user._id });
  if (token) {
    await token.deleteOne();
  }
  let resetToken = crypto.randomBytes(32).toString("hex") + user._id;
  console.log(resetToken);
  // Hash token before saving to DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Save Token to DB
  await new Token({
    userId: user._id,
    token: hashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * (60 * 1000), // Thirty minutes
  }).save();

  // Construct Reset Url
  const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
  // Reset Email
  const message = `
<h2>Hi ${user.name},</h2>
<p>We received a request to reset your password, kindly ignore if this was not made by you.</p>
<p>Click the url below to reset your password.</p>
<p>The reset link is valid only for 30minutes.</p>




<a href=${resetUrl} clicktracking=off>${resetUrl}</a>

<p>Thank you for choosing InEx...</p>
<h4>Regards, Timi.</h4>
`;

  const subject = "Password Reset Request";
  const send_to = user.email;
  const send_from = process.env.EMAIL_USER;
  try {
    await sendEmail(subject, message, send_to, send_from);
    return res.status(200).json({
      success: true,
      message: "Reset email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Forgot Password Email Error:", error);
    return res
      .status(500)
      .json({ message: "Email not sent, please try again" });
  }
});

// Reset Password
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.params;

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Find Token in the DB
  const userToken = await Token.findOne({
    token: hashedToken,
    expiresAt: {
      // check if the token has not expired
      $gt: Date.now(),
    },
  });

  if (!userToken) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  // Find user
  const user = await User.findById(userToken.userId);
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  // Update Password and save
  user.password = password;

  // Save the user
  await user.save();

  return res
    .status(200)
    .json({ message: "Password reset successful, please login" });
});

// Get User Report
const getUserReport = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(400).json({ message: "User not found, please login or signup" });
  }
  const { subject, message } = req.body;
  const { email } = user;
  const send_from = process.env.EMAIL_USER;
  const send_to = process.env.EMAIL_USER;
  const reply_to = email;
  try {
    await sendEmail(subject, message, send_to, send_from, reply_to);
    res.status(200).json({
      success: true,
      message: "Report Received!, You will get a reply from us soon.",
    });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ message: "Report not sent, please try again" });
  }
});

// Delete User
const deleteUser = asyncHandler(async (req, res) => {
  res.cookie("token", "", {
    path: "/",
    httpOnly: true,
    expires: new Date(0), // expire the cookie right away
    maxAge: 0,
    secure: isProduction, // only true on HTTPS
    sameSite: isProduction ? "None" : "lax", // "lax" works on localhost
  });

  let user = await User.findById(req.user._id);

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Account not found or already deleted",
    });
  }

  // Delete user and their items
  await user.deleteOne();
  await Item.deleteMany({ user: req.user._id });

  return res
    .status(200)
    .json({ success: true, message: "Account deleted successfully!" });
});

module.exports = {
  registerUser,
  loginUser,
  loginStatus,
  logoutUser,
  getUser,
  updateUser,
  changePassword,
  forgotPassword,
  resetPassword,
  getUserReport,
  deleteUser,
};
