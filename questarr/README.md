# Questarr Home Assistant Add-on

This add-on wraps the QuestarrNG image and persists application state in Home
Assistant Supervisor's `/data` volume.

## Install

1. In Home Assistant, open **Settings → Add-ons → Add-on Store**.
2. Open the menu (⋮), choose **Repositories**, and add
   `https://github.com/snapetech/QuestarrNG`.
3. Install **Questarr**, start it, and open
   `http://<home-assistant-host>:5000`.

## Storage and permissions

- Supervisor's `/data` is the persistent application-data volume. The image
  links `/app/data` to `/data`; the default SQLite database is
  `/data/sqlite.db`.
- The current add-on supports `amd64` and runs as the unprivileged `questarr`
  account with UID/GID `1000:1000`. The add-on does not expose PUID/PGID options.
- Before starting the app, a small helper with only `CAP_CHOWN` corrects
  ownership under `/data`. It walks the mounted data path without following
  symlinks; it does not change ownership outside that mount. The application
  then verifies that the directory and an existing database are writable.
- The helper does not make a missing or read-only volume writable. If startup
  reports a permission error, verify the Supervisor volume is mounted at
  `/data`, is writable, and allows the ownership change. For NAS-backed
  storage, also verify the host-side bind or export configuration.
- The add-on manifest does not define a separate game-library or downloads
  mount. Do not use the app-data `/data` volume as a game-library path.

The image migrates any seeded `/app/data` content into `/data` during image
construction, then keeps `/app/data` as a symlink to the persistent location.
