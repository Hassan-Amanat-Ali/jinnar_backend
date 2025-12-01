import agenda from "../src/config/agenda.js";
import SupportTicket from "../src/models/SupportTicket.js";
import User from "../src/models/User.js";
import { sendPushNotification } from "../src/services/pushNotificationService.js";

// Job to monitor SLA breaches
agenda.define("monitor-sla-breaches", async (job) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const overdueTickets = await SupportTicket.find({
      status: { $in: ["open", "in_progress"] },
      updatedAt: { $lt: twentyFourHoursAgo },
      assignedTo: { $ne: null }, // Only notify if someone is assigned
    }).populate("assignedTo");

    if (overdueTickets.length === 0) {
      console.log("SLA Monitor: No overdue tickets found.");
      return;
    }

    console.log(`SLA Monitor: Found ${overdueTickets.length} overdue tickets. Sending reminders...`);

    for (const ticket of overdueTickets) {
      const agent = ticket.assignedTo;
      if (agent && agent.fcmTokens && agent.fcmTokens.length > 0) {
        const notification = {
          title: "SLA Reminder",
          body: `Ticket #${ticket.ticketId} is approaching its SLA and requires attention.`,
          data: { ticketId: ticket._id.toString() },
        };

        // Send notification to all of the agent's devices
        const promises = agent.fcmTokens.map(tokenInfo => 
          sendPushNotification(tokenInfo.token, notification)
        );
        await Promise.all(promises);
      }
    }
  } catch (error) {
    console.error("Error in 'monitor-sla-breaches' job:", error);
  }
});

// Job to auto-close resolved tickets
agenda.define("auto-close-resolved-tickets", async (job) => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const result = await SupportTicket.updateMany(
      {
        status: "resolved",
        updatedAt: { $lt: threeDaysAgo },
      },
      {
        $set: { status: "closed" },
        $push: { internalNotes: { 
          note: "Ticket auto-closed after 3 days of resolution.",
          // No agentId for system actions
        }},
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Auto-Closure: Closed ${result.modifiedCount} stale resolved tickets.`);
    } else {
      console.log("Auto-Closure: No stale resolved tickets to close.");
    }
  } catch (error) {
    console.error("Error in 'auto-close-resolved-tickets' job:", error);
  }
});
