import Agenda from "agenda";
import dotenv from "dotenv";

dotenv.config();

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: "agendaJobs",
  },
  processEvery: "1 minute", // How often agenda checks for new jobs
});

export default agenda;
