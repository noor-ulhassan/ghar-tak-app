import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { googleMapsKeyRejected, hasGoogleMapsKey, loadGoogleMaps, onGoogleMapsKeyRejected } from '@/lib/googleMaps';

// Google reports a rejected key only once per page load, so a setup failure is
// remembered here; coming back to the home page must not show the map again.
let mapSetupFailed = false;

const NearbyMap = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('store');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  // Set when Google Maps can't work because of how it's set up (key, billing,
  // APIs). Visitors can't fix that, so the map is hidden instead of showing them
  // setup instructions.
  const [unavailable, setUnavailable] = useState(false);

  const hideMap = (reason: string) => {
    console.error(`Map hidden: ${reason}`);
    mapSetupFailed = true;
    setUnavailable(true);
  };

  const initializeMap = () => {
    if (!mapRef.current) {
      setIsLoadingMap(false);
      return;
    }

    if (!(typeof window.google !== 'undefined' && window.google.maps && typeof window.google.maps.Map === 'function')) {
      console.error('Google Maps API or Map constructor is not available after polling.');
      setMapError('Google Maps components failed to load. Please check your connection or API key setup.');
      setIsLoadingMap(false);
      hideMap('Google Maps loaded without its Map constructor');
      return;
    }
    
    setIsLoadingMap(true);
    setMapError(null);

    try {
      const newMapInstance = new window.google.maps.Map(mapRef.current, {
        center: userLocation || { lat: 30.3753, lng: 69.3451 }, // Default to Pakistan
        zoom: userLocation ? 14 : 6,
        ...(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID
          ? { mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string }
          : {}),
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      setMap(newMapInstance);

      if (userLocation) {
        newMapInstance.setCenter(userLocation);
        newMapInstance.setZoom(14);
      } else {
         handleLocationButtonClick(false, newMapInstance); // Attempt to get location on init
      }
      setIsLoadingMap(false);

    } catch (e: any) {
      console.error('Error initializing Google Map:', e);
      let friendlyMessage = 'Could not load map. An unexpected error occurred.';
      const errorMessage = e.message || '';
      const errorName = e.name || '';

      if (errorMessage.includes('BillingNotEnabledMapError') || errorName.includes('BillingNotEnabledMapError')) {
        friendlyMessage = 'Map service is temporarily unavailable. Billing may not be enabled for the associated Google Cloud project. Please check your Google Cloud Console or contact support.';
      } else if (errorMessage.includes('ApiNotActivatedMapError') || errorName.includes('ApiNotActivatedMapError')) {
         friendlyMessage = 'The Maps JavaScript API is not activated for this API key. Please enable it in your Google Cloud Console.';
      } else if (errorMessage.includes('InvalidKeyMapError') || errorName.includes('InvalidKeyMapError') || errorMessage.includes('ApiTargetBlockedMapError') || errorName.includes('ApiTargetBlockedMapError')) {
          friendlyMessage = 'The provided API key is invalid or not authorized for this domain. Please check the API key and its restrictions in the Google Cloud Console.';
      } else if (errorMessage.includes('MissingKeyMapError') || errorName.includes('MissingKeyMapError')) {
          friendlyMessage = 'API key is missing. Map functionality requires a valid API key to be configured.';
      }
      setMapError(friendlyMessage);
      setIsLoadingMap(false);
      hideMap(friendlyMessage);
    }
  };
  
  const handleLocationButtonClick = (showError = true, currentMapInstance = map) => {
    setIsLoadingMap(true); 
    // Don't clear mapError here if it's a persistent API key issue
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLocation);
          if (currentMapInstance) {
            currentMapInstance.setCenter(newLocation);
            currentMapInstance.setZoom(14);
          }
          if (mapError && !mapError.toLowerCase().includes('api') && !mapError.toLowerCase().includes('billing')) {
            setMapError(null); // Clear transient errors like "Could not get your location"
          }
          setIsLoadingMap(false);
        },
        (err) => {
          console.warn('User denied location access or error occurred:', err.message);
          if(showError) setMapError('Could not get your location. Please enable location services in your browser/OS settings.');
          setIsLoadingMap(false);
        }
      );
    } else {
      if(showError) setMapError('Geolocation is not supported by this browser.');
      setIsLoadingMap(false);
    }
  };

  useEffect(() => {
    // Google rejects the key for a wrong key, a blocked domain or no billing.
    // Without this, Google draws its own error box inside the map.
    const stopListening = onGoogleMapsKeyRejected(() => hideMap('Google Maps rejected the API key'));

    setIsLoadingMap(true);
    loadGoogleMaps()
      .then(() => {
        initializeMap();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setMapError('Google Maps failed to load.');
        setIsLoadingMap(false);
        hideMap(msg);
      });

    return stopListening;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!map || !userLocation) { // Don't search if map or location isn't ready
      if (map && userLocation === null && !isLoadingMap && !mapError) {
        // If map is ready but location is not, prompt user or show gentle message.
        // For now, relies on initial handleLocationButtonClick or manual click.
      }
      return;
    }
    
    // If there's a map initialization error, don't attempt to search for places.
    if (mapError && (mapError.includes('API key') || mapError.includes('Billing') || mapError.includes('activated'))) {
      return;
    }

    if (!(window.google && window.google.maps && window.google.maps.places && typeof window.google.maps.places.PlacesService === 'function')) {
      console.warn('Google Maps PlacesService component is not available. This might be due to the Places API not being enabled or a script loading issue.');
      setMapError('Places search functionality is unavailable. Please ensure the "Places API" is enabled in your Google Cloud Console and your API key is configured correctly.');
      hideMap('Places library is missing; the Places API may not be enabled');
      return;
    }
    // Clear previous places-specific error if map itself is okay and PlacesService is now available
    if (mapError && mapError.startsWith('Places search functionality is unavailable')) {
        setMapError(null);
    }
    
    setIsSearchingPlaces(true);
    const service = new window.google.maps.places.PlacesService(map);
    markers.forEach(marker => marker.setMap(null)); // Clear previous markers
    setMarkers([]);

    service.nearbySearch(
      {
        location: userLocation,
        radius: 5000, // 5 km radius
        type: selectedCategory, // This should be a supported type string
        keyword: searchQuery,
      },
      (places, status) => {
        setIsSearchingPlaces(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && places) {
          const newMarkers = places.map(place => {
            if (!place.geometry || !place.geometry.location) return null;
            // Consider using Advanced Markers if mapId is properly configured
            const marker = new window.google.maps.Marker({
              map,
              position: place.geometry.location,
              title: place.name,
              // icon: // Optional: custom icon
            });
            const infowindow = new window.google.maps.InfoWindow({
              content: `<div style="color: #333; font-family: sans-serif;"><strong>${place.name || 'Unknown place'}</strong><br>${place.vicinity || ''}</div>`
            });
            marker.addListener('click', () => {
              infowindow.open(map, marker);
            });
            return marker;
          }).filter(marker => marker !== null) as google.maps.Marker[];
          setMarkers(newMarkers);
          if (newMarkers.length === 0 && searchQuery) {
             // setMapError(`No results found for "${searchQuery}" in category "${selectedCategory}". Try a broader search.`);
          }
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.info('No places found for the current search criteria.');
          // setMapError(`No results found for your search. Try different keywords or category.`);
        } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
          console.warn('PlacesService search request denied. Status: ' + status);
          setMapError('Places search request was denied. This can happen if the "Places API" is not enabled for your project, your API key is invalid for Places API, or due to billing issues. Please check your Google Cloud Console settings.');
          hideMap('Places search was denied; check the Places API and billing');
        } else {
          console.warn('PlacesService search was not successful for the following reason: ' + status);
          setMapError("Couldn't search for places right now. Please try again.");
        }
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, userLocation, selectedCategory, map]); // mapError was removed from deps to avoid re-triggering search on error set
  
  if (unavailable) return null;

  const controlsDisabled = !!mapError || isLoadingMap;

  return (
    <Card className="shadow-lg my-8">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Explore Nearby on Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Input
            type="text"
            placeholder="Search businesses (e.g., restaurant)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow"
            disabled={controlsDisabled}
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={controlsDisabled}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {/* Common place types. Refer to Google Maps documentation for full list */}
              <SelectItem value="store">Store</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="cafe">Cafe</SelectItem>
              <SelectItem value="hospital">Hospital</SelectItem>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="atm">ATM</SelectItem>
              <SelectItem value="gas_station">Gas Station</SelectItem>
              <SelectItem value="gym">Gym</SelectItem>
              <SelectItem value="beauty_salon">Beauty Salon</SelectItem>
              <SelectItem value="car_repair">Car Repair</SelectItem>
              <SelectItem value="laundry">Laundry</SelectItem>
              <SelectItem value="park">Park</SelectItem>
              <SelectItem value="school">School</SelectItem>
              <SelectItem value="shopping_mall">Shopping Mall</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => handleLocationButtonClick()} 
            disabled={isLoadingMap || (!!mapError && mapError.toLowerCase().includes('api'))} // Disable if API error, but allow if only "could not get location"
            className="w-full sm:w-auto"
          >
            {(isLoadingMap && !userLocation && !mapError) || (isLoadingMap && mapError?.includes('Could not get')) ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : null}
            {userLocation ? 'Refresh Location' : 'Use My Location'}
          </Button>
        </div>
        
        <div className="h-[400px] w-full rounded-md border overflow-hidden relative">
          {mapError && !isLoadingMap && (
            <div className="absolute inset-0 z-10 h-full w-full flex flex-col items-center justify-center bg-destructive/10 p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive font-semibold text-lg">Map Error</p>
              <p className="text-muted-foreground max-w-md">{mapError}</p>
              {!mapError.toLowerCase().includes('api key') && !mapError.toLowerCase().includes('billing') && !mapError.toLowerCase().includes('activated') && !mapError.toLowerCase().includes('places api') && (
                <Button onClick={initializeMap} variant="outline" className="mt-4">Try Reload Map</Button>
              )}
            </div>
          )}
          {(isLoadingMap || isSearchingPlaces) && !mapError && (
             <div className="absolute inset-0 z-10 h-full w-full flex flex-col items-center justify-center bg-background/80 p-6 text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">{isLoadingMap ? 'Loading map...' : 'Searching for places...'}</p>
            </div>
          )}
          <div ref={mapRef} className={`h-full w-full ${ (mapError || isLoadingMap) ? 'bg-muted' : ''}`} />
        </div>
      </CardContent>
    </Card>
  );
};

/** Without a Google Maps key the map has nothing to show, so the home page leaves it out. */
const Map = () => (hasGoogleMapsKey && !mapSetupFailed && !googleMapsKeyRejected() ? <NearbyMap /> : null);

export default Map;
