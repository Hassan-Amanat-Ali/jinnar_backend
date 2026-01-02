import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: "/api/auth/google/callback",
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;

            // Check if user exists
            let user = await User.findOne({ email });

            if (user) {
                // User exists, return them
                return done(null, user);
            }

            // User doesn't exist, create new
            user = new User({
                name: profile.displayName || 'User',
                email: email,
                role: 'buyer', // Default role
                isVerified: true, // Social auth implies verification
                profilePicture: profile.photos ? profile.photos[0].value : null,
                // No password for social auth users
            });

            await user.save();
            return done(null, user);

        } catch (err) {
            console.error('Google Auth Error:', err);
            return done(err, null);
        }
    }
));

// GitHub Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: "/api/auth/github/callback",
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : null;

            if (!email) {
                return done(new Error('No email found in GitHub profile'), null);
            }

            // Check if user exists
            let user = await User.findOne({ email });

            if (user) {
                return done(null, user);
            }

            // Create new
            user = new User({
                name: profile.displayName || profile.username || 'User',
                email: email,
                role: 'buyer',
                isVerified: true,
                profilePicture: profile.photos ? profile.photos[0].value : null
            });

            await user.save();
            return done(null, user);

        } catch (err) {
            console.error('GitHub Auth Error:', err);
            return done(err, null);
        }
    }
));

export default passport;
