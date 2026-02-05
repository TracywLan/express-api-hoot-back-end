
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
    try {// use find to retrieve all hoots
        const hoot = await Hoot.find({})
            .populate('author')
            .sort({ createdAt: 'desc' });
        res.status(200).json(hoot)
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
})
// GET	show	200	/hoots/:hootId	Get a single hoot
router.get('/:hootId', verifyToken, async (req, res) => {
    try {
        const hoot = await Hoot.findById(req.params.hootId).populate('author');
        res.status(200).json(hoot);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
})
// PUT	update	200	/hoots/:hootId	Update a hoot
router.put('/:hootId', verifyToken, async(req, res) => {
    try {
        // Find the hoot:
        const hoot = await Hoot.findById(req.params.hootId);

        // Check permissions:
        if (!hoot.author.equals(req.user._id)) {
            return res.status(403).send("You're not allowed to do that!")
        }
        

        // Update hoot:
        const updatedHoot = await Hoot.findByIdAndUpdate(
            req.params.hootId,
            req.body,
            { new: true }
        );

        // Append req.user to the author property:
        updatedHoot._doc.author = req.user;

        // Issue JSON response:
        res.status(200).json(updatedHoot);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
})
// DELETE	deleteHoot	200	/hoots/:hootId	Delete a hoot
router.delete('/:hootId', verifyToken, async(req, res) => {
    
})
// POST	createComment	200	/hoots/:hootId/comments	Create a comment


module.exports = router;