# Notifications

Open **Settings → Notifications** to choose which events create in-app alerts
and which are forwarded through [Apprise](https://github.com/caronc/apprise).
QuestarrNG's update checks and availability badges continue to work even when
notifications are disabled.

## Choose update alerts

The **Notify for shelved games** and **Notify for completed games** switches
control game-update and new pack/add-on alerts for those statuses. They apply
to both in-app and Apprise notifications. Both are enabled by default for
existing installations; turn them off if you do not want those alerts.

## Configure Apprise

Choose one of two modes:

- **API** sends notifications to an Apprise API server. Enter its URL and either
  a configuration key or notification URLs. If the API server requires login,
  enter its username and password as well.
- **CLI** runs the local `apprise` command. Enter one notification URL per line.

Save the settings, then choose **Send Test Notification**. The saved password is
encrypted and shown as a mask; leave the mask unchanged to keep it. Use HTTPS
for a remote API server so credentials stay protected in transit. The settings
page warns when the API URL uses HTTP.

See [secret storage and rotation](SECRETS.md) for the storage details.
