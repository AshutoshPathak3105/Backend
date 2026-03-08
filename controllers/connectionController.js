const ConnectionRequest = require('../models/ConnectionRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Cancel a sent (pending) connection request
// @route   DELETE /api/connections/request/:id
exports.cancelRequest = async (req, res) => {
    try {
        const recipientId = req.params.id;
        const senderId = req.user._id;

        const request = await ConnectionRequest.findOneAndDelete({
            sender: senderId,
            recipient: recipientId,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({ success: false, message: 'No pending request found' });
        }

        res.json({ success: true, message: 'Request cancelled' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Send a connection request
// @route   POST /api/connections/request/:id
exports.sendRequest = async (req, res) => {
    try {
        const recipientId = req.params.id;
        const senderId = req.user._id;

        if (recipientId === senderId.toString()) {
            return res.status(400).json({ success: false, message: "You cannot connect with yourself" });
        }

        // Check if already connected
        const sender = await User.findById(senderId);
        if (sender.connections.includes(recipientId)) {
            return res.status(400).json({ success: false, message: "Already connected" });
        }

        // Check for existing request
        const existingReq = await ConnectionRequest.findOne({
            $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId }
            ]
        });

        if (existingReq) {
            return res.status(400).json({ success: false, message: "Request already exists or is pending" });
        }

        const newRequest = await ConnectionRequest.create({
            sender: senderId,
            recipient: recipientId
        });

        // Create notification
        await Notification.create({
            recipient: recipientId,
            sender: senderId,
            type: 'connection_req',
            title: 'New Connection Request',
            message: `${req.user.name} wants to connect with you.`,
            link: '/network',
            meta: { requestId: newRequest._id, senderId }
        });

        res.status(201).json({ success: true, request: newRequest });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Respond to a connection request (accept/reject)
// @route   PUT /api/connections/respond/:id
exports.respondToRequest = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const request = await ConnectionRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        if (request.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        request.status = status;
        await request.save();

        if (status === 'accepted') {
            // Add to each other's connections
            await User.findByIdAndUpdate(request.sender, { $addToSet: { connections: request.recipient } });
            await User.findByIdAndUpdate(request.recipient, { $addToSet: { connections: request.sender } });

            // Create notification for sender
            await Notification.create({
                recipient: request.sender,
                sender: request.recipient,
                type: 'connection_accept',
                title: 'Connection Accepted',
                message: `${req.user.name} accepted your connection request.`,
                link: '/network',
                meta: { recipientId: req.user._id }
            });
        }

        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get pending requests for current user
// @route   GET /api/connections/requests
exports.getRequests = async (req, res) => {
    try {
        const requests = await ConnectionRequest.find({
            recipient: req.user._id,
            status: 'pending'
        }).populate('sender', 'name avatar role headline');
        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get all connections of current user
// @route   GET /api/connections
exports.getConnections = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('connections', 'name avatar role headline');
        res.json({ success: true, connections: user.connections });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Toggle follow/unfollow a user
// @route   POST /api/connections/follow/:id
exports.toggleFollow = async (req, res) => {
    try {
        const targetId = req.params.id;
        const currentId = req.user._id;

        if (targetId === currentId.toString()) {
            return res.status(400).json({ success: false, message: "You cannot follow yourself" });
        }

        const targetUser = await User.findById(targetId);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

        const isFollowing = targetUser.followers.includes(currentId);

        if (isFollowing) {
            // Unfollow
            await User.findByIdAndUpdate(targetId, { $pull: { followers: currentId } });
            await User.findByIdAndUpdate(currentId, { $pull: { following: targetId } });
            res.json({ success: true, isFollowing: false });
        } else {
            // Follow
            await User.findByIdAndUpdate(targetId, { $addToSet: { followers: currentId } });
            await User.findByIdAndUpdate(currentId, { $addToSet: { following: targetId } });

            // Create notification
            await Notification.create({
                recipient: targetId,
                sender: currentId,
                type: 'follow',
                title: 'New Follower',
                message: `${req.user.name} started following you.`,
                link: `/users/profile/${currentId}`
            });

            res.json({ success: true, isFollowing: true });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Browse people to connect with
// @route   GET /api/connections/people?q=&page=&limit=
exports.browsePeople = async (req, res) => {
    try {
        const userId = req.user._id;
        const currentUser = await User.findById(userId).select('connections').lean();
        const { q, page = 1, limit = 12 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Exclude self, already-connected users, and dummy/seeded accounts (must have logged in at least once)
        const excludeIds = [userId, ...(currentUser.connections || [])];

        let filter = { _id: { $nin: excludeIds }, isActive: true, lastLogin: { $exists: true, $ne: null } };
        if (q && q.trim().length >= 2) {
            const regex = { $regex: q.trim(), $options: 'i' };
            filter.$or = [{ name: regex }, { headline: regex }, { skills: regex }, { location: regex }];
        }

        const [people, total] = await Promise.all([
            User.find(filter)
                .select('name avatar headline skills location role connections')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(filter)
        ]);

        // Check pending request status for each person
        const personIds = people.map(p => p._id);
        const pendingRequests = await ConnectionRequest.find({
            $or: [
                { sender: userId, recipient: { $in: personIds } },
                { sender: { $in: personIds }, recipient: userId }
            ],
            status: 'pending'
        }).select('sender recipient').lean();

        const pendingSet = new Set(
            pendingRequests.map(r =>
                r.sender.toString() === userId.toString()
                    ? r.recipient.toString()
                    : r.sender.toString()
            )
        );

        const myConnectionIds = new Set((currentUser.connections || []).map(c => c.toString()));

        const result = people.map(p => ({
            _id: p._id,
            name: p.name,
            avatar: p.avatar,
            headline: p.headline,
            skills: p.skills,
            location: p.location,
            role: p.role,
            connectionStatus: pendingSet.has(p._id.toString()) ? 'pending' : 'none',
            mutualCount: (p.connections || []).filter(c => myConnectionIds.has(c.toString())).length
        }));

        res.json({ success: true, people: result, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Remove a connection
// @route   DELETE /api/connections/:id
exports.removeConnection = async (req, res) => {
    try {
        const friendId = req.params.id;
        const userId = req.user._id;

        // Remove from both
        await User.findByIdAndUpdate(userId, { $pull: { connections: friendId } });
        await User.findByIdAndUpdate(friendId, { $pull: { connections: userId } });

        // Also delete the request record to allow re-connecting later if needed
        await ConnectionRequest.findOneAndDelete({
            $or: [
                { sender: userId, recipient: friendId },
                { sender: friendId, recipient: userId }
            ]
        });

        res.json({ success: true, message: "Connection removed" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
