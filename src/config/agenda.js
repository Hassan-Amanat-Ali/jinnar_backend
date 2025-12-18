import Agenda from "agenda";
import dotenv from "dotenv";

dotenv.config();

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: "agendaJobs",
  },
  processEvery: "10 seconds", // Check for jobs every 10 seconds
  maxConcurrency: 1, // One job at a time
  lockLimit: 1, // Only one instance per job
});

export default agenda;
