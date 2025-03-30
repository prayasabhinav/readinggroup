// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  console.log('No .env file found or error loading it, using environment variables');
}

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

// Debug environment variables
console.log('Environment variables:');
console.log('GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('BASE_URL:', process.env.BASE_URL);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

// Get environment variables with defaults
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/readinggroup';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

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
    votes: { type: Number, default: 0 },
    proposedBy: String,
    isSelected: { type: Boolean, default: false },
    weekDate: String, // Week date range for selected topic
    pdfFile: {
        filename: String,
        originalname: String,
        path: String
    },
    upvotedBy: [String] // Track users who upvoted
});

const Topic = mongoose.model('Topic', topicSchema);

// Connect to MongoDB with fallback to in-memory storage
let isUsingInMemoryMode = false;
const inMemoryUsers = {};
const inMemoryTopics = [];

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  dbName: 'readinggroup',
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('Successfully connected to MongoDB');
})
.catch((err) => {
  console.error('MongoDB connection error:', err.message);
  console.log('Falling back to in-memory storage');
  isUsingInMemoryMode = true;
  
  // Override Mongoose models with in-memory implementations if connection fails
  if (isUsingInMemoryMode) {
      // Create in-memory implementations for User model
      User.findOne = async (query) => {
          const email = query.email;
          return inMemoryUsers[email];
      };
      User.findById = async (id) => {
          return Object.values(inMemoryUsers).find(user => user._id.toString() === id.toString());
      };
      User.create = async (userData) => {
          const newUser = {
              ...userData,
              _id: new mongoose.Types.ObjectId()
          };
          inMemoryUsers[userData.email] = newUser;
          return newUser;
      };
      User.updateMany = async () => {
          return { nModified: 0 };
      };
      User.find = async () => {
          return Object.values(inMemoryUsers);
      };
      User.prototype.save = async function() {
          inMemoryUsers[this.email] = this;
          return this;
      };
      
      // Create in-memory implementations for Topic model
      Topic.find = async (query = {}) => {
          if (query._id && query._id.$ne) {
              return inMemoryTopics.filter(topic => topic._id.toString() !== query._id.$ne.toString());
          }
          return [...inMemoryTopics];
      };
      Topic.findOne = async (query) => {
          if (query.isSelected) {
              return inMemoryTopics.find(topic => topic.isSelected);
          }
          return null;
      };
      Topic.findById = async (id) => {
          return inMemoryTopics.find(topic => topic._id.toString() === id.toString());
      };
      Topic.create = async (topicData) => {
          const newTopic = {
              ...topicData,
              _id: new mongoose.Types.ObjectId()
          };
          inMemoryTopics.push(newTopic);
          return newTopic;
      };
      Topic.findByIdAndUpdate = async (id, update, options) => {
          const index = inMemoryTopics.findIndex(topic => topic._id.toString() === id.toString());
          if (index !== -1) {
              inMemoryTopics[index] = { ...inMemoryTopics[index], ...update };
              return inMemoryTopics[index];
          }
          return null;
      };
      Topic.updateMany = async () => {
          return { nModified: 0 };
      };
      Topic.deleteMany = async (query = {}) => {
          if (query._id && query._id.$ne) {
              const beforeCount = inMemoryTopics.length;
              const idToKeep = query._id.$ne.toString();
              const filtered = inMemoryTopics.filter(topic => topic._id.toString() === idToKeep);
              inMemoryTopics.length = 0;
              inMemoryTopics.push(...filtered);
              return { deletedCount: beforeCount - filtered.length };
          }
          const count = inMemoryTopics.length;
          inMemoryTopics.length = 0;
          return { deletedCount: count };
      };
      Topic.countDocuments = async () => {
          return inMemoryTopics.length;
      };
      Topic.prototype.save = async function() {
          const index = inMemoryTopics.findIndex(topic => topic._id.toString() === this._id.toString());
          if (index !== -1) {
              inMemoryTopics[index] = this;
          } else {
              inMemoryTopics.push(this);
          }
          return this;
      };
  }
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Trust proxy for secure cookies when behind reverse proxy (like in CapRover)
app.set('trust proxy', 1);

// More robust session configuration with secure cookies for production
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: COOKIE_SECURE, // true in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Debug session middleware
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session exists:', !!req.session);
    next();
});

app.use(passport.initialize());
app.use(passport.session());

// Serve static files BEFORE route definitions
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files
app.use(express.static(path.join(__dirname))); // Serve static files from current directory

// Passport configuration
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Log complete Google OAuth configuration
console.log('Google OAuth Configuration:');
console.log('CLIENT_ID first 5 chars:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 5) + '...' : 'undefined');
console.log('CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('CALLBACK_URL:', `${BASE_URL}/auth/google/callback`);

try {
  // Hardcoded client ID and secret as fallback if env vars fail
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '3378649832-qp43a4q9ivfdu6olc92u2c6sckv10rde.apps.googleusercontent.com';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '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';
  
  console.log('Using Google credentials:');
  console.log('Client ID (first 8 chars):', googleClientId.substring(0, 8) + '...');
  console.log('Client Secret exists:', !!googleClientSecret);
  
  passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: `${BASE_URL}/auth/google/callback`,
      // Add proxy support
      proxy: true
  }, async (accessToken, refreshToken, profile, done) => {
      // Log profile information
      console.log('Google auth successful, profile:', JSON.stringify({
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value
      }));
      
      try {
          if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
              console.error('No email found in Google profile');
              return done(new Error('No email found in Google profile'), null);
          }
          
          const email = profile.emails[0].value;
          let user = await User.findOne({ email });
          
          if (!user) {
              console.log('Creating new user with email:', email);
              user = await User.create({
                  email: email,
                  name: profile.displayName,
                  isAdmin: email === 'prayas.abhinav@anu.edu.in',
                  upvotedTopics: [],
                  wonTopics: []
              });
              console.log('New user created with ID:', user._id);
          } else {
              console.log('Existing user found with ID:', user._id);
          }
          
          return done(null, user);
      } catch (error) {
          console.error('Google authentication error:', error);
          return done(error, null);
      }
  }));
} catch (err) {
  console.error('Failed to initialize Google Strategy:', err);
}

// Auth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Improved Google callback with detailed error handling
app.get('/auth/google/callback', (req, res, next) => {
    console.log('Google callback triggered');
    
    passport.authenticate('google', { failureRedirect: '/login' }, (err, user, info) => {
        console.log('Inside passport authenticate callback');
        
        if (err) {
            console.error('Authentication error:', err);
            return res.status(500).send(`Authentication Error: ${err.message}`);
        }
        
        if (!user) {
            console.error('No user returned from authentication');
            return res.redirect('/login');
        }
        
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return res.status(500).send(`Login Error: ${loginErr.message}`);
            }
            
            console.log('User successfully logged in:', user.email);
            
            // Redirect to homepage instead of showing success message
            return res.redirect('/');
        });
    })(req, res, next);
});

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

// Get users who upvoted a specific topic
app.get('/api/topics/:id/voters', async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }
        
        // Get all users who upvoted this topic
        const voters = [];
        if (Array.isArray(topic.upvotedBy) && topic.upvotedBy.length > 0) {
            // Collect all unique voters
            for (const upvoterId of topic.upvotedBy) {
                // Check if it looks like an email
                if (upvoterId.includes('@')) {
                    if (!voters.some(v => v.email === upvoterId)) {
                        voters.push({ email: upvoterId, name: upvoterId.split('@')[0] });
                    }
                } else if (/^[0-9a-fA-F]{24}$/.test(upvoterId)) {
                    // Try to find by ID
                    const user = await User.findById(upvoterId);
                    if (user && !voters.some(v => v.email === user.email)) {
                        voters.push({ 
                            email: user.email, 
                            name: user.name || user.email.split('@')[0] 
                        });
                    }
                }
            }
        }
        
        // Also check users with this topic in their upvotedTopics array
        const topicId = topic._id.toString();
        const users = await User.find();
        for (const user of users) {
            if (user.upvotedTopics && user.upvotedTopics.includes(topicId)) {
                if (!voters.some(v => v.email === user.email)) {
                    voters.push({ 
                        email: user.email, 
                        name: user.name || user.email.split('@')[0]
                    });
                }
            }
        }
        
        res.json(voters);
    } catch (error) {
        console.error('Error fetching topic voters:', error);
        res.status(500).json({ error: error.message });
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
            proposedBy: req.user.email,
            upvotedBy: [] // Initialize empty array
        });
        res.json(topic);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Optimized upvote endpoint for faster response
app.post('/api/topics/:id/upvote', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const topic = await Topic.findById(req.params.id);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        const topicId = topic._id.toString();
        const userId = req.user._id.toString();
        const userEmail = req.user.email;
        
        // Initialize arrays if they don't exist
        if (!req.user.upvotedTopics) req.user.upvotedTopics = [];
        if (!topic.upvotedBy) topic.upvotedBy = [];
        
        // Check if user has already upvoted this topic
        if (req.user.upvotedTopics.includes(topicId)) {
            return res.status(400).json({ error: 'Already upvoted' });
        }

        // Start both updates asynchronously for performance
        const topicUpdatePromise = (async () => {
            // Update topic
            topic.votes = (topic.votes || 0) + 1;
            
            // Add user to upvotedBy - we'll update both ID and email for robustness
            if (!topic.upvotedBy.includes(userId)) {
                topic.upvotedBy.push(userId);
            }
            if (!topic.upvotedBy.includes(userEmail)) {
                topic.upvotedBy.push(userEmail);
            }
            
            return topic.save();
        })();
        
        const userUpdatePromise = (async () => {
            // Update user
            const user = await User.findById(req.user._id);
            if (user) {
                if (!user.upvotedTopics) user.upvotedTopics = [];
                user.upvotedTopics.push(topicId);
                await user.save();
                
                // Update session user
                req.user.upvotedTopics = user.upvotedTopics;
            }
        })();
        
        // Wait for the topic update to finish first so we can return it quickly
        const updatedTopic = await topicUpdatePromise;
        
        // Return the response immediately without waiting for user update
        res.json(updatedTopic);
        
        // Continue user update in the background
        userUpdatePromise.catch(error => {
            console.error('Background user update error:', error);
        });
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
        console.log(`Admin ${req.user.email} is selecting topic ${req.params.id}`);
        
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
        
        // Set all topics to not selected
        await Topic.updateMany({}, { $set: { isSelected: false } });
        
        // Find and update the selected topic
        const topic = await Topic.findById(req.params.id);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }
        
        topic.isSelected = true;
        topic.weekDate = weekDateRange;
        console.log(`Setting topic "${topic.text}" as selected for ${weekDateRange}`);
        
        // Update the topic first
        await topic.save();
        
        // Process the proposer separately
        if (topic.proposedBy) {
            try {
                // Try to find proposer by email first (most likely scenario)
                let proposer = await User.findOne({ email: topic.proposedBy });
                
                // If not found by email, try by ID if it looks like a valid ObjectId
                if (!proposer && /^[0-9a-fA-F]{24}$/.test(topic.proposedBy)) {
                    proposer = await User.findById(topic.proposedBy);
                }
                
                if (proposer) {
                    console.log(`Found proposer: ${proposer.email}`);
                    if (!proposer.wonTopics) {
                        proposer.wonTopics = [];
                    }
                    
                    const topicIdStr = topic._id.toString();
                    if (!proposer.wonTopics.includes(topicIdStr)) {
                        proposer.wonTopics.push(topicIdStr);
                        await proposer.save();
                        console.log(`Updated proposer's wonTopics array`);
                    }
                } else {
                    console.log(`Could not find proposer with identifier: ${topic.proposedBy}`);
                }
            } catch (proposerError) {
                console.error(`Error updating proposer: ${proposerError.message}`);
                // Continue even if there's an error with the proposer
            }
        }
        
        // Process upvoters - handle upvotedBy array - do this in the background
        setTimeout(async () => {
            try {
                if (Array.isArray(topic.upvotedBy) && topic.upvotedBy.length > 0) {
                    console.log(`Processing ${topic.upvotedBy.length} upvoters from upvotedBy array`);
                    
                    for (const upvoterId of topic.upvotedBy) {
                        try {
                            // Try to find upvoter by email first
                            let upvoter = await User.findOne({ email: upvoterId });
                            
                            // If not found by email and looks like ObjectId, try by ID
                            if (!upvoter && /^[0-9a-fA-F]{24}$/.test(upvoterId)) {
                                upvoter = await User.findById(upvoterId);
                            }
                            
                            if (upvoter) {
                                console.log(`Found upvoter: ${upvoter.email}`);
                                if (!upvoter.wonTopics) {
                                    upvoter.wonTopics = [];
                                }
                                
                                const topicIdStr = topic._id.toString();
                                if (!upvoter.wonTopics.includes(topicIdStr)) {
                                    upvoter.wonTopics.push(topicIdStr);
                                    await upvoter.save();
                                    console.log(`Updated upvoter's wonTopics array`);
                                }
                            } else {
                                console.log(`Could not find upvoter with identifier: ${upvoterId}`);
                            }
                        } catch (upvoterError) {
                            console.error(`Error updating upvoter ${upvoterId}: ${upvoterError.message}`);
                            // Continue processing other upvoters
                        }
                    }
                } else {
                    console.log(`No upvotedBy array found, checking upvotedTopics references`);
                    
                    // NO updateMany - use individual updates for safety
                    try {
                        // Get all users
                        const allUsers = await User.find();
                        
                        // Find users who upvoted this topic
                        for (const user of allUsers) {
                            if (user.upvotedTopics && user.upvotedTopics.includes(topic._id.toString())) {
                                if (!user.wonTopics) {
                                    user.wonTopics = [];
                                }
                                
                                if (!user.wonTopics.includes(topic._id.toString())) {
                                    user.wonTopics.push(topic._id.toString());
                                    await user.save();
                                    console.log(`Updated user ${user.email}'s wonTopics array`);
                                }
                            }
                        }
                    } catch (userError) {
                        console.error(`Error updating users who upvoted: ${userError.message}`);
                        // Continue with the process
                    }
                }
                
                console.log(`Topic ${topic._id} selection background processing completed`);
            } catch (error) {
                console.error('Background processing error:', error);
            }
        }, 0);
        
        console.log(`Topic ${topic._id} selection completed successfully`);
        res.json(topic);
    } catch (error) {
        console.error('Select topic error:', error);
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
        
        // Find topic in memory
        const topic = await Topic.findById(req.params.id);
        if (!topic) {
            // Remove uploaded file if topic not found
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Topic not found' });
        }
        
        // If there was a previous file, delete it
        if (topic.pdfFile && topic.pdfFile.path) {
            const oldFilePath = path.join(__dirname, topic.pdfFile.path);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }
        
        // Update topic in memory
        topic.pdfFile = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            path: req.file.path
        };
        await topic.save();
        
        res.json(topic);
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
        // Delete PDF files associated with topics
        await Topic.updateMany({}, { $unset: { pdfFile: 1 } });
        
        // Clear all users' upvotedTopics and wonTopics arrays
        await User.updateMany({}, { $set: { upvotedTopics: [], wonTopics: [] } });
        
        // Count and clear all topics
        const deletedCount = await Topic.countDocuments();
        await Topic.deleteMany();
        
        res.json({ 
            message: `All topics cleared successfully. Deleted ${deletedCount} topics.` 
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
        const topicsToDelete = await Topic.find({ _id: { $ne: selectedTopic._id } });
        
        // Delete PDF files associated with topics to be deleted
        for (const topic of topicsToDelete) {
            if (topic.pdfFile && topic.pdfFile.path) {
                const filePath = path.join(__dirname, topic.pdfFile.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
        
        const selectedTopicId = selectedTopic._id.toString();
        
        // Keep only selected topic in users' wonTopics if it exists
        await User.updateMany(
            { wonTopics: selectedTopicId },
            { $set: { wonTopics: [selectedTopicId] } }
        );
        
        // Remove selected topic from users who don't have it in wonTopics
        await User.updateMany(
            { wonTopics: { $ne: selectedTopicId } },
            { $set: { wonTopics: [] } }
        );
        
        // Keep only selected topic in users' upvotedTopics if it exists
        await User.updateMany(
            { upvotedTopics: selectedTopicId },
            { $set: { upvotedTopics: [selectedTopicId] } }
        );
        
        // Remove selected topic from users who don't have it in upvotedTopics
        await User.updateMany(
            { upvotedTopics: { $ne: selectedTopicId } },
            { $set: { upvotedTopics: [] } }
        );
        
        // Delete all topics except selected
        const result = await Topic.deleteMany({ _id: { $ne: selectedTopic._id } });
        
        res.json({ 
            message: `All topics except selected cleared successfully. Deleted ${result.deletedCount} topics.` 
        });
    } catch (error) {
        console.error('Error clearing topics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Authentication check middleware
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/google');
};

// Apply protection to routes
app.get('/', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Global error handler - add this at the end
app.use((err, req, res, next) => {
    console.error('Unhandled application error:', err);
    const statusCode = err.statusCode || 500;
    const errorMessage = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
    res.status(statusCode).json({
        error: errorMessage,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
}); 