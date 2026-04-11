export interface ExplorerSpot {
  id: string;
  name: string;
  coordinates: [number, number]; // [Longitude, Latitude] for Mapbox
  category: 'skate' | 'sunset' | 'history';
  vibe: string;
  intensity: number; // 0.0 to 1.0 for the "Density Cloud" effect
}

export const APEX_SPOTS: ExplorerSpot[] = [
  { 
    id: '1', name: 'Hunter St. Ledges', category: 'skate', 
    coordinates: [-78.8485, 35.7295], vibe: 'Buttery Pavement', intensity: 0.8 
  },
  { 
    id: '2', name: 'Beaver Creek Sunset Point', category: 'sunset', 
    coordinates: [-78.8920, 35.7350], vibe: 'Golden Hour Peak', intensity: 0.9 
  },
];