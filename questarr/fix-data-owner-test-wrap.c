/* Test-only linker wrapper; production Home Assistant builds do not include it. */
#include <errno.h>
#include <stdio.h>
#include <sys/types.h>

#ifndef QUESTARR_TEST_CHOWN_LOG
#error "The sanitizer test must provide a disposable lchown log path."
#endif

int __wrap_lchown(const char *path, uid_t owner, gid_t group) {
  const char *log_path = QUESTARR_TEST_CHOWN_LOG;
  FILE *log;
  int failed;

  log = fopen(log_path, "a");
  if (log == NULL) {
    return -1;
  }

  failed = fprintf(log, "%lu\t%lu\t%s\n", (unsigned long)owner,
                   (unsigned long)group, path) < 0;
  if (fclose(log) != 0) {
    failed = 1;
  }

  if (failed) {
    errno = EIO;
    return -1;
  }
  return 0;
}
