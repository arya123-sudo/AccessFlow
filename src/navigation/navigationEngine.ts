export type NavigationProfile = 'standard' | 'reducedHorizontal';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type NavigationGraph = Record<
  string,
  {
    id: string;
    neighbors: {
      target: string;
      direction: Direction;
    }[];
  }
>;

const weights = {
  standard: {
    up: 1,
    down: 1,
    left: 1,
    right: 1,
  },
  reducedHorizontal: {
    up: 1,
    down: 1,
    left: 3,
    right: 3,
  },
};

export function findOptimalPath(
  graph: NavigationGraph,
  start: string,
  destination: string,
  profile: NavigationProfile,
) {
  if (!graph[start] || !graph[destination]) {
    return null;
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
    previous[node] = null;
  }

  distances[start] = 0;

  while (true) {
    let current: string | null = null;

    for (const node of Object.keys(graph)) {
      if (
        !visited.has(node) &&
        (current === null || distances[node] < distances[current])
      ) {
        current = node;
      }
    }

    if (current === null || distances[current] === Infinity) {
      break;
    }

    if (current === destination) {
      break;
    }

    visited.add(current);

    for (const neighbor of graph[current].neighbors) {
      if (!graph[neighbor.target]) {
        continue;
      }

      const cost = weights[profile][neighbor.direction];
      const alternative = distances[current] + cost;

      if (alternative < distances[neighbor.target]) {
        distances[neighbor.target] = alternative;
        previous[neighbor.target] = current;
      }
    }
  }

  if (distances[destination] === Infinity) {
    return null;
  }

  const path: string[] = [];
  let current: string | null = destination;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path,
    effort: distances[destination],
    buttonPresses: path.length - 1,
  };
}