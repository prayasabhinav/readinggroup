require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function(req, file, cb) {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/reading-group', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    isAdmin: Boolean,
    upvotedTopics: [String],
    wonTopics: [String]
});

const User = mongoose.model('User', userSchema);

// Topic Schema
const topicSchema = new mongoose.Schema({
    text: String,
    votes: Number,
    proposedBy: String,
    isSelected: Boolean,
    weekDate: String, // Week date range for selected topic
    pdfFile: {
        filename: String,
        originalname: String,
        path: String
    }
});

const Topic = mongoose.model('Topic', topicSchema);

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from current directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if using https
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
            user = await User.create({
                email: profile.emails[0].value,
                name: profile.displayName,
                isAdmin: profile.emails[0].value === 'prayas.abhinav@anu.edu.in',
                upvotedTopics: [],
                wonTopics: []
            });
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Auth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res) => {
    // Check if req.logout is a function (newer versions of Passport)
    if (typeof req.logout === 'function') {
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ error: 'Logout failed' });
            }
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
                res.redirect('/');
            });
        });
    } else {
        // Older versions of Passport
        req.logout();
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
            res.redirect('/');
        });
    }
});

// API routes
app.get('/api/user', (req, res) => {
    if (req.user) {
        res.json(req.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Get user stats
app.get('/api/user/stats', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // Get fresh user data from database
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Ensure arrays exist
        const upvotedTopics = user.upvotedTopics || [];
        const wonTopics = user.wonTopics || [];
        
        // Get topics user has voted for
        const votedTopics = await Topic.find({ 
            _id: { $in: upvotedTopics }
        });
        
        // Filter for selected topics
        const selectedTopics = votedTopics.filter(topic => topic.isSelected);
        
        res.json({
            totalVoted: upvotedTopics.length,
            totalSelected: wonTopics.length
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/topics', async (req, res) => {
    try {
        const topics = await Topic.find().sort({ votes: -1 });
        res.json(topics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/topics', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const topic = await Topic.create({
            text: req.body.text,
            votes: 0,
            proposedBy: req.user.email
        });
        res.json(topic);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/topics/:id/upvote', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // Get user from database to ensure we have the latest data
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const topic = await Topic.findById(req.params.id);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        const topicId = topic._id.toString();
        
        // Check if user has already upvoted this topic
        if (user.upvotedTopics && user.upvotedTopics.includes(topicId)) {
            return res.status(400).json({ error: 'Already upvoted' });
        }

        // Initialize upvotedTopics array if it doesn't exist
        if (!user.upvotedTopics) {
            user.upvotedTopics = [];
        }
        
        // Update topic votes and user's upvoted topics
        topic.votes = (topic.votes || 0) + 1;
        user.upvotedTopics.push(topicId);
        
        console.log(`User ${user.email} upvoting topic ${topicId}`);
        console.log(`User's upvotedTopics before save:`, user.upvotedTopics);
        
        // Save both documents
        await topic.save();
        await user.save();
        
        // Update the session with the latest user data
        req.user = user;
        
        res.json(topic);
    } catch (error) {
        console.error('Upvote error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/topics/:id/select', async (req, res) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    try {
        // Calculate week date range (Monday-Sunday)
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
        const daysToMonday = currentDay === 0 ? 1 : (currentDay === 1 ? 0 : -(currentDay - 1));
        const monday = new Date(today);
        monday.setDate(today.getDate() + daysToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const mondayStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const sundayStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const weekDateRange = `${mondayStr} - ${sundayStr}`;
        
        await Topic.updateMany({}, { isSelected: false });
        const topic = await Topic.findByIdAndUpdate(
            req.params.id,
            { 
                isSelected: true,
                weekDate: weekDateRange
            },
            { new: true }
        );
        
        // Update wonTopics for users who upvoted this topic
        const proposer = await User.findOne({ email: topic.proposedBy });
        if (proposer && !proposer.wonTopics.includes(topic._id.toString())) {
            proposer.wonTopics.push(topic._id.toString());
            await proposer.save();
        }
        
        const upvoters = await User.find({ upvotedTopics: topic._id.toString() });
        for (const user of upvoters) {
            if (!user.wonTopics.includes(topic._id.toString())) {
                user.wonTopics.push(topic._id.toString());
                await user.save();
            }
        }
        
        res.json(topic);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PDF Upload route
app.post('/api/topics/:id/upload-pdf', upload.single('pdfFile'), async (req, res) => {
    if (!req.user || !req.user.isAdmin) {
        // Remove uploaded file if unauthorized
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }
        
        // If there was a previous file, delete it
        const topic = await Topic.findById(req.params.id);
        if (topic.pdfFile && topic.pdfFile.path) {
            const oldFilePath = path.join(__dirname, topic.pdfFile.path);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }
        
        const updatedTopic = await Topic.findByIdAndUpdate(
            req.params.id,
            {
                pdfFile: {
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    path: req.file.path
                }
            },
            { new: true }
        );
        
        res.json(updatedTopic);
    } catch (error) {
        // Remove uploaded file on error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// Clear all topics
app.delete('/api/topics/clear-all', async (req, res) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    try {
        // Find topics with PDF files to delete the files
        const topics = await Topic.find({ 'pdfFile.filename': { $exists: true } });
        
        // Delete PDF files associated with topics
        for (const topic of topics) {
            if (topic.pdfFile && topic.pdfFile.path) {
                const filePath = path.join(__dirname, topic.pdfFile.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
        
        // Clear all upvoted and won topics references from users
        await User.updateMany({}, { $set: { upvotedTopics: [], wonTopics: [] } });
        
        // Delete all topics
        const result = await Topic.deleteMany({});
        
        res.json({ 
            message: `All topics cleared successfully. Deleted ${result.deletedCount} topics.` 
        });
    } catch (error) {
        console.error('Error clearing topics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear all topics except selected
app.delete('/api/topics/clear-except-selected', async (req, res) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    try {
        // Find the selected topic
        const selectedTopic = await Topic.findOne({ isSelected: true });
        
        if (!selectedTopic) {
            return res.status(400).json({ 
                error: 'No topic is currently selected. Please select a topic first.' 
            });
        }
        
        // Find topics to delete (all except selected)
        const topicsToDelete = await Topic.find({ 
            _id: { $ne: selectedTopic._id } 
        });
        
        // Delete PDF files associated with topics to be deleted
        for (const topic of topicsToDelete) {
            if (topic.pdfFile && topic.pdfFile.path) {
                const filePath = path.join(__dirname, topic.pdfFile.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
        
        // Keep only the selected topic ID in users' wonTopics arrays
        // and remove all other topic IDs from upvotedTopics
        const selectedTopicId = selectedTopic._id.toString();
        
        const users = await User.find({});
        for (const user of users) {
            // Keep only selected topic in wonTopics if it exists
            if (user.wonTopics && user.wonTopics.includes(selectedTopicId)) {
                user.wonTopics = [selectedTopicId];
            } else {
                user.wonTopics = [];
            }
            
            // Keep only selected topic in upvotedTopics if it exists
            if (user.upvotedTopics && user.upvotedTopics.includes(selectedTopicId)) {
                user.upvotedTopics = [selectedTopicId];
            } else {
                user.upvotedTopics = [];
            }
            
            await user.save();
        }
        
        // Delete all topics except selected
        const result = await Topic.deleteMany({ 
            _id: { $ne: selectedTopic._id } 
        });
        
        res.json({ 
            message: `All topics except selected cleared successfully. Deleted ${result.deletedCount} topics.` 
        });
    } catch (error) {
        console.error('Error clearing topics:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 