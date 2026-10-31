import { Router, Route, type RouteSectionProps } from "@solidjs/router";
import { onMount } from "solid-js";
import { ServersProvider } from "~/state/servers";
import { PlayerProvider } from "~/player/store";
import { PlaylistsProvider } from "~/state/playlists";
import { initI18n } from "~/i18n";
import { initSettings } from "~/state/settings";
import { initDownloads } from "~/state/downloads";
import {
  checkForUpdatesOnStartup,
  loadAppVersion,
} from "~/lib/updater";
import { Toaster } from "~/components/toaster";
import { UpdatePrompt } from "~/components/update-prompt";
import { TitleBar } from "~/components/title-bar";
import { AppLayout } from "~/components/app-layout";
import SetupPage from "~/routes/setup";
import ServersPage from "~/routes/servers";
import HomePage from "~/routes/home";
import FavoritesPage from "~/routes/favorites";
import AlbumsPage from "~/routes/albums";
import AlbumPage from "~/routes/album";
import ArtistsPage from "~/routes/artists";
import ArtistPage from "~/routes/artist";
import PlaylistsPage from "~/routes/playlists";
import PlaylistPage from "~/routes/playlist";
import SearchPage from "~/routes/search";
import GenresPage from "~/routes/genres";
import GenrePage from "~/routes/genre";
import ProfilePage from "~/routes/profile";
import DownloadsPage from "~/routes/downloads";
import SettingsPage from "~/routes/settings";
import AppearanceSettingsPage from "~/routes/settings/appearance";
import PlaybackSettingsPage from "~/routes/settings/playback";
import LyricsSettingsPage from "~/routes/settings/lyrics";
import ServersSettingsPage from "~/routes/settings/servers";
import DownloadSettingsPage from "~/routes/settings/downloads";
import AboutSettingsPage from "~/routes/settings/about";
import NotFoundPage from "~/routes/not-found";

function Root(props: RouteSectionProps) {
  onMount(() => {
    void initI18n();
    void initSettings().then(() => {
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
