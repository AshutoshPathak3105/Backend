const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendWelcomeEmail, sendPasswordResetEmail, sendOTPEmail } = require('../utils/emailService');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });
};

// @desc Register user
exports.register = async (req, res) => {
    try {
        const { name, email, phone, password, role,
            companyName, companyWebsite, companyLocation, companyIndustry, companyDescription } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
        }

        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({ success: false, message: 'Phone number already registered' });
        }

        const user = await User.create({ name, email, phone, password, role: role || 'jobseeker' });
        const token = generateToken(user._id);

        // Auto-create company profile if registering as employer
        if ((role === 'employer') && companyName) {
            try {
                const Company = require('../models/Company');
                await Company.create({
                    name: companyName,
                    owner: user._id,
                    website: companyWebsite || '',
                    location: companyLocation || 'India',
                    industry: companyIndustry || 'Other',
                    description: companyDescription || '',
                    phone: phone || '',
                    email: email || '',
                });
            } catch (_) { /* Company can be set up later from the Company Profile page */ }
        }

        // Send welcome email (non-blocking)
        sendWelcomeEmail(user).catch(() => { });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                _id: user._id, name: user.name, email: user.email,
                role: user.role, avatar: user.avatar, profileCompletion: user.profileCompletion
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body; // email field here can be email or phone

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Identifier (email/phone) and password are required' });
        }

        const user = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phone: email }
            ]
        });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact support.' });
        }
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });
        const token = generateToken(user._id);
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id, name: user.name, email: user.email,
                role: user.role, avatar: user.avatar, profileCompletion: user.profileCompletion
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get current user
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -resetPasswordToken -resetPasswordExpire')
            .populate('savedJobs', 'title company location type salary');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Update password
exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Both current and new passwords are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }
        const user = await User.findById(req.user._id);
        if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        user.password = newPassword;
        await user.save();
        const token = generateToken(user._id);
        res.json({ success: true, message: 'Password updated successfully', token });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Forgot password — sends reset email OR OTP
exports.forgotPassword = async (req, res) => {
    try {
        const { identifier, method } = req.body; // identifier can be email or phone
        if (!identifier) {
            return res.status(400).json({ success: false, message: 'Email or phone number is required' });
        }

        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }]
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'No user found with that identifier' });
        }

        if (method === 'otp') {
            if (!user.phone) {
                return res.status(400).json({ success: false, message: 'No mobile number registered for this account. Please use Email method.' });
            }
            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.otp = otp;
            user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save({ validateBeforeSave: false });

            try {
                // Simulate SMS by sending to email, but label it as mobile recovery
                await sendOTPEmail(user, otp);
                return res.json({
                    success: true,
                    message: `OTP has been sent to your registered mobile number ending in ${user.phone.slice(-4)}`
                });
            } catch (err) {
                user.otp = undefined;
                user.otpExpire = undefined;
                await user.save({ validateBeforeSave: false });
                return res.status(500).json({ success: false, message: 'Error sending OTP.' });
            }
        } else {
            // Existing link method
            const resetToken = user.generatePasswordResetToken();
            await user.save({ validateBeforeSave: false });

            try {
                await sendPasswordResetEmail(user, resetToken);
                return res.json({
                    success: true,
                    message: `A password reset link has been sent to your registered email: ${user.email.replace(/(.{3})(.*)(@.*)/, '$1***$3')}`
                });
            } catch (emailErr) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpire = undefined;
                await user.save({ validateBeforeSave: false });
                return res.status(500).json({ success: false, message: 'Error sending reset email.' });
            }
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Verify OTP and return reset token
exports.verifyOTP = async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        if (!identifier || !otp) {
            return res.status(400).json({ success: false, message: 'Identifier and OTP are required' });
        }

        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
            otp,
            otpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
        }

        // OTP verified - generate a one-time reset token to allow password change
        const resetToken = user.generatePasswordResetToken();
        user.otp = undefined;
        user.otpExpire = undefined;
        await user.save({ validateBeforeSave: false });

        res.json({ success: true, resetToken });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Reset password using token from email
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Hash the token from URL to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token. Please request a new one.' });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        const jwtToken = generateToken(user._id);
        res.json({
            success: true,
            message: 'Password reset successful. You are now logged in.',
            token: jwtToken,
            user: {
                _id: user._id, name: user.name, email: user.email,
                role: user.role, avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
