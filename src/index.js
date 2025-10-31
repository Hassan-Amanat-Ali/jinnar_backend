import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import bodyParser from 'body-parser';
import connectDb from './config/db.js';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import apiRoutes from './routes/api.js';



const app = express();
const PORT = process.env.PORT;
console.log('Environment:' , process.env.PORT)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});

connectDb();

app.use(express.json());
// for parsing application/xwww-form-urlencoded
app.use(
    bodyParser.urlencoded({
        limit: "50mb",
        extended: true,
    })
);
app.use('/api/auth', limiter);
app.use('/uploads', express.static('./uploads'));
// app.use(upload.array())
app.use(morgan('dev'));
if (process.env.NODE_ENV === 'production') {
  // app.use(helmet()); // Add security headers
}

//Load Swager YAML
const swaggerDoc = YAML.load('./src/config/swagger.yaml');

//Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));


//Routes
app.use('/api' , apiRoutes)

app.get('/', (req,res) => {
    res.send('API Server is running...');
})



app.listen(PORT, () => {
    console.log('Server is running on port' , PORT);
    console.log('Swagger UI is availible at /api-docs');
})



