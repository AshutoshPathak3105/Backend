/**
 * Cleanup Script — Remove all seeded / fake data
 * Keeps real registered users (any email NOT in the seeder list).
 *
 * Dry-run  (shows what will be deleted):
 *   node cleanup.js
 *
 * Actually delete:
 *   node cleanup.js --confirm
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User         = require('./models/User');
const Job          = require('./models/Job');
const Company      = require('./models/Company');
const Application  = require('./models/Application');
const Notification = require('./models/Notification');
const Post         = require('./models/Post');
const Story        = require('./models/Story');

// ─── All emails created by every seed script ─────────────────────────────────
const SEEDED_EMAILS = [
    'admin@jobportal.com',
    'hr@techcorp.com',
    'hr@designstudio.com',
    'john@example.com',
    'jane@example.com',
];

const isDryRun = !process.argv.includes('--confirm');

const log  = (msg) => console.log(msg);
const warn = (msg) => console.warn('\x1b[33m%s\x1b[0m', msg);
const ok   = (msg) => console.log('\x1b[32m%s\x1b[0m', msg);
const err  = (msg) => console.error('\x1b[31m%s\x1b[0m', msg);

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        ok('✅  MongoDB connected');

        // ── 1. Count everything before touching anything ─────────────────────
        const [
            totalJobs, totalCompanies, totalApplications,
            totalStories, seededUsers, totalUsers,
            seededPosts, totalNotifications,
        ] = await Promise.all([
            Job.countDocuments(),
            Company.countDocuments(),
            Application.countDocuments(),
            Story.countDocuments(),
            User.countDocuments({ email: { $in: SEEDED_EMAILS } }),
            User.countDocuments(),
            Post.countDocuments({ author: { $in: await User.find({ email: { $in: SEEDED_EMAILS } }).distinct('_id') } }),
            Notification.countDocuments(),
        ]);

        const realUsers = totalUsers - seededUsers;

        log('\n══════════════════════════════════════════');
        log('  CLEANUP PREVIEW');
        log('══════════════════════════════════════════');
        log(`  Jobs              : ${totalJobs}   → will DELETE ALL`);
        log(`  Companies         : ${totalCompanies}   → will DELETE ALL`);
        log(`  Applications      : ${totalApplications}   → will DELETE ALL`);
        log(`  Stories           : ${totalStories}   → will DELETE ALL`);
        log(`  Seeded users      : ${seededUsers}   → will DELETE (known fake emails)`);
        log(`  Posts by seeders  : ${seededPosts}   → will DELETE`);
        log(`  All notifications : ${totalNotifications}   → will DELETE (orphaned after purge)`);
        log(`  Real users kept   : ${realUsers}   → PRESERVED`);
        log('══════════════════════════════════════════\n');

        if (isDryRun) {
            warn('👆  DRY RUN — nothing was deleted.');
            warn('    Run  node cleanup.js --confirm  to execute the cleanup.\n');
            process.exit(0);
        }

        // ── 2. Resolve seeded user IDs ───────────────────────────────────────
        const seededUserDocs = await User.find({ email: { $in: SEEDED_EMAILS } }).select('_id');
        const seededIds = seededUserDocs.map(u => u._id);

        // ── 3. Delete in safe order ───────────────────────────────────────────
        const [
            delApps, delNotifs, delJobs, delPosts, delStories, delCompanies, delUsers,
        ] = await Promise.all([
            Application.deleteMany({}),
            Notification.deleteMany({}),
            Job.deleteMany({}),
            Post.deleteMany({ author: { $in: seededIds } }),
            Story.deleteMany({}),
            Company.deleteMany({}),
            User.deleteMany({ email: { $in: SEEDED_EMAILS } }),
        ]);

        ok('\n✅  Cleanup complete!\n');
        ok(`  Applications deleted : ${delApps.deletedCount}`);
        ok(`  Notifications deleted: ${delNotifs.deletedCount}`);
        ok(`  Jobs deleted         : ${delJobs.deletedCount}`);
        ok(`  Posts deleted        : ${delPosts.deletedCount}`);
        ok(`  Stories deleted      : ${delStories.deletedCount}`);
        ok(`  Companies deleted    : ${delCompanies.deletedCount}`);
        ok(`  Seeded users deleted : ${delUsers.deletedCount}`);

        const remainingUsers = await User.countDocuments();
        ok(`\n  Real users remaining : ${remainingUsers}`);

        if (remainingUsers === 0) {
            warn('\n⚠️   No users remain in the database.');
            warn('    Register a new account on your website to get started.');
            warn('    Then go to Admin panel and set your role to "admin" if needed.\n');
        } else {
            ok('\n  Your real registered accounts are intact. ✓\n');
        }

        process.exit(0);
    } catch (error) {
        err(`\n❌  Cleanup failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
};

cleanup();
