import * as recommendationService from '../services/recommendationService.js';

export const recommendWorkers = async (req, res) => {
  try {
    // TODO: Get the actual job request from the request body
    const jobRequest = req.body;
    const recommendedWorkers = await recommendationService.recommendWorkers(jobRequest);
    res.status(200).json(recommendedWorkers);
  } catch (error) {
    console.error('Error recommending workers:', error);
    res.status(500).json({ message: 'Error recommending workers' });
  }
};
