const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The user who triggered the notification
    type: {
        type: String,
        enum: [
            'new_application',    // employer receives
            'application_status', // jobseeker receives
            'job_posted',         // admin notification
            'profile_view',       // jobseeker receives
            'interview_scheduled',// jobseeker receives
            'offer_received',     // jobseeker receives
            'friend_post',        // friend receives
            'connection_req',     // user receives
            'connection_accept',  // user receives
            'system'              // general system notification
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' }, // Frontend route to navigate
    isRead: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} } // Extra data (jobId, applicationId, etc.)
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
