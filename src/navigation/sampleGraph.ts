import type {NavigationGraph} from './navigationEngine';

export const sampleGraph: NavigationGraph = {
  home: {
    id: 'home',
    neighbors: [
      {target: 'movies', direction: 'right'},
      {target: 'shortcuts', direction: 'down'},
    ],
  },

  movies: {
    id: 'movies',
    neighbors: [
      {target: 'home', direction: 'left'},
      {target: 'comedy', direction: 'right'},
    ],
  },

  shortcuts: {
    id: 'shortcuts',
    neighbors: [
      {target: 'home', direction: 'up'},
      {target: 'comedy', direction: 'down'},
    ],
  },

  comedy: {
    id: 'comedy',
    neighbors: [
      {target: 'movies', direction: 'left'},
      {target: 'shortcuts', direction: 'up'},
    ],
  },
};