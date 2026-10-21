import { Router, Route, type RouteSectionProps } from "@solidjs/router";
import { onMount } from "solid-js";
import { ServersProvider } from "~/state/servers";
import { PlayerProvider } from "~/player/store";
import { initI18n } from "~/i18n";
import { initSettings } from "~/state/settings";
import { Toaster } from "~/components/toaster";
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
import ProfilePage from "~/routes/profile";
import SettingsPage from "~/routes/settings";
import NotFoundPage from "~/routes/not-found";

function Root(props: RouteSectionProps) {
  onMount(() => {
    void initI18n();
    void initSettings();
  });

  return (
    <>
      {props.children}
      <Toaster />
    </>
  );
}

export default function App() {
  return (
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
            <Route path="/profile" component={ProfilePage} />
            <Route path="/settings" component={SettingsPage} />
          </Route>
          <Route path="*" component={NotFoundPage} />
        </Router>
      </PlayerProvider>
    </ServersProvider>
  );
}
