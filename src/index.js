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


const app = express();
app.set('trust proxy', 2); // Required for rate limiting behind proxy
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
app.use(cors());
const server = http.createServer(app);
setupSocket(server); // This activates Socket.IO

// ✅ Didit Webhook - Must be before express.json()
app.post('/api/webhooks/didit', express.raw({ type: 'application/json' }), async (req, res) => {
  const { default: diditService } = await import('./services/diditService.js');
  const { default: User } = await import('./models/User.js');

  // CHECK BOTH FORMATS (Didit docs vs Actual Headers)
  const signature = req.headers['x-signature'] || req.headers['didit-signature'];
  const timestamp = req.headers['x-timestamp'] || req.headers['didit-timestamp'];

  // Keep debug logging for verification
  console.log('[Didit Webhook] Headers Extract:', { signature, timestamp });
  const secret = process.env.DIDIT_WEBHOOK_SECRET;

  try {
    // 1. Verify Signature & Timestamp (Replay Protection)
    const isValid = diditService.verifySignature(req.body, signature, secret, timestamp);

    if (!isValid) {
      console.warn('⚠️ [Didit Webhook] Invalid Signature or Timestamp');
      return res.status(401).send('Invalid Signature');
    }

    // 2. Parse Body manually
    const event = JSON.parse(req.body.toString());
    console.log('🔔 [Didit Webhook] Full Event Body:', JSON.stringify(event, null, 2));

    // 3. Update User Logic
    // Support various ID fields
    const sessionId = event.session_id || event.id || event.data?.session?.id;

    if (sessionId) {
      const user = await User.findOne({ 'verification.sessionId': sessionId });
      if (user) {
        const newStatus = diditService.parseVerificationStatus(event);

        // Only update if status changed
        if (user.verification.status !== newStatus) {
          user.verification.status = newStatus;
          if (newStatus === 'rejected' && event.details) {
            user.verification.lastError = event.details.reason || 'Verification rejected';
          }
          await user.save();
          console.log(`✅ [Didit Webhook] User ${user._id} verification updated to: ${newStatus}`);
        } else {
          console.log(`ℹ️ [Didit Webhook] User ${user._id} status already: ${newStatus}`);
        }
      } else {
        console.warn(`❌ [Didit Webhook] No user found for session: ${sessionId}`);
      }
    } else {
      console.warn('❌ [Didit Webhook] Event missing session_id');
    }

    res.status(200).send('Webhook Received');
  } catch (err) {
    console.error('❌ [Didit Webhook] processing error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.use(express.json());
// for parsing application/xwww-form-urlencoded
app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
  })
);
// Initialize Passport
import passport from 'passport';
import './config/passport.js';
app.use(passport.initialize());

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

// Public Course Routes (accessible to all authenticated users)
import publicCourseRoutes from './routes/publicCourseRoutes.js';
app.use('/api/courses', publicCourseRoutes);

// Course Upload Routes (admin only)
import courseUploadRoutes from './routes/courseUploadRoutes.js';
app.use('/api/courses/upload', courseUploadRoutes);

// Static file serving for course uploads
// Serving uploads/courses directory at /uploads/courses
// Note: In production, Nginx/Apache usually handles this, or use a secure middleware for restricted access
app.use('/uploads/courses', express.static(path.join(process.cwd(), 'uploads/courses')));


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
