const Story = require('../models/Story');

// @desc    Create new story
// @route   POST /api/stories
// @access  Private
exports.createStory = async (req, res, next) => {
    try {
        req.body.user = req.user.id;

        const story = await Story.create(req.body);

        res.status(201).json({
            success: true,
            data: story
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all stories
// @route   GET /api/stories
// @access  Public
exports.getStories = async (req, res, next) => {
    try {
        const stories = await Story.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: stories.length,
            data: stories
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single story by user
// @route   GET /api/stories/my
// @access  Private
exports.getMyStory = async (req, res, next) => {
    try {
        const story = await Story.findOne({ user: req.user.id });

        res.status(200).json({
            success: true,
            data: story
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update story
// @route   PUT /api/stories/:id
// @access  Private
exports.updateStory = async (req, res, next) => {
    try {
        let story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ success: false, message: 'Story not found' });
        }

        // Make sure user is story owner
        if (story.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to update this story' });
        }

        story = await Story.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: story
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete story
// @route   DELETE /api/stories/:id
// @access  Private
exports.deleteStory = async (req, res, next) => {
    try {
        const story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ success: false, message: 'Story not found' });
        }

        // Make sure user is story owner
        if (story.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await story.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Story deleted'
        });
    } catch (err) {
        next(err);
    }
};
