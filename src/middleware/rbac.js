module.exports = function(allowedRoles = []) {
  return function(req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (allowedRoles.length === 0) return next();
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
};
