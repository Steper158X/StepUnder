import {
  Router,
  Route,
  useLocation,
  useNavigate,
  type RouteSectionProps,
} from "@solidjs/router";
import { lazy, onMount } from "solid-js";
import { ServersProvider } from "~/state/servers";
import { PlayerProvider } from "~/player/store";
import { PlaylistsProvider } from "~/state/playlists";
import { initI18n } from "~/i18n";
import { isMobile, isNarrow } from "~/lib/platform";
import { initSettings } from "~/state/settings";
import { initDownloads } from "~/state/downloads";
import { initCoverCache } from "~/state/cover-cache";
import {
  checkForUpdatesOnStartup,
  loadAppVersion,
} from "~/lib/updater";
import { Toaster } from "~/components/toaster";
import { UpdatePrompt } from "~/components/update-prompt";
import { TitleBar } from "~/components/title-bar";
import { AppLayout } from "~/components/app-layout";
import HomePage from "~/routes/home";

// Pages load on first visit, so unopened ones never cost parse time or heap.
const SetupPage = lazy(() => import("~/routes/setup"));
const ServersPage = lazy(() => import("~/routes/servers"));
const FavoritesPage = lazy(() => import("~/routes/favorites"));
const AlbumsPage = lazy(() => import("~/routes/albums"));
const AlbumPage = lazy(() => import("~/routes/album"));
const ArtistsPage = lazy(() => import("~/routes/artists"));
const ArtistPage = lazy(() => import("~/routes/artist"));
const PlaylistsPage = lazy(() => import("~/routes/playlists"));
const PlaylistPage = lazy(() => import("~/routes/playlist"));
const SearchPage = lazy(() => import("~/routes/search"));
const LibraryPage = lazy(() => import("~/routes/library"));
const GenresPage = lazy(() => import("~/routes/genres"));
const GenrePage = lazy(() => import("~/routes/genre"));
const ProfilePage = lazy(() => import("~/routes/profile"));
const DownloadsPage = lazy(() => import("~/routes/downloads"));
const SettingsPage = lazy(() => import("~/routes/settings"));
const AppearanceSettingsPage = lazy(() => import("~/routes/settings/appearance"));
const PlaybackSettingsPage = lazy(() => import("~/routes/settings/playback"));
const LyricsSettingsPage = lazy(() => import("~/routes/settings/lyrics"));
const ServersSettingsPage = lazy(() => import("~/routes/settings/servers"));
const DownloadSettingsPage = lazy(() => import("~/routes/settings/downloads"));
const AboutSettingsPage = lazy(() => import("~/routes/settings/about"));
const CacheSettingsPage = lazy(() => import("~/routes/settings/cache"));
const NotFoundPage = lazy(() => import("~/routes/not-found"));

function Root(props: RouteSectionProps) {
  const location = useLocation();
  const navigate = useNavigate();

  onMount(() => {
    // Phones always open on Home, not on whatever page the webview restored.
    const path = location.pathname;
    if (
      (isMobile || isNarrow()) &&
      path !== "/" &&
      path !== "/setup" &&
      path !== "/servers"
    ) {
      navigate("/", { replace: true });
    }

    void initI18n();
    void initSettings().then(() => {
      initCoverCache();
      void initDownloads();
      void loadAppVersion();
      void checkForUpdatesOnStartup();
    });
  });

  return (
    <PlaylistsProvider>
      {props.children}
      <Toaster />
      <UpdatePrompt />
    </PlaylistsProvider>
  );
}

export default function App() {
  return (
    <div class="flex h-full flex-col overflow-hidden">
      <TitleBar />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <ServersProvider>
          <PlayerProvider>
            <Router root={Root}>
              <Route path="/setup" component={SetupPage} />
              <Route path="/servers" component={ServersPage} />
              <Route path="/" component={AppLayout}>
                <Route path="/" component={HomePage} />
                <Route path="/favorites" component={FavoritesPage} />
                <Route path="/albums" component={AlbumsPage} />
                <Route path="/album/:id" component={AlbumPage} />
                <Route path="/artists" component={ArtistsPage} />
                <Route path="/artist/:id" component={ArtistPage} />
                <Route path="/playlists" component={PlaylistsPage} />
                <Route path="/playlist/:id" component={PlaylistPage} />
                <Route path="/search" component={SearchPage} />
                <Route path="/library" component={LibraryPage} />
                <Route path="/genres" component={GenresPage} />
                <Route path="/genre/:name" component={GenrePage} />
                <Route path="/profile" component={ProfilePage} />
                <Route path="/downloads" component={DownloadsPage} />
                <Route path="/settings" component={SettingsPage} />
                <Route
                  path="/settings/appearance"
                  component={AppearanceSettingsPage}
                />
                <Route
                  path="/settings/playback"
                  component={PlaybackSettingsPage}
                />
                <Route
                  path="/settings/lyrics"
                  component={LyricsSettingsPage}
                />
                <Route
                  path="/settings/servers"
                  component={ServersSettingsPage}
                />
                <Route
                  path="/settings/downloads"
                  component={DownloadSettingsPage}
                />
                <Route
                  path="/settings/cache"
                  component={CacheSettingsPage}
                />
                <Route path="/settings/about" component={AboutSettingsPage} />
              </Route>
              <Route path="*" component={NotFoundPage} />
            </Router>
          </PlayerProvider>
        </ServersProvider>
      </div>
    </div>
  );
}
