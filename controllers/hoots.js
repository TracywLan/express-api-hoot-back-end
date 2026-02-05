
const express = require("express");
const verifyToken = require("../middleware/verify-token.js");
const Hoot = require("../models/hoot.js");
const router = express.Router();

const VALID_CATEGORIES = ['News', 'Sports', 'Games', 'Movies', 'Music', 'Television'];


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
        if(!hoot) {
            res.status(404).json( {err:'We cannot find this hoot, please select another hoot from the list.' })
        }
        res.status(200).json(hoot);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
})


// PUT	update	200	/hoots/:hootId	Update a hoot
router.put('/:hootId', verifyToken, async(req, res) => {
    try {
        const hoot = await Hoot.findById(req.params.hootId);

        // 1. SAFETY CHECK: Check if Hoot exists BEFORE checking author
        if (!hoot) {
            return res.status(404).json({ err: 'Hoot not found' });
        }

        // 2. Check permissions:
        if (!hoot.author.equals(req.user._id)) {
            return res.status(403).json({ err: "You're not allowed to do that!" });
        }

        // 3. Category Validation (Safe version)
        // We check 'if (req.body.category)' so we don't block updates that don't change the category
        if (req.body.category && !VALID_CATEGORIES.includes(req.body.category)) {
            return res.status(400).json({ err: 'Invalid category selected.' });
        }

        // 4. Text/Title Validation (Crash-proof version)
        // We use optional chaining (?.) so it doesn't crash if text/title are missing
        if (req.body.text?.trim() === "" || req.body.title?.trim() === "") {
            return res.status(400).json({ err: 'Title and text cannot be empty.' });
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
});


// DELETE	deleteHoot	200	/hoots/:hootId	Delete a hoot
router.delete('/:hootId', verifyToken, async(req, res) => {
    try {
        const hoot = await Hoot.findById(req.params.hootId);

        if(!hoot.author.equals(req.user._id)) {
            return res.status(403).json('You are not allowed to do that!');
        }

        const deleteHoot = await Hoot.findByIdAndDelete(req.params.hootId);
        res.status(200).json(deleteHoot) 
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
})

// POST	createComment	200	/hoots/:hootId/comments	Create a comment
router.post('/:hootId/comments', verifyToken, async(req, res) => {
    try {
        req.body.author = req.user._id;
        const hoot = await Hoot.findById(req.params.hootId);

        // 1. SAFETY CHECK: Ensure the hoot actually exists
        if (!hoot) {
            return res.status(404).json({ err: 'Hoot not found' });
        }
        // 2. Push the comment
        hoot.comments.push(req.body);
        // 3. Save the parent document
        await hoot.save();

        // 4. Grab the new comment safely
        // Since we just pushed it, it is the last item in the array
        const newComment = hoot.comments[hoot.comments.length - 1]
        
        // 5. Append the user object to the response (using your _doc pattern)
        newComment._doc.author = req.user;

        // Respond with the newComment:
        res.status(201).json(newComment);
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
})

module.exports = router;