
const express = require("express");
const verifyToken = require("../middleware/verify-token.js");
const Hoot = require("../models/hoot.js");
const router = express.Router();

const VALID_CATEGORIES = ['News', 'Sports', 'Games', 'Movies', 'Music', 'Television'];
// HTTP Method	Controller	Response	URI	Use Case
// POST	create	200	/hoots	Create a hoot
router.post('/', verifyToken, async(req, res) => {
    try {

        if (!VALID_CATEGORIES.includes(req.body.category)) {
            return res.status(400).json({ err: 'Invalid category selected.' });
        }

        if(!req.body.text.trim() || !req.body.title.trim()) {
            throw new Error(
                `The body and title field much have valid text`
            )
        }
        req.body.author = req.user._id; //This ensures that the logged-in user is recorded as the author of the hoot
        const hoot = await Hoot.create(req.body) //create a new hoot document
        hoot._doc.author = req.user  //author property in this document will only have the user’s ID
        res.status(201).json(hoot)
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
    
})
// GET	index	200	/hoots	List hoots

router.get('/', verifyToken, async(req, res) => { // must be logged-in to see list of hoots
    // use find to retrieve all hoots
})
// GET	show	200	/hoots/:hootId	Get a single hoot
// PUT	update	200	/hoots/:hootId	Update a hoot
// DELETE	deleteHoot	200	/hoots/:hootId	Delete a hoot
// POST	createComment	200	/hoots/:hootId/comments	Create a comment


module.exports = router;