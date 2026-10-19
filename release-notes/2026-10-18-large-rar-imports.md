### Fixed

- Large RAR releases (for example 90+ GB PS5 dumps with tens of thousands of files) no longer fail with an `unrar failed` error that only showed the start of the file listing. Questarr now accepts much bigger archive listings, checks archives quietly, and allows up to 6 hours per archive step (set `ARCHIVE_TOOL_TIMEOUT_MINUTES` to change it).
- Classic multi-volume sets that continue past `.r99` into `.s00`, `.s01`, … are now recognised as one archive, so those volumes are not copied into your library.
- When an archive tool does fail, the error now shows its exit reason and the last lines it printed (such as a missing volume or a CRC error), instead of the file listing.
