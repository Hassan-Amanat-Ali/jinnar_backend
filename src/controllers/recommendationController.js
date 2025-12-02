import * as recommendationService from '../services/recommendationService.js';
import { getCoordinatesFromAddress } from "../utils/geocoding.js";

export const recommendWorkers = async (req, res) => {
  try {
    const { title, description, categoryId, subcategoryId, address } = req.body;

    let finalLat = null;
    let finalLng = null;

    if (address) {
      try {
        const geocodedLocation = await getCoordinatesFromAddress(address);
        if (geocodedLocation) {
          finalLat = geocodedLocation.lat;
          finalLng = geocodedLocation.lng;
        } else {
          console.warn("Geocoding returned no coordinates for address:", address);
        }
      } catch (geocodeError) {
        console.error("Geocoding failed for recommendation address:", address, geocodeError);
        return res.status(500).json({ error: "Failed to geocode recommendation address" });
      }
    }

    const jobRequest = { 
      title, 
      description, 
      categoryId, 
      subcategoryId, 
      lat: finalLat, 
      lng: finalLng 
    };
    
    const recommendedGigs = await recommendationService.recommendGigs(jobRequest);
    res.status(200).json(recommendedGigs);
  } catch (error) {
    console.error('Error recommending workers:', error);
    res.status(500).json({ message: 'Error recommending workers' });
  }
};
