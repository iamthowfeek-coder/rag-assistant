const router = require('express').Router();
const wrap = require('../wrap');
const { requireAuth } = require('../auth');
const { searchPassages } = require('../search');

router.use(requireAuth); // admins and agents can search

router.get('/', wrap(async (req, res) => {
  res.json(await searchPassages(req.query.q, 5));
}));

module.exports = router;
