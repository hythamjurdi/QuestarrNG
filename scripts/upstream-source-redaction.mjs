const databaseConnectionStringPattern = /\bpostgres(?:ql)?:\/\/[^\s"'<>\x60]+/gi;
const sensitiveQueryParameterPattern =
  /([?&](?:access_token|auth_token|refresh_token|id_token|token|jwt|api[_-]?key|client_secret|password|secret|signature|x-amz-signature|sig)=)[^&#\s"'<>]+/gi;

/**
 * Remove credential-bearing values before source records are persisted.
 * Public issue discussions can include copied connection strings or signed
 * guest-share URLs. Preserve surrounding context while making those values
 * unusable in the generated snapshot.
 */
export function redactSnapshot(value) {
  if (typeof value === "string") {
    return value
      .replace(databaseConnectionStringPattern, "[redacted database connection string]")
      .replace(sensitiveQueryParameterPattern, "$1[redacted]");
  }

  if (Array.isArray(value)) return value.map(redactSnapshot);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactSnapshot(item)])
    );
  }

  return value;
}

/** Serialize an audited source row independently of object property ordering. */
export function stableSnapshotStringify(value) {
  const sortKeys = (entry) => {
    if (Array.isArray(entry)) return entry.map(sortKeys);
    if (entry && typeof entry === "object") {
      return Object.fromEntries(
        Object.keys(entry)
          .sort()
          .map((key) => [key, sortKeys(entry[key])])
      );
    }
    return entry;
  };

  return JSON.stringify(sortKeys(value));
}
