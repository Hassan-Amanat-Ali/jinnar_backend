import { jest } from '@jest/globals';
import { recommendWorkers } from '../src/services/recommendationService.js';
import User from '../src/models/User.js';
import Order from '../src/models/Order.js';

describe('recommendWorkers', () => {
  it('should recommend workers based on a weighted score', async () => {
    const workers = [
      { _id: 'worker1', name: 'Alice', skills: ['plumbing', 'heating'], rating: { average: 4.5 }, lastRecommendedAt: new Date('2023-01-01'), averageResponseTime: 30, availability: [{ day: 'Monday', timeSlots: ['morning'] }] },
      { _id: 'worker2', name: 'Bob', skills: ['electrical', 'wiring'], rating: { average: 4.0 }, lastRecommendedAt: new Date('2023-01-15'), averageResponseTime: 60, availability: [{ day: 'Tuesday', timeSlots: ['afternoon'] }] },
      { _id: 'worker3', name: 'Charlie', skills: ['plumbing', 'drains'], rating: { average: 5.0 }, lastRecommendedAt: null, averageResponseTime: 10, availability: [{ day: 'Monday', timeSlots: ['morning'] }] },
    ];
    const jobRequest = {
      title: 'Leaky faucet repair',
      description: 'Need a plumber to fix a leaky faucet.',
      skills: ['plumbing'],
      clientId: 'client1',
      dateTime: new Date('2025-11-24T10:00:00.000Z'), // Monday morning
    };

    const findSpy = jest.spyOn(User, 'find').mockResolvedValue(workers);
    const countDocumentsSpy = jest.spyOn(Order, 'countDocuments').mockResolvedValue(0);
    const updateManySpy = jest.spyOn(User, 'updateMany').mockResolvedValue({ nModified: 3 });

    const recommendedWorkers = await recommendWorkers(jobRequest);

    expect(recommendedWorkers).toHaveLength(3);
    // Charlie should be first due to high rating, skill match, and fairness score
    expect(recommendedWorkers[0].name).toBe('Charlie');
    // Alice should be second
    expect(recommendedWorkers[1].name).toBe('Alice');
    // Bob should be last
    expect(recommendedWorkers[2].name).toBe('Bob');

    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy).toHaveBeenCalledTimes(1);

    findSpy.mockRestore();
    countDocumentsSpy.mockRestore();
    updateManySpy.mockRestore();
  });
});
