# Quick start

QuestarrNG runs on your own server. The [main README](../README.md#installation)
lists the Windows installer, Docker Compose, optional PostgreSQL, and other
deployment options. This page covers a basic Docker install with SQLite.

## Start QuestarrNG

Install Docker, then run:

```sh
mkdir -p ./data
docker run -d -p 5000:5000 --user "$(id -u):$(id -g)" \
  -e PUID="$(id -u)" -e PGID="$(id -g)" \
  -v ./data:/app/data --name questarrng ghcr.io/snapetech/questarrng:latest
```

Open [http://localhost:5000](http://localhost:5000) and follow the setup
wizard. Keep the `./data` directory across upgrades; it contains your SQLite
database and application data. The image supports `linux/amd64` and `linux/arm64`.

## Set up your library

1. Choose a metadata provider and add games through Discover or a Steam wishlist.
2. Add indexers or connect Prowlarr, then configure a downloader.
3. Add games to your library and search for releases.
4. Configure imports if you want QuestarrNG to organize completed downloads.
5. Set notification preferences, add RSS feeds, or use [Backlog roulette](BACKLOG_ROULETTE.md).

For the details, see [Indexers and Prowlarr](INDEXERS.md),
[download import](IMPORTS.md), [notifications](NOTIFICATIONS.md),
[RSS feeds](RSS.md), and [downloader compatibility](DOWNLOADERS_COMPATIBILITY.md).

If QuestarrNG sits behind a reverse proxy, use HTTPS and follow the
[reverse proxy guide](REVERSE_PROXY.md). For Compose, Windows, PostgreSQL, and
home-server installations, start with the [main installation guide](../README.md#installation).
