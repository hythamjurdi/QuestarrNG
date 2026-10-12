# Real-Debrid downloads

QuestarrNG can use Real-Debrid as a torrent acquisition client. Real-Debrid
downloads the torrent in its cloud service; QuestarrNG then copies the selected
files into a local staging directory and sends those files through the normal
QuestarrNG import pipeline. A cloud-completed torrent is not marked available
until that local copy finishes.

## Configure it

1. Open **Settings → Downloaders → Add Downloader** and choose **Real-Debrid**.
2. Set a name and an absolute **QuestarrNG Local Staging Path**. This directory
   is on the QuestarrNG server or container, must be writable by its process,
   and should be mounted alongside the game library when QuestarrNG runs in a
   container.
3. Save the downloader, then edit it and choose **Connect account**.
4. Open the Real-Debrid device page, enter the one-time code shown in QuestarrNG,
   and approve the authorization. QuestarrNG completes the connection and stores
   the OAuth credentials encrypted with the downloader credentials.
5. Use **Test connection** on the downloader card. QuestarrNG checks the
   account and local staging path.

QuestarrNG uses Real-Debrid's device authorization flow. Do not paste a private
Real-Debrid API token into QuestarrNG. To unlink an account, remove the
downloader or reconnect it with a different account; access can also be revoked
from Real-Debrid's account settings.
Real-Debrid requires an active premium account for its torrent API features.

## What happens to a download

Real-Debrid supports magnet links and indexer-provided torrent files. QuestarrNG
selects all files in a submitted torrent, tracks that torrent by its Real-Debrid
ID, and copies completed files into a per-torrent folder under the configured
staging path. In-progress local copies resume from partial files after a
QuestarrNG restart when the direct file host supports byte ranges. The existing
QuestarrNG import settings determine how staged files are registered and moved
into the game library.

Real-Debrid does not expose pause or resume actions for torrents through its
API. Cancelling a QuestarrNG request removes the cloud torrent; files already
staged locally are kept unless a caller explicitly requests file deletion.
Local staging disk space is shown as the downloader's available space.

See the [Real-Debrid API documentation](https://rest.real-debrid.com/) for the
provider's current account, torrent, and file-link behavior.
