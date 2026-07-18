import { prisma } from "../../db/prisma";

export class InboxRepository {
  static async isEventProcessed(eventId: string) {
    const event = await prisma.processedEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });

    return Boolean(event);
  }

  static async markAsProcessed(eventId: string, subject: string) {
    return prisma.processedEvent.upsert({
      where: { eventId },
      update: {
        subject,
        processedAt: new Date(),
      },
      create: {
        eventId,
        subject,
      },
    });
  }
}
