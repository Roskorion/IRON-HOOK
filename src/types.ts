export type Lure = {
  id: string;
  maker: string;
  model: string;
  type: string;
  weight: number;
  color: string;
  code: string;
  photo: string;
  demo?: boolean;
};
export type Gear = {
  id: string;
  type: string;
  name: string;
  specs: string;
  demo?: boolean;
};
export type Kit = {
  id: string;
  name: string;
  rod: string;
  reel: string;
  line: string;
  leader: string;
  demo?: boolean;
};
export type Catch = {
  id: string;
  round: number;
  lure: string;
  lureText?: string;
  count: number;
};
export type Trip = {
  id: string;
  date: string;
  venue: string;
  weather: string;
  type: string;
  rounds: number;
  catches: Catch[];
  demo?: boolean;
};
export type Data = { lures: Lure[]; gear: Gear[]; kits: Kit[]; trips: Trip[] };
