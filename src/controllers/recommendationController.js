import * as recommendationService from '../services/recommendationService.js';

export const recommendWorkers = async (req, res) => {
  try {
    // The job request should contain details like title, description, categoryId, subcategoryId, etc.
    const jobRequest = req.body;
    const recommendedGigs = await recommendationService.recommendGigs(jobRequest);
    res.status(200).json(recommendedGigs);
  } catch (error) {
    console.error('Error recommending workers:', error);
    res.status(500).json({ message: 'Error recommending workers' });
  }
};
