
const express = require("express");
const verifyToken = require("../middleware/verify-token.js");
const Hoot = require("../models/hoot.js");
const router = express.Router();

const VALID_CATEGORIES = ['News', 'Sports', 'Games', 'Movies', 'Music', 'Television'];


// POST	create	200	/hoots	Create a hoot
router.post('/', verifyToken, async(req, res) => {
    try {
        // CHECKS: Is the category in the allowed list?
        // req.body.category is the value sent by the user
        // !VALID_CATEGORIES.includes(...) returns true if the value is NOT in the list
        if (!VALID_CATEGORIES.includes(req.body.category)) {
            // Stops the function and sends a 400 Bad Request error to the client
            return res.status(400).json({ err: 'Invalid category selected.' });
        }

        // CHECKS: Are the title and text empty?
        // req.body.text?.trim() removes whitespace from the text safely
        // The '?' prevents a crash if text or title is missing entirely
        // The '!' checks if the result is empty string "" or null
        if (!req.body.text?.trim() || !req.body.title?.trim()) {
            // Stops the function and sends a 400 Bad Request error
            return res.status(400).json({ err: 'Title and text are required.' });
        }

        // PREPARE DATA: Attaches the logged-in user's ID to the data
        // req.user._id comes from the verifyToken middleware
        // This ensures the database knows who wrote the post
        req.body.author = req.user._id; 
        
        // SAVE: Sends the data to MongoDB to create a new document
        // 'await' pauses execution here until the database is finished
        const hoot = await Hoot.create(req.body); 
        
        // OPTIMIZE: Manually adds the full user details to the response object
        // hoot._doc accesses the raw data object inside the Mongoose result
        // We do this so the frontend can display the username immediately without a second request
        hoot._doc.author = req.user; 
        
        // RESPOND: Sends the created object back to the client
        // status(201) is the standard code for "Created"
        res.status(201).json(hoot);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

// GET	index	200	/hoots	List hoots
router.get('/', verifyToken, async(req, res) => { // must be logged-in to see list of hoots
    try {// use find to retrieve all hoots
        // 1. QUERY: Retrieve all documents from the 'hoots' collection
        // Passing an empty object {} means "match everything" (no filter)
        const hoots = await Hoot.find({})

            // 2. LINK DATA: Replace the 'author' ID with the actual user document
            // This looks up the User ID in the users collection and fills in the details (username, etc.)
            .populate('author')

            // 3. ORDER: Sort the results by creation time
            // 'desc' (descending) means newest items appear first (top of the list)
            .sort({ createdAt: 'desc' });
        res.status(200).json(hoots);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
})

// GET	show	200	/hoots/:hootId	Get a single hoot
router.get('/:hootId', verifyToken, async (req, res) => {
    try {
        const hoot = await Hoot.findById(req.params.hootId).populate(['author', 'comments.author',]);
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
            return res.status(403).json({ err: "You're not allowed to edit this hoot!" });
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
            return res.status(403).json('You are not allowed to delete this hoot!');
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
        // const hoot = await Hoot.findById(req.params.hootId);
        const updatedHoot = await Hoot.findByIdAndUpdate(req.params.hootId,
            { $push: { comments: req.body } }, // 👈 The Magic: Adds req.body to the 'comments' array
            { new: true, runValidators: true } // 👈 Options: Return the new doc & validate data
        );

        // 1. SAFETY CHECK: Ensure the hoot actually exists
        if (!updatedHoot) {
            return res.status(404).json({ err: 'Hoot not found' });
        }

        // // 2. Push the comment
        // hoot.comments.push(req.body);
        // // 3. Save the parent document
        // await hoot.save();

       // 4. Grab the new comment safely
        // Since we used { new: true }, updatedHoot contains the comment we just added
        const newComment = updatedHoot.comments.at(-1);

        newComment._doc.author = req.user;

        res.status(201).json(newComment);
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
})

// PUT Update Comment 200 /hoots/:hootId/comments/:commentId 
router.put('/:hootId/comments/:commentId', verifyToken, async(req, res) => {
    try {
        const hoot = await Hoot.findById(req.params.hootId);
        const comment = await hoot.comments.id(req.params.commentId)

        if(comment.author.toString() !== req.user._id) {
            return res
            .status(403)
            .json({ message: "You are not authorized to edit this comment" });
        }

        comment.text = req.body.text;
        await hoot.save();
        res.status(200).json({ message: "Comment updated successfully" });
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
})

// DELETE /hoots/:hootId/comments/:commentId

router.delete('/:hootId/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const hoot = await Hoot.findById(req.params.hootId);
        const comment = await hoot.comments.id(req.params.commentId);

        if(comment.author.toString() !== req.user._id) {
            return res
            .status(403)
            .json({ message: "You are not authorized to edit this comment" });
        }

        hoot.comments.remove({ _id: req.params.commentId });
        await hoot.save();
        res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
})


module.exports = router;