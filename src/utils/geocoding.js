export const getCoordinatesFromAddress = async (address) => {
  const apiKey = import.meta.env.VITE_GEOCODE_KEY;

  if (!address || !apiKey) {
    console.error("Missing address or API key for Geocode.maps.co");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    // 1. Use the geocode.maps.co endpoint
    const url = `https://geocode.maps.co/search?q=${encodedAddress}&api_key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    // 2. Check results
    if (data && data.length > 0) {
      return {
        // They return strings, so we parse them to numbers
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    } else {
      console.warn("No coordinates found.");
      return null;
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};