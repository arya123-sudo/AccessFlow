import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';

import {findOptimalPath} from './src/navigation/navigationEngine';
import {sampleGraph} from './src/navigation/sampleGraph';

type Screen = 'home' | 'accessibility' | 'navigation' | 'analytics';
type NavigationProfile = 'standard' | 'reducedHorizontal';

const movies = [
  {id: 1, title: 'The Last Horizon', genre: 'Adventure', duration: '2h 10m'},
  {id: 2, title: 'City of Dreams', genre: 'Drama', duration: '1h 45m'},
  {id: 3, title: 'Beyond the Stars', genre: 'Sci-Fi', duration: '2h 05m'},
  {id: 4, title: 'Laugh Out Loud', genre: 'Comedy', duration: '1h 30m'},
  {id: 5, title: 'Hidden Truth', genre: 'Thriller', duration: '1h 55m'},
  {id: 6, title: 'Family Time', genre: 'Family', duration: '1h 40m'},
];

const navigationProfiles = {
  standard: {
    movementCost: 1,
    reversalCost: 1,
  },
  reducedHorizontal: {
    movementCost: 3,
    reversalCost: 2,
  },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [profile, setProfile] = useState<NavigationProfile>('standard');

  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);

  const [navigationCount, setNavigationCount] = useState(0);
  const [directionChanges, setDirectionChanges] = useState(0);
  const [navigationEffort, setNavigationEffort] = useState(0);

  const [routeStarted, setRouteStarted] = useState(false);
  const [routeStep, setRouteStep] = useState(0);

  const previousFocus = useRef<number | null>(null);
  const previousDirection = useRef<number | null>(null);

  const optimalRoute = findOptimalPath(
    sampleGraph,
    'home',
    'comedy',
    profile,
  );

  const handleMovieFocus = (movieId: number) => {
    setFocusedElement(`movie-${movieId}`);

    if (
      previousFocus.current !== null &&
      previousFocus.current !== movieId
    ) {
      const direction = movieId > previousFocus.current ? 1 : -1;
      const weights = navigationProfiles[profile];

      let effort = weights.movementCost;

      setNavigationCount(count => count + 1);

      if (
        previousDirection.current !== null &&
        previousDirection.current !== direction
      ) {
        setDirectionChanges(count => count + 1);
        effort += weights.reversalCost;
      }

      setNavigationEffort(total => total + effort);
      previousDirection.current = direction;
    }

    previousFocus.current = movieId;
  };

  const changeProfile = (newProfile: NavigationProfile) => {
    setProfile(newProfile);
    setRouteStarted(false);
    setRouteStep(0);
  };

  const startRoute = () => {
    if (!optimalRoute) {
      return;
    }

    setRouteStep(0);
    setRouteStarted(true);
  };

  const nextRouteStep = () => {
    if (!optimalRoute) {
      return;
    }

    setRouteStep(current =>
      Math.min(current + 1, optimalRoute.path.length - 1),
    );
  };

  const routeCompleted =
    routeStarted &&
    optimalRoute !== null &&
    routeStep === optimalRoute.path.length - 1;

  const renderButton = (
    id: string,
    label: string,
    onPress: () => void,
    active = false,
  ) => (
    <Pressable
      key={id}
      focusable
      onFocus={() => setFocusedElement(id)}
      onBlur={() => setFocusedElement(null)}
      onPress={onPress}
      style={[
        styles.button,
        active && styles.activeButton,
        focusedElement === id && styles.focusedButton,
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );

  const renderHome = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Explore Movies</Text>

      <Text style={styles.description}>
        Browse entertainment using your TV remote.
      </Text>

      <ScrollView horizontal style={styles.movieScroll}>
        {movies.map(movie => (
          <Pressable
            key={movie.id}
            focusable
            onFocus={() => handleMovieFocus(movie.id)}
            onBlur={() => setFocusedElement(null)}
            onPress={() => setSelectedMovie(movie.title)}
            style={[
              styles.movieCard,
              focusedElement === `movie-${movie.id}` &&
                styles.focusedMovieCard,
            ]}>
            <Text style={styles.movieIcon}>▶</Text>
            <Text style={styles.movieTitle}>{movie.title}</Text>
            <Text style={styles.movieInfo}>
              {movie.genre} • {movie.duration}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {selectedMovie && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Selected Movie: {selectedMovie}
          </Text>
        </View>
      )}
    </View>
  );

  const renderAccessibility = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Accessibility Preferences</Text>

      <Text style={styles.description}>
        Choose a navigation profile that suits your movement preferences.
      </Text>

      <View style={styles.row}>
        {renderButton(
          'standard',
          'Standard Navigation',
          () => changeProfile('standard'),
          profile === 'standard',
        )}

        {renderButton(
          'reducedHorizontal',
          'Reduced Horizontal Movement',
          () => changeProfile('reducedHorizontal'),
          profile === 'reducedHorizontal',
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Current Profile</Text>

        <Text style={styles.infoText}>
          {profile === 'standard'
            ? 'Standard: Equal directional movement costs.'
            : 'Reduced Horizontal: Left and right movements have higher costs.'}
        </Text>
      </View>
    </View>
  );

  const renderNavigation = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Smart Navigation</Text>

      <Text style={styles.description}>
        Weighted graph optimization using Dijkstra's algorithm.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Recommended Route</Text>

        <Text style={styles.infoText}>
          {optimalRoute?.path.join(' → ') ?? 'Unavailable'}
        </Text>

        <Text style={styles.infoText}>
          Estimated Route Effort: {optimalRoute?.effort ?? 'N/A'}
        </Text>

        <Text style={styles.infoText}>
          Active Profile: {profile}
        </Text>
      </View>

      <View style={styles.row}>
        {renderButton(
          'startRoute',
          'Start Guided Navigation',
          startRoute,
        )}

        {routeStarted &&
          !routeCompleted &&
          renderButton(
            'nextStep',
            'Next Step',
            nextRouteStep,
          )}
      </View>

      {routeStarted && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            {routeCompleted ? 'Destination Reached!' : 'Navigation Progress'}
          </Text>

          <Text style={styles.infoText}>
            {routeCompleted
              ? 'You have completed the suggested route.'
              : `Current Location: ${optimalRoute?.path[routeStep]}`}
          </Text>
        </View>
      )}

      <Text style={styles.note}>
        Prototype demonstration: Routes currently use a sample navigation graph.
      </Text>
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Navigation Analytics</Text>

      <Text style={styles.description}>
        Understanding remote-control navigation patterns.
      </Text>

      <View style={styles.analyticsGrid}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>{navigationCount}</Text>
          <Text style={styles.analyticsLabel}>Focus Moves</Text>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>{directionChanges}</Text>
          <Text style={styles.analyticsLabel}>Direction Changes</Text>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>{navigationEffort}</Text>
          <Text style={styles.analyticsLabel}>Estimated Effort</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Active Navigation Profile</Text>
        <Text style={styles.infoText}>{profile}</Text>
      </View>

      <Text style={styles.note}>
        Effort scores use illustrative profile weights, not validated
        accessibility measurements.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={styles.header}>
        <Text style={styles.logo}>ACCESSFLOW</Text>
        <Text style={styles.tagline}>
          Ability-Aware Smart TV Navigation
        </Text>
      </View>

      <View style={styles.navbar}>
        {renderButton(
          'tab-home',
          'HOME',
          () => setScreen('home'),
          screen === 'home',
        )}

        {renderButton(
          'tab-accessibility',
          'ACCESSIBILITY',
          () => setScreen('accessibility'),
          screen === 'accessibility',
        )}

        {renderButton(
          'tab-navigation',
          'NAVIGATION',
          () => setScreen('navigation'),
          screen === 'navigation',
        )}

        {renderButton(
          'tab-analytics',
          'ANALYTICS',
          () => setScreen('analytics'),
          screen === 'analytics',
        )}
      </View>

      {screen === 'home' && renderHome()}
      {screen === 'accessibility' && renderAccessibility()}
      {screen === 'navigation' && renderNavigation()}
      {screen === 'analytics' && renderAnalytics()}

      <Text style={styles.footer}>
        AccessFlow | Making Entertainment Accessible
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
    padding: 35,
  },

  header: {
    marginBottom: 20,
  },

  logo: {
    color: '#55D6BE',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 3,
  },

  tagline: {
    color: '#A0AEC0',
    fontSize: 15,
    marginTop: 5,
  },

  navbar: {
    flexDirection: 'row',
    marginBottom: 25,
  },

  button: {
    backgroundColor: '#263653',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 10,
    marginRight: 15,
    borderWidth: 3,
    borderColor: 'transparent',
  },

  activeButton: {
    borderColor: '#55D6BE',
  },

  focusedButton: {
    backgroundColor: '#385B78',
    borderColor: '#FFFFFF',
    transform: [{scale: 1.05}],
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  content: {
    flex: 1,
    paddingTop: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  description: {
    color: '#A0AEC0',
    fontSize: 18,
    marginBottom: 25,
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 15,
  },

  movieScroll: {
    flexGrow: 0,
  },

  movieCard: {
    width: 210,
    height: 190,
    backgroundColor: '#1C2541',
    borderRadius: 14,
    marginRight: 20,
    padding: 20,
    borderWidth: 3,
    borderColor: 'transparent',
    justifyContent: 'center',
  },

  focusedMovieCard: {
    borderColor: '#55D6BE',
    backgroundColor: '#293A60',
    transform: [{scale: 1.05}],
  },

  movieIcon: {
    color: '#55D6BE',
    fontSize: 34,
    marginBottom: 15,
  },

  movieTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
  },

  movieInfo: {
    color: '#A0AEC0',
    fontSize: 14,
    marginTop: 10,
  },

  infoBox: {
    backgroundColor: '#16213E',
    padding: 22,
    borderRadius: 12,
    marginTop: 25,
  },

  infoTitle: {
    color: '#55D6BE',
    fontSize: 21,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  infoText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 8,
  },

  analyticsGrid: {
    flexDirection: 'row',
    marginTop: 15,
  },

  analyticsCard: {
    backgroundColor: '#16213E',
    padding: 30,
    borderRadius: 12,
    marginRight: 20,
    minWidth: 200,
    alignItems: 'center',
  },

  analyticsNumber: {
    color: '#55D6BE',
    fontSize: 38,
    fontWeight: 'bold',
  },

  analyticsLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },

  note: {
    color: '#718096',
    fontSize: 14,
    marginTop: 25,
  },

  footer: {
    color: '#718096',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
});