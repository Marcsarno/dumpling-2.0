export interface Viewpoint {
  id: string;
  scene: 'house' | 'store';
  store?: 'corner' | 'toys' | 'collector';
  storeName?: string;
  focus: [number, number];
  height: number;
}
export const VIEWPORT: {width: number; height: number; deviceScaleFactor: number};
export const PLAY_HEIGHT: number;
export const VIEWPOINTS: Viewpoint[];
