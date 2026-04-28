function showDashboard(req, res) {
  return res.render("dashboard", {
    title: "CrmOne Dashboard",
    user: req.currentUser,
  });
}

module.exports = {
  showDashboard,
};
