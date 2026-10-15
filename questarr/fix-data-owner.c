#define _XOPEN_SOURCE 700

#include <errno.h>
#include <ftw.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#ifndef QUESTARR_DATA_DIR
#define QUESTARR_DATA_DIR "/data"
#endif

static uid_t target_uid;
static gid_t target_gid;

static int parse_id(const char *value, unsigned long maximum, unsigned long *result) {
  char *end = NULL;
  unsigned long parsed;

  if (value == NULL || value[0] == '\0' || value[0] == '-') {
    return -1;
  }

  errno = 0;
  parsed = strtoul(value, &end, 10);
  if (errno != 0 || end == value || *end != '\0' || parsed == 0 || parsed > maximum) {
    return -1;
  }

  *result = parsed;
  return 0;
}

static int set_data_owner(const char *path, const struct stat *status, int type, struct FTW *walk) {
  (void)type;
  (void)walk;

  if (status->st_uid == target_uid && status->st_gid == target_gid) {
    return 0;
  }

  if (lchown(path, target_uid, target_gid) != 0) {
    fprintf(stderr, "Cannot set Questarr data ownership for %s: %s\n", path, strerror(errno));
    return -1;
  }

  return 0;
}

int main(int argc, char **argv) {
  unsigned long uid;
  unsigned long gid;

  if (argc != 3 ||
      parse_id(argc > 1 ? argv[1] : NULL, (unsigned long)((uid_t)-1), &uid) != 0 ||
      parse_id(argc > 2 ? argv[2] : NULL, (unsigned long)((gid_t)-1), &gid) != 0) {
    fprintf(stderr, "Usage: questarr-fix-data-owner <non-root-uid> <non-root-gid>\n");
    return 2;
  }

  target_uid = (uid_t)uid;
  target_gid = (gid_t)gid;

  if (nftw(QUESTARR_DATA_DIR, set_data_owner, 32, FTW_PHYS) != 0) {
    fprintf(stderr, "Cannot walk the Home Assistant /data volume: %s\n", strerror(errno));
    return 1;
  }

  return 0;
}
