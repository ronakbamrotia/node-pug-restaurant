const passport = require("passport");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const promisify = require("es6-promisify");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "Failed Login!",
  successRedirect: "/",
  successFlash: "Your are now logged in!"
});

exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "You are now logged out!");
  res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    next(); /// user logged in
    return;
  }
  req.flash("error", "Oops you must be logged in");
  res.redirect("/login");
};

exports.forgot = async (req, res) => {
  // 1. verify user
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "No account with that email exists");
    return res.redirect("/login");
  }

  // 2. set reset tokens and expiry
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save();

  // 3. send token to email
  const resetURL = `http://${req.headers.host}/account/reset/${
    user.resetPasswordToken
  }`;

  console.log(resetURL);

  await mail.send({
    user,
    subject: "Password Reset",
    resetURL,
    filename: "password-reset"
  });

  req.flash("success", `You have been emailed a password reset link.`);

  // 4. redirect to login page
  res.redirect("/login");
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }

  res.render("reset", { title: "Reset your password" });
};

exports.confirmPasswords = (req, res, next) => {
  if (req.body.password === req.body["confirm-password"]) {
    next();
    return;
  }
  req.flash("error", "Passwords do not match");
  res.redirect("back");
};

exports.update = async (req, res) => {
  console.log(req.body);
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }

  user.setPassword = promisify(user.setPassword, user);
  await user.setPassword(req.body.password);
  user.resetPasswordExpires = undefined;
  user.resetPasswordToken = undefined;
  const updateUser = await user.save();
  await req.login(updateUser);
  req.flash("success", "Your password has been reset");
  res.redirect("/");
};
