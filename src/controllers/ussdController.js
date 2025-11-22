// import AfricasTalking from 'africastalking';
// import User from '../models/User.js';
// import { generateVerificationCode } from '../utils/helpers.js';

// const africasTalking = AfricasTalking({
//   apiKey: process.env.AT_API_KEY,
//   username: process.env.AT_USERNAME,
// });

// export const ussdHandler = async (req, res) => {
//   const { sessionId, phoneNumber, text } = req.body;
//   let response = '';

//   try {
//     if (text === '') {
//       response = 'CON Welcome to MyApp\n1. Register';
//     } else if (text === '1') {
//       let user = await User.findOne({ mobileNumber: phoneNumber });
//       if (user) {
//         response = 'END Mobile number already registered';
//       } else {
//         user = new User({ mobileNumber: phoneNumber });
//         const verificationCode = generateVerificationCode();
//         user.verificationCode = verificationCode;
//         user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
//         await user.save();

//         // Send SMS as fallback
//         await africasTalking.SMS.send({
//           to: phoneNumber,
//           message: `Your verification code is ${verificationCode}`,
//         });

//         response = 'END Verification code sent to your mobile number';
//       }
//     } else {
//       response = 'END Invalid option';
//     }
//   } catch (error) {
//     response = 'END An error occurred' , error;
//   }

//   res.set('Content-Type', 'text/plain');
//   res.send(response);
// };
