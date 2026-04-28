function isAuthenticated(req, res, next) {
  if (!req.session.admin) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/api/login");
  }

  return next();
}

module.exports = {
  isAuthenticated,
};
