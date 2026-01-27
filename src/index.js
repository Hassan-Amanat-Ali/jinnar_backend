import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import bodyParser from 'body-parser';
import connectDb from './config/db.js';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import apiRoutes from './routes/api.js';
import cors from 'cors';
import path from 'path';
import http from "http";
import { botService } from "./services/BotService.js";
import setupSocket from "./socket.js";
import { errorHandler } from './middleware/errorHandler.js';
import mongoose from 'mongoose';
import { initializeRecommendationEngine } from './services/recommendationService.js';
import agenda from './config/agenda.js';
import PayoutMonitorService from './services/payoutMonitorService.js';
import '../scripts/ticket-maintenance.js';
import swaggerSpec from './config/swagger.js';

// Initialize Passport
import passport from 'passport';
import './config/passport.js';
import { Strategy as FacebookStrategy } from "passport-facebook";


const app = express();
const PORT = process.env.PORT || 3000;
console.log('Environment PORT:', PORT)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});

connectDb().then(async () => {
  console.log('Connected to MongoDB');

  // Start Agenda.js scheduler
  await agenda.start();
  console.log('Agenda.js scheduler started');

  // Define payout monitoring job BEFORE scheduling
  agenda.define('check-pending-payouts', async () => {
    console.log('🔄 [PAYOUT MONITOR] Running payout status check job...');
    try {
      await PayoutMonitorService.checkPendingPayouts();
      console.log('✅ [PAYOUT MONITOR] Payout status check completed successfully');
    } catch (error) {
      console.error('❌ [PAYOUT MONITOR] Payout monitoring job failed:', error);
    }
  });

  // Schedule jobs - AFTER definition
  await agenda.every('1 minute', 'check-pending-payouts');
  console.log('📅 [PAYOUT MONITOR] Job scheduled to run every 1 minute');

  await agenda.every('30 minutes', 'monitor-sla-breaches');
  await agenda.every('1 day', 'auto-close-resolved-tickets');

  console.log('✅ All scheduled jobs configured');

  await botService.load(); // Use load() for faster startup
  await initializeRecommendationEngine();
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

app.use(passport.initialize());
app.use(cors());
const server = http.createServer(app);
setupSocket(server); // This activates Socket.IO

app.use(express.json());
// for parsing application/xwww-form-urlencoded
app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
  })
);

app.use('/api/auth', limiter);
//app.use("/uploads", express.static("uploads")); // 🔴 CRITICAL: Removed for security. Files should be served via a protected route.
// app.use(upload.array())
app.use(morgan('dev'));
if (process.env.NODE_ENV === 'production') {
  // app.use(helmet()); // Add security headers
}

//Serve Swagger UI
//Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve Course Swagger UI
import swaggerCourseSpec from './config/swagger-courses.js';
app.use('/api-docs/courses', swaggerUi.serve, swaggerUi.setup(swaggerCourseSpec));



//Routes
app.use('/api', apiRoutes)

// Course Upload Routes
import courseUploadRoutes from './routes/courseUploadRoutes.js';
import viralUploadRoutes from './routes/viralUploadRoutes.js';
app.use('/api/courses/upload', courseUploadRoutes);
app.use('/api/viral/upload', viralUploadRoutes);

// Static file serving for course uploads
// Serving uploads/courses directory at /uploads/courses
// Note: In production, Nginx/Apache usually handles this, or use a secure middleware for restricted access
app.use('/uploads/courses', express.static(path.join(process.cwd(), 'uploads/courses')));



passport.use(new FacebookStrategy({
    clientID: "948343518363185",
    clientSecret: "3c3b0d72c08f9dd3e90ed5f86edc4210",
    callbackURL: "https://pkfmp1s3-3000.euw.devtunnels.ms/auth/facebook/callback",
    profileFields: ["id", "displayName", "photos", "email"], // fields to fetch
    scope: ["email", "user_posts"]
  },
  function(accessToken, refreshToken, profile, done) {
    // You now have the accessToken here
    // Save user & accessToken in DB if you want
    const user = { facebookId: profile.id, accessToken };
    console.log("Facebook profile:", user);
    return done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));


app.get("/auth/facebook",
    passport.authenticate('facebook'));

  app.get("/auth/facebook/callback",
    (req, res, next) => {
      console.log("Facebook callback hit");
      next();
    },
    passport.authenticate("facebook", { failureRedirect: "/login" }),
    (req, res) => {
      // Logged in successfully, req.user contains accessToken
      res.send("Login successful!");
    });


app.get('/', (req, res) => {
  res.send('API Server is running...');
})

// Serve test-chat.html at /chat-interface
app.get('/chat-interface', (req, res) => {
  const filePath = path.resolve('test-chat.html');
  return res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending test-chat.html:', err);
      res.status(500).send('Could not load chat interface');
    }
  });
})



server.listen(PORT, () => {
  console.log('Server is running on port', PORT);
  console.log('Swagger UI is availible at /api-docs');
})

// Mount global error handler AFTER routes
app.use(errorHandler);

// Graceful shutdown & process-level error handling
const shutdown = async (reason) => {
  try {
    console.error('Shutting down server due to:', reason);
    server.close(() => console.log('HTTP server closed'));
    if (mongoose?.connection && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
    process.exit(1);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  try {
    server.close();
    if (mongoose?.connection && mongoose.connection.readyState === 1) await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error on SIGINT shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  try {
    server.close();
    if (mongoose?.connection && mongoose.connection.readyState === 1) await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error on SIGTERM shutdown:', err);
    process.exit(1);
  }
});
